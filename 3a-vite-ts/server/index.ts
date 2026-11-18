// LAN server: serves the built game from dist/ and hosts WebSocket rooms on /ws.
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { randomUUID } from "node:crypto";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import {
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  SNAPSHOT_HZ,
  WS_PATH,
} from "./protocol.ts";
import type { ClientMessage, ServerMessage } from "./protocol.ts";
import { createRoomRegistry } from "./rooms.ts";
import type { Connection } from "./rooms.ts";

const PORT = Number(process.env.PORT ?? 4207);
const HOST = process.env.HOST ?? "0.0.0.0";
const DIST = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const HEARTBEAT_MS = 10_000;
const MESSAGES_PER_SECOND = 90;
const INSTANCE = randomUUID();

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".txt": "text/plain; charset=utf-8",
};

const registry = createRoomRegistry();

function sendText(res: ServerResponse, status: number, body: string) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

async function serveStatic(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendText(res, 405, "Method Not Allowed");
  }
  let pathname: string;
  try {
    pathname = decodeURIComponent(
      new URL(req.url ?? "/", "http://lan").pathname,
    );
  } catch {
    return sendText(res, 400, "Bad Request");
  }
  if (pathname === "/healthz") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    return res.end(
      JSON.stringify({
        ok: true,
        protocol: PROTOCOL_VERSION,
        instance: INSTANCE,
        ...registry.stats(),
      }),
    );
  }
  const file = resolve(
    DIST,
    "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname),
  );
  if (file !== DIST && !file.startsWith(DIST + sep)) {
    return sendText(res, 403, "Forbidden");
  }
  let info;
  try {
    info = await stat(file);
  } catch {
    if (pathname === "/") {
      return sendText(res, 503, "未找到 dist/index.html，请先运行 pnpm build");
    }
    return sendText(res, 404, "Not Found");
  }
  if (!info.isFile()) {
    return sendText(res, 404, "Not Found");
  }
  res.writeHead(200, {
    "Content-Type":
      MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": info.size,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": file.startsWith(resolve(DIST, "assets") + sep)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  });
  if (req.method === "HEAD") {
    return res.end();
  }
  createReadStream(file)
    .on("error", () => res.destroy())
    .pipe(res);
}

function parseMessage(raw: string): ClientMessage | null {
  try {
    const value: unknown = JSON.parse(raw);
    return value &&
      typeof value === "object" &&
      typeof (value as { t?: unknown }).t === "string"
      ? (value as ClientMessage)
      : null;
  } catch {
    return null;
  }
}

const http = createServer((req, res) => {
  serveStatic(req, res).catch((error: unknown) => {
    console.error("[http]", error);
    if (!res.headersSent) {
      sendText(res, 500, "Internal Server Error");
    } else {
      res.destroy();
    }
  });
});

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: MAX_MESSAGE_BYTES,
});
const alive = new WeakMap<WebSocket, boolean>();

http.on("upgrade", (req, socket, head) => {
  const path = new URL(req.url ?? "/", "http://lan").pathname;
  if (path !== WS_PATH) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const remote = req.socket.remoteAddress ?? "?";
  const conn: Connection = {
    send(message: ServerMessage) {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(message));
      }
    },
  };
  let windowStart = Date.now();
  let windowCount = 0;
  alive.set(ws, true);
  console.log(`[ws] 连接 ${remote}`);

  ws.on("pong", () => alive.set(ws, true));
  ws.on("message", (data, isBinary) => {
    const now = Date.now();
    if (now - windowStart >= 1000) {
      windowStart = now;
      windowCount = 0;
    }
    if (++windowCount > MESSAGES_PER_SECOND) {
      ws.close(1008, "rate limit");
      return;
    }
    const message = isBinary ? null : parseMessage(data.toString());
    if (!message) {
      conn.send({ t: "error", code: "bad-message", message: "消息格式无效" });
      return;
    }
    registry.handle(conn, message);
  });
  ws.on("close", () => {
    registry.leave(conn);
    console.log(`[ws] 断开 ${remote}`);
  });
  ws.on("error", (error) => console.warn(`[ws] ${remote}`, error.message));
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.get(ws)) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, HEARTBEAT_MS);
const snapshots = setInterval(registry.tick, 1000 / SNAPSHOT_HZ);

function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        out.push(net.address);
      }
    }
  }
  return out;
}

// Another program may hold the same port on loopback only (e.g. wrangler on
// 8787); binding 0.0.0.0 still succeeds on macOS, so verify loopback reaches us.
async function verifyLoopback() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/healthz`, {
      signal: AbortSignal.timeout(2000),
    });
    const body = (await res.json()) as { instance?: string };
    return body.instance === INSTANCE;
  } catch {
    return false;
  }
}

http.on("error", (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `端口 ${PORT} 已被占用，请用 PORT=其他端口 pnpm server 启动`
      : error,
  );
  process.exit(1);
});

http.listen(PORT, HOST, async () => {
  if (!(await verifyLoopback())) {
    console.error(
      `端口 ${PORT} 的本机回环地址被其他程序占用，请用 PORT=其他端口 pnpm server 启动`,
    );
    process.exit(1);
  }
  console.log(`几猫局域网联机服务已启动（协议 v${PROTOCOL_VERSION}）`);
  console.log(`  本机:   http://localhost:${PORT}/`);
  if (HOST === "0.0.0.0" || HOST === "::") {
    for (const address of lanAddresses()) {
      console.log(`  局域网: http://${address}:${PORT}/`);
    }
  }
  console.log(`  WebSocket 路径 ${WS_PATH}，静态目录 ${DIST}`);
});

function shutdown() {
  clearInterval(heartbeat);
  clearInterval(snapshots);
  for (const ws of wss.clients) ws.close(1001, "server shutdown");
  http.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
