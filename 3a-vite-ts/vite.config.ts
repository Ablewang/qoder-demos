import { defineConfig } from "vite";

const lanProxy = {
  "/ws": {
    target: `ws://127.0.0.1:${process.env.LAN_PORT ?? 4207}`,
    ws: true,
  },
};

export default defineConfig({
  base: "./",
  server: { host: true, proxy: lanProxy },
  preview: { host: true, proxy: lanProxy },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 2000,
  },
});
