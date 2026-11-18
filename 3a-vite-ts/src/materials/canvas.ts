export const FONT_STENCIL =
  '"PingFang SC", "PingFang SC", "PingFang SC", Impact, "PingFang SC", Arial, sans-serif';
export const FONT_SANS =
  '"PingFang SC", "PingFang SC", "PingFang SC", Arial, sans-serif';
const FONT_MONO = '"PingFang SC", "PingFang SC", Menlo, Consolas, monospace';
export const SIGN_COLORS: Record<string, number[]> = {
  white: [226, 223, 213],
  black: [24, 24, 26],
  yellow: [222, 172, 30],
  red: [168, 36, 28],
  navy: [24, 38, 58],
  orange: [206, 100, 30],
};
export const rgba = (i: any, e = 1) => `rgba(${i[0]},${i[1]},${i[2]},${e})`;
const STENCIL_NO_BRIDGE_CHARS = new Set([
  "I",
  "1",
  " ",
  "-",
  ".",
  "/",
  ":",
  ",",
  "'",
  "!",
  "\xB7",
]);
export function canvasRng(i: number) {
  let e = i >>> 0;
  return () => {
    e |= 0;
    e = (e + 1831565813) | 0;
    let t = Math.imul(e ^ (e >>> 15), 1 | e);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashString(i: string) {
  let e = 2166136261;
  for (let t = 0; t < i.length; t++) {
    e ^= i.charCodeAt(t);
    e = Math.imul(e, 16777619);
  }
  return e >>> 0;
}
export function makeCanvas(i: number, e: number) {
  let t = document.createElement("canvas");
  t.width = i;
  t.height = e;
  return t;
}
export function blobPath(
  i: {
    beginPath: () => void;
    lineTo: (arg0: number, arg1: number) => void;
    moveTo: (arg0: number, arg1: number) => void;
    closePath: () => void;
  },
  e: number,
  t: number,
  n: number,
  s: () => number,
  o = 0.35,
  r = 9,
) {
  i.beginPath();
  for (let a = 0; a < r; a++) {
    let l = (a / r) * Math.PI * 2,
      c = n * (1 - o + s() * o * 2),
      u = e + Math.cos(l) * c,
      h = t + Math.sin(l) * c;
    if (a) {
      i.lineTo(u, h);
    } else {
      i.moveTo(u, h);
    }
  }
  i.closePath();
}
export function weatherCanvas(
  i: any,
  e: number,
  t: number,
  n: number,
  s: () => number,
) {
  if (n <= 0) {
    return;
  }
  i.save();
  i.globalCompositeOperation = "destination-out";
  let o = Math.floor((n * e * t) / 700);
  for (let r = 0; r < o; r++) {
    let a = Math.pow(s(), 3) * t * 0.09 + 0.6;
    i.globalAlpha = 0.45 + s() * 0.55;
    blobPath(i, s() * e, s() * t, a, s, 0.5, 7);
    i.fill();
  }
  i.lineCap = "round";
  for (let r = 0; r < n * 16; r++) {
    let a = s() * e,
      l = s() * t,
      c = (s() - 0.5) * 0.7,
      u = (0.1 + s() * 0.5) * e;
    i.globalAlpha = 0.5 + s() * 0.5;
    i.lineWidth = 0.5 + s() * s() * 3;
    i.beginPath();
    i.moveTo(a, l);
    i.lineTo(a + Math.cos(c) * u, l + Math.sin(c) * u);
    i.stroke();
  }
  i.globalAlpha = 0.8;
  for (let r = 0; r < (n * e * t) / 60; r++)
    i.fillRect(s() * e, s() * t, 1 + s(), 1 + s());
  for (let r = 0; r < n * 6; r++) {
    let a = s() * e,
      l = s() * t,
      c = (0.1 + s() * 0.25) * t,
      u = i.createRadialGradient(a, l, 0, a, l, c);
    u.addColorStop(0, "rgba(0,0,0," + (0.25 + s() * 0.4) + ")");
    u.addColorStop(1, "rgba(0,0,0,0)");
    i.globalAlpha = 1;
    i.fillStyle = u;
    i.fillRect(a - c, l - c, c * 2, c * 2);
  }
  i.restore();
}
export function measureLine(
  i: any,
  e: string,
  t: number,
  n: string,
  s: number,
  o: number,
) {
  i.font = `${s} ${t}px ${n}`;
  let r = 0;
  for (let a of e) r += i.measureText(a).width + o;
  return r - o;
}
export function drawSignText(
  i: any,
  e: string,
  t: number,
  n: number,
  s: number,
  o: string,
  r: {
    weight?: number;
    bridges?: boolean;
    maxW?: number;
    spacing?: number;
    font?: string;
    align?: string;
    fitW?: number;
  } = {},
) {
  let a =
      r.font === "sans"
        ? FONT_SANS
        : r.font === "mono"
          ? FONT_MONO
          : FONT_STENCIL,
    l = r.weight || 700,
    c = r.spacing !== undefined ? r.spacing : s * 0.06,
    u = r.font !== "sans" && r.font !== "mono" && r.bridges !== false,
    h = measureLine(i, e, s, a, l, c),
    f = r.maxW && h > r.maxW ? r.maxW / h : r.fitW ? r.fitW / h : 1,
    p = makeCanvas(Math.ceil(h * f) + 8, Math.ceil(s * 1.4)),
    d = p.getContext("2d");
  d!.font = `${l} ${s}px ${a}`;
  d!.textBaseline = "alphabetic";
  d!.fillStyle = o;
  d!.scale(f, 1);
  let v = 4 / f,
    g = s * 1.08;
  for (let y of e) {
    let b = d!.measureText(y).width;
    d!.fillText(y, v, g);
    if (u && !STENCIL_NO_BRIDGE_CHARS.has(y)) {
      d!.save();
      d!.globalCompositeOperation = "destination-out";
      d!.fillRect(v + b * 0.5 - s * 0.032, 0, s * 0.064, s * 1.4);
      d!.restore();
    }
    v += b + c;
  }
  let x =
    r.align === "center"
      ? t - (h * f) / 2
      : r.align === "right"
        ? t - h * f
        : t;
  i.drawImage(p, x - 4, n - g);
  return h * f;
}
