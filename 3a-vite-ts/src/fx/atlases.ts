import {
  CanvasTexture,
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";

function fxNoiseTable(i: number) {
  let n = new Float32Array(4096),
    s = i >>> 0,
    o = () => {
      s |= 0;
      s = (s + 1831565813) | 0;
      let l = Math.imul(s ^ (s >>> 15), 1 | s);
      l = (l + Math.imul(l ^ (l >>> 7), 61 | l)) ^ l;
      return ((l ^ (l >>> 14)) >>> 0) / 4294967296;
    };
  for (let l = 0; l < 4096; l++) n[l] = o();
  let r = (l: number, c: number) => {
    let u = Math.floor(l),
      h = Math.floor(c),
      f = l - u,
      p = c - h;
    f = f * f * (3 - 2 * f);
    p = p * p * (3 - 2 * p);
    let d = u & 63,
      v = (u + 1) & 63,
      g = (h & 63) * 64,
      x = ((h + 1) & 63) * 64,
      y = n[g + d],
      b = n[g + v],
      m = n[x + d],
      A = n[x + v];
    return y + (b - y) * f + (m - y + (y - b - m + A) * f) * p;
  };
  return {
    noise: r,
    fbm: (l: number, c: number, u = 4) => {
      let h = 0,
        f = 0.5,
        p = 0;
      for (let d = 0; d < u; d++) {
        h += r(l, c) * f;
        p += f;
        l = l * 2.03 + 17.1;
        c = c * 2.03 + 9.7;
        f *= 0.5;
      }
      return h / p;
    },
    rnd: o,
  };
}
const smoothstepRange = (i: number, e: number, t: number) => {
  let n = (t - i) / (e - i);
  n = n < 0 ? 0 : n > 1 ? 1 : n;
  return n * n * (3 - 2 * n);
};
export const SMOKE_COLS = 4;
export const SMOKE_ROWS = 2;
export function bakeSmokeAtlas(i = 128) {
  let e = i * SMOKE_COLS,
    t = i * SMOKE_ROWS,
    n = new Uint8Array(e * t * 4),
    s = fxNoiseTable(9173),
    o = new Float32Array(i * i),
    r = new Float32Array(i * i),
    a = new Float32Array(i * i);
  for (let c = 0; c < SMOKE_COLS * SMOKE_ROWS; c++) {
    let u = c % SMOKE_COLS,
      h = Math.floor(c / SMOKE_COLS),
      f = c * 13.37 + 3.1,
      p = c * 7.77 + 1.3;
    for (let d = 0; d < i; d++)
      for (let v = 0; v < i; v++) {
        let g = ((v + 0.5) / i) * 2 - 1,
          x = ((d + 0.5) / i) * 2 - 1,
          y =
            1 - smoothstepRange(0.78, 0.98, Math.max(Math.abs(g), Math.abs(x))),
          b: number | undefined,
          m: number | undefined,
          A: number | undefined;
        if (c === 6) {
          let M = x * 0.5 + 0.5,
            E = 0.16 + 0.5 * M * M,
            w = (s.fbm(g * 2 + f, M * 2 + p, 3) - 0.5) * 0.25,
            S = 1 - smoothstepRange(E * 0.3, E, Math.abs(g + w * M)),
            z = s.fbm(g * 9 + f, M * 2.2 + p, 4),
            H =
              1 -
              smoothstepRange(
                0.55,
                0.95,
                M - (s.noise(g * 6 + f, 3.3) - 0.5) * 0.35,
              ),
            O = smoothstepRange(0, 0.12, M);
          b = S * H * O * smoothstepRange(0.22, 0.7, z + 0.25 * (1 - M));
          m = S * H;
          A = b * 0.5;
        } else {
          let M = c === 7,
            E = M ? 0.3 : 0.6,
            w = (s.fbm(g * 1.4 + f, x * 1.4 + p, 3) - 0.5) * E,
            S = (s.fbm(g * 1.4 + p + 5.2, x * 1.4 + f + 1.7, 3) - 0.5) * E,
            z = g + w,
            H = x + S,
            O = Math.sqrt(z * z + H * H),
            q = (s.fbm(z * 2.2 + f, H * 2.2 + p, 3) - 0.5) * 0.6,
            U = 1 - smoothstepRange(0, M ? 0.84 : 0.8, O + q),
            T = s.fbm(z * 4.2 + f * 2, H * 4.2 + p * 2, 5),
            D = U * (M ? 0.8 + 0.7 * T : 0.25 + 1.5 * T);
          b = smoothstepRange(M ? 0.02 : 0.06, M ? 0.7 : 0.95, D);
          m = U;
          A = U * 0.55 + U * s.fbm(z * 3.1 + f * 3, H * 3.1 + p * 3, 3) * 0.9;
        }
        let _ = d * i + v;
        r[_] = b * y;
        a[_] = m;
        o[_] = A * y;
      }
    for (let d = 0; d < i; d++)
      for (let v = 0; v < i; v++) {
        let g = Math.max(0, v - 2),
          x = Math.min(i - 1, v + 2),
          y = Math.max(0, d - 2),
          b = Math.min(i - 1, d + 2),
          m = ((o[d * i + x] - o[d * i + g]) * i) / 8,
          A = ((o[b * i + v] - o[y * i + v]) * i) / 8,
          _ = 0.55,
          M = -m * _,
          E = -A * _,
          w = 1 / Math.sqrt(M * M + E * E + 1);
        M *= w;
        E *= w;
        let S = ((h * i + d) * e + u * i + v) * 4,
          z = d * i + v;
        n[S] = Math.round((M * 0.5 + 0.5) * 255);
        n[S + 1] = Math.round((E * 0.5 + 0.5) * 255);
        n[S + 2] = Math.min(255, a[z] * 255);
        n[S + 3] = Math.min(255, r[z] * 255);
      }
  }
  let l = new DataTexture(n, e, t, RGBAFormat, UnsignedByteType);
  l.magFilter = LinearFilter;
  l.minFilter = LinearMipmapLinearFilter;
  l.generateMipmaps = true;
  l.wrapS = l.wrapT = ClampToEdgeWrapping;
  l.colorSpace = NoColorSpace;
  l.needsUpdate = true;
  return l;
}
export const SPARK_COLS = 4;
export const SPARK_ROWS = 2;
export const SPARK_GLOW = 0;
export const SPARK_STREAK = 1;
export const SPARK_STAR_A = 2;
const SPARK_STAR_B = 3;
export const SPARK_RING = 4;
export const SPARK_FIREBALL = 5;
export const SPARK_DROPLET = 6;
export const SPARK_TRACER = 7;
export function bakeSparkAtlas(i = 128) {
  let e = i * SPARK_COLS,
    t = i * SPARK_ROWS,
    n = new Uint8Array(e * t * 4),
    s = fxNoiseTable(4441),
    o = [0, 1].map(() => {
      let a = 7 + Math.floor(s.rnd() * 4),
        l: { a: number; l: number; w: number; g: number }[] = [];
      for (let c = 0; c < a; c++)
        l.push({
          a: (c / a + (s.rnd() - 0.5) * 0.12) * Math.PI * 2,
          l: 0.35 + s.rnd() * 0.6,
          w: 0.018 + s.rnd() * 0.05,
          g: 0.5 + s.rnd() * 0.5,
        });
      return l;
    });
  for (let a = 0; a < 8; a++) {
    let l = a % SPARK_COLS,
      c = Math.floor(a / SPARK_COLS);
    for (let u = 0; u < i; u++)
      for (let h = 0; h < i; h++) {
        let f = ((h + 0.5) / i) * 2 - 1,
          p = ((u + 0.5) / i) * 2 - 1,
          d = Math.sqrt(f * f + p * p),
          v =
            1 - smoothstepRange(0.86, 0.99, Math.max(Math.abs(f), Math.abs(p))),
          g = 0;
        if (a === SPARK_GLOW) {
          let b = Math.max(0, 1 - d);
          g = b * b * b * 0.75 + Math.exp(-d * d * 22) * 0.5;
        } else if (a === SPARK_STREAK) {
          let b = Math.pow(Math.max(0, 1 - f * f), 1.5);
          g = Math.exp(-(p * p) / (0.42 * 0.42)) * b;
        } else if (a === SPARK_STAR_A || a === SPARK_STAR_B) {
          let b = o[a - SPARK_STAR_A],
            m = Math.atan2(p, f);
          for (let A of b) {
            let _ = Math.abs(m - A.a) % (Math.PI * 2);
            if (_ > Math.PI) {
              _ = Math.PI * 2 - _;
            }
            let M = Math.sin(Math.min(_, 1.5)) * d;
            if (_ < 1.5) {
              g +=
                A.g *
                Math.exp(-(M * M) / (A.w * A.w * (0.4 + d))) *
                Math.pow(Math.max(0, 1 - d / A.l), 1.4);
            }
          }
          g =
            g * (0.7 + 0.6 * s.fbm(f * 5 + a * 9, p * 5, 3)) +
            Math.exp(-d * d * 70) * 1.2 +
            Math.max(0, 1 - d * 2.2) * 0.06;
        } else if (a === SPARK_RING) {
          let b = Math.atan2(p, f),
            m =
              0.78 +
              (s.noise(Math.cos(b) * 2 + 5, Math.sin(b) * 2 + 5) - 0.5) * 0.04;
          g =
            Math.exp(-((d - m) * (d - m)) / (0.03 * 0.03)) *
              (0.6 + 0.4 * s.noise(Math.cos(b) * 5 + 9, Math.sin(b) * 5 + 9)) +
            0.05 *
              smoothstepRange(0.2, 0.78, d) *
              (1 - smoothstepRange(0.78, 0.8, d));
        } else if (a === SPARK_FIREBALL) {
          let b = (s.fbm(f * 1.6 + 3.3, p * 1.6 + 8.1, 3) - 0.5) * 0.5,
            m = (s.fbm(f * 1.6 + 7.7, p * 1.6 + 2.2, 3) - 0.5) * 0.5,
            A = f + b,
            _ = p + m,
            M = Math.sqrt(A * A + _ * _),
            E = 1 - smoothstepRange(0, 0.84, M),
            w = s.fbm(A * 4 + 1.1, _ * 4 + 6.6, 5);
          g =
            smoothstepRange(0.04, 0.9, E * (0.3 + 1.4 * w)) * (0.45 + 0.75 * E);
        } else if (a === SPARK_DROPLET) {
          g = 1 - smoothstepRange(0.3, 0.62, d);
        } else if (a === SPARK_TRACER) {
          let b = f * 0.5 + 0.5,
            m = 0.22 + 0.3 * b,
            A = Math.exp(-(p * p) / (m * m)) * Math.pow(b, 1.8),
            _ = (f - 0.8) / 0.16;
          if (f > 0.8) {
            A *= Math.max(0, 1 - _ * _);
          }
          g = A * 1.15;
        }
        g *= v;
        let x = Math.max(0, Math.min(255, g * 255)),
          y = ((c * i + u) * e + l * i + h) * 4;
        n[y] = n[y + 1] = n[y + 2] = x;
        n[y + 3] = 255;
      }
  }
  let r = new DataTexture(n, e, t, RGBAFormat, UnsignedByteType);
  r.magFilter = LinearFilter;
  r.minFilter = LinearMipmapLinearFilter;
  r.generateMipmaps = true;
  r.wrapS = r.wrapT = ClampToEdgeWrapping;
  r.colorSpace = NoColorSpace;
  r.needsUpdate = true;
  return r;
}
const DECAL_COLS = 4;
const DECAL_ROWS = 2;
export const DECAL_TILES: Record<string, number[]> = {
  bullet_metal: [0, 1],
  bullet_concrete: [2, 3],
  bullet_wood: [4],
  scorch: [5],
  soot: [6],
  bullet_glass: [7],
};
export function bakeDecalAtlas(i = 256) {
  let e = i * DECAL_COLS,
    t = i * DECAL_ROWS,
    n = document.createElement("canvas");
  n.width = e;
  n.height = t;
  let s = document.createElement("canvas");
  s.width = e;
  s.height = t;
  let o = document.createElement("canvas");
  o.width = e;
  o.height = t;
  let r = n.getContext("2d"),
    a = s.getContext("2d"),
    l = o.getContext("2d", {
      willReadFrequently: true,
    });
  l!.fillStyle = "rgb(128,128,128)";
  l!.fillRect(0, 0, e, t);
  let c = (_: number[][], M: number) => {
      let E = l!.createRadialGradient(0, 0, 0, 0, 0, M);
      for (let [w, S] of _) E.addColorStop(w, `rgb(${S},${S},${S})`);
      l!.fillStyle = E;
      l!.beginPath();
      l!.arc(0, 0, M, 0, Math.PI * 2);
      l!.fill();
    },
    h = fxNoiseTable(77123).rnd;
  a!.fillStyle = "rgb(0,235,0)";
  a!.fillRect(0, 0, e, t);
  let f = Math.PI * 2,
    p = (
      _: CanvasRenderingContext2D | null,
      M: number,
      E: number,
      w = 22,
      S = 1,
    ) => {
      _!.beginPath();
      for (let z = 0; z < w; z++) {
        let H = (z / w) * f,
          O = M * (1 + (h() - 0.5) * E),
          q = Math.cos(H) * O,
          U = Math.sin(H) * O * S;
        if (z) {
          _!.lineTo(q, U);
        } else {
          _!.moveTo(q, U);
        }
      }
      _!.closePath();
    },
    d = (
      _: CanvasRenderingContext2D | null,
      M: number,
      E: number,
      w: number,
      S: number,
      z: number,
      H: string,
    ) => {
      _!.beginPath();
      let O = E,
        q = M;
      _!.moveTo(Math.cos(q) * O, Math.sin(q) * O);
      let U = 5 + Math.floor(h() * 4);
      for (let T = 1; T <= U; T++) {
        O = E + ((w - E) * T) / U;
        q += (h() - 0.5) * S;
        _!.lineTo(Math.cos(q) * O, Math.sin(q) * O);
      }
      _!.strokeStyle = H;
      _!.lineWidth = z;
      _!.lineCap = "round";
      _!.lineJoin = "round";
      _!.stroke();
    },
    v = (_: number, M: (M: number) => void) => {
      let E = ((_ % DECAL_COLS) + 0.5) * i,
        w = (Math.floor(_ / DECAL_COLS) + 0.5) * i,
        S = i / 2;
      for (let z of [r, a, l]) {
        z!.save();
        z!.beginPath();
        z!.rect(E - S, w - S, i, i);
        z!.clip();
        z!.translate(E, w);
      }
      M(S);
      r!.restore();
      a!.restore();
      l!.restore();
    },
    g = (
      _: CanvasRenderingContext2D | null,
      M: number,
      E: number,
      w: [number, string][],
    ) => {
      let S = _!.createRadialGradient(0, 0, M, 0, 0, E);
      for (let [z, H] of w) S.addColorStop(z, H);
      return S;
    };
  for (let _ of DECAL_TILES.bullet_metal)
    v(_, (M: number) => {
      r!.fillStyle = g(r, M * 0.1, M * 0.6, [
        [0, "rgba(14,13,12,0.4)"],
        [0.5, "rgba(18,17,16,0.14)"],
        [1, "rgba(20,20,20,0)"],
      ]);
      r!.fillRect(-M, -M, 2 * M, 2 * M);
      let E = 6 + Math.floor(h() * 5);
      for (let T = 0; T < E; T++) {
        let D = h() * f;
        d(
          r,
          D,
          M * 0.2,
          M * (0.38 + h() * 0.45),
          0.3,
          0.8 + h() * 1,
          "rgba(8,8,8,0.55)",
        );
      }
      let w = M * (0.24 + h() * 0.08),
        S = 0.7 + h() * 0.5,
        z = h() * f,
        H = (
          T: number,
          D: number,
          C: number,
          G: number,
          j: number,
          N: number,
        ) => {
          for (let F of [r, a]) {
            F!.save();
            F!.translate(T, D);
            F!.rotate(G);
          }
          let Q: number[] = [];
          for (let F = 0; F < N; F++) Q.push(1 + (h() - 0.5) * j);
          let K = (F: CanvasRenderingContext2D | null, X: number) => {
            F!.beginPath();
            for (let ne = 0; ne < N; ne++) {
              let re = (ne / N) * f,
                $ = C * Q[ne] * X,
                ue = Math.cos(re) * $,
                me = Math.sin(re) * $ * S;
              if (ne) {
                F!.lineTo(ue, me);
              } else {
                F!.moveTo(ue, me);
              }
            }
            F!.closePath();
          };
          K(r, 1);
          r!.lineJoin = "miter";
          r!.strokeStyle = "rgba(92,54,36,0.95)";
          r!.lineWidth = Math.max(1.5, C * 0.14);
          r!.stroke();
          let ie = 150 + Math.floor(h() * 50);
          K(r, 1);
          r!.fillStyle = g(r, 0, C * 1.2, [
            [0, `rgb(${ie - 30},${ie - 26},${ie - 20})`],
            [0.7, `rgb(${ie + 30},${ie + 33},${ie + 36})`],
            [1, `rgb(${ie},${ie + 3},${ie + 6})`],
          ]);
          r!.fill();
          K(a, 1);
          a!.fillStyle = "rgb(0,85,255)";
          a!.fill();
          r!.restore();
          a!.restore();
        };
      H(0, 0, w, z, 0.75, 11);
      let O = 2 + Math.floor(h() * 4);
      for (let T = 0; T < O; T++) {
        let D = h() * f,
          C = w * (1 + h() * 0.7);
        H(
          Math.cos(D) * C,
          Math.sin(D) * C,
          w * (0.15 + h() * 0.3),
          h() * f,
          0.8,
          7,
        );
      }
      for (let T = 0; T < 9; T++) {
        let D = h() * f,
          C = w * 0.3,
          G = w * (0.6 + h() * 0.3);
        r!.beginPath();
        r!.moveTo(Math.cos(D) * C, Math.sin(D) * C);
        r!.lineTo(Math.cos(D + 0.1) * G, Math.sin(D + 0.1) * G);
        r!.strokeStyle =
          h() < 0.5 ? "rgba(245,246,248,0.7)" : "rgba(70,72,76,0.5)";
        r!.lineWidth = 0.8;
        r!.stroke();
      }
      let q = M * (0.1 + h() * 0.025),
        U = 8 + Math.floor(h() * 5);
      for (let T = 0; T < U; T++) {
        if (h() < 0.15) {
          continue;
        }
        let D = ((T + (h() - 0.5) * 0.6) / U) * f,
          C = q * (1.25 + h() * 0.9),
          G = 0.16 + h() * 0.16,
          j = 205 + Math.floor(h() * 50);
        r!.beginPath();
        r!.moveTo(Math.cos(D - G) * q * 0.9, Math.sin(D - G) * q * 0.9);
        r!.lineTo(Math.cos(D) * C, Math.sin(D) * C);
        r!.lineTo(Math.cos(D + G) * q * 0.9, Math.sin(D + G) * q * 0.9);
        r!.closePath();
        r!.fillStyle = `rgb(${j},${j},${Math.min(255, j + 4)})`;
        r!.fill();
        r!.strokeStyle = "rgba(40,40,42,0.6)";
        r!.lineWidth = 0.7;
        r!.stroke();
      }
      a!.beginPath();
      a!.arc(0, 0, q * 1.8, 0, f);
      a!.fillStyle = "rgb(0,60,255)";
      a!.fill();
      p(r, q, 0.3, 11);
      r!.fillStyle = g(r, 0, q, [
        [0, "#000000"],
        [0.8, "#040404"],
        [1, "#141414"],
      ]);
      r!.fill();
      c(
        [
          [0, 0],
          [0.26, 10],
          [0.36, 240],
          [0.5, 200],
          [0.62, 100],
          [1, 128],
        ],
        q * 3.4,
      );
      p(a, q, 0.1, 11);
      a!.fillStyle = "rgb(0,250,0)";
      a!.fill();
    });
  for (let _ of DECAL_TILES.bullet_concrete)
    v(_, (M: number) => {
      r!.fillStyle = g(r, M * 0.2, M * 0.9, [
        [0, "rgba(186,180,168,0.22)"],
        [0.6, "rgba(180,175,165,0.07)"],
        [1, "rgba(170,165,155,0)"],
      ]);
      r!.fillRect(-M, -M, 2 * M, 2 * M);
      let E = 4 + Math.floor(h() * 4);
      for (let O = 0; O < E; O++) {
        let q = h() * f,
          U = M * (0.5 + h() * 0.42);
        d(r, q, M * 0.25, U, 0.35, 1.3 + h() * 1.3, "rgba(20,19,18,0.75)");
        if (h() < 0.5) {
          d(
            r,
            q + (h() - 0.5) * 0.6,
            U * 0.7,
            U * 1.05,
            0.6,
            0.9,
            "rgba(20,19,18,0.5)",
          );
        }
      }
      let w = M * (0.33 + h() * 0.09),
        S = 12,
        z: number[] = [];
      for (let O = 0; O < S; O++) z.push(1 + (h() - 0.5) * 0.6);
      let H = (
        O: CanvasRenderingContext2D | null,
        q: number,
        U: number,
        T: number,
      ) => {
        O!.beginPath();
        for (let D = 0; D < S; D++) {
          let C = (D / S) * f,
            G = w * z[D] * q;
          if (D) {
            O!.lineTo(Math.cos(C) * G + U, Math.sin(C) * G + T);
          } else {
            O!.moveTo(Math.cos(C) * G + U, Math.sin(C) * G + T);
          }
        }
        O!.closePath();
      };
      H(r, 1.05, 1.5, 1.5);
      r!.fillStyle = "rgba(22,21,20,0.8)";
      r!.fill();
      H(r, 1, 0, 0);
      r!.fillStyle = g(r, w * 0.1, w * 1.1, [
        [0, "#35332f"],
        [0.4, "#6f6b63"],
        [0.8, "#8f8b82"],
        [1, "#9a968c"],
      ]);
      r!.fill();
      H(r, 0.97, -1, -1);
      r!.strokeStyle = "rgba(206,201,190,0.55)";
      r!.lineWidth = 1.2;
      r!.stroke();
      for (let O = 0; O < 6; O++) {
        let q = h() * f;
        d(r, q, w * 0.2, w * 0.9, 0.5, 1, "rgba(28,27,25,0.5)");
      }
      for (let O = 0; O < 60; O++) {
        let q = h() * f,
          U = Math.sqrt(h()) * w * 0.85;
        r!.fillStyle =
          h() < 0.55 ? "rgba(36,34,32,0.6)" : "rgba(196,191,180,0.6)";
        r!.beginPath();
        r!.arc(Math.cos(q) * U, Math.sin(q) * U, 0.7 + h() * 2, 0, f);
        r!.fill();
      }
      p(r, w * 0.3, 0.45, 9);
      r!.fillStyle = g(r, 0, w * 0.33, [
        [0, "#060606"],
        [0.7, "#161514"],
        [1, "#2c2a27"],
      ]);
      r!.fill();
      c(
        [
          [0, 0],
          [0.24, 20],
          [0.3, 70],
          [0.8, 112],
          [0.88, 150],
          [1, 128],
        ],
        w * 1.15,
      );
      for (let O = 0; O < 22; O++) {
        let q = h() * f,
          U = w * (1.15 + h() * 1.3);
        r!.fillStyle =
          h() < 0.5 ? "rgba(190,185,175,0.45)" : "rgba(30,29,27,0.45)";
        r!.beginPath();
        r!.arc(Math.cos(q) * U, Math.sin(q) * U, 0.6 + h() * 1.6, 0, f);
        r!.fill();
      }
    });
  for (let _ of DECAL_TILES.bullet_wood)
    v(_, (M: number) => {
      p(r, M * 0.27, 0.7, 11, 1.45);
      r!.fillStyle = "rgba(206,182,140,0.85)";
      r!.fill();
      for (let E = 0; E < 46; E++) {
        let w = (h() - 0.5) * M * 0.62,
          S = M * (0.25 + h() * 0.6) * (1 - Math.abs(w) / (M * 0.4)),
          z = (h() - 0.5) * M * 0.2;
        r!.beginPath();
        r!.moveTo(w, z - S);
        r!.lineTo(w + (h() - 0.5) * 5, z + S);
        r!.strokeStyle =
          h() < 0.5 ? "rgba(236,216,172,0.85)" : "rgba(88,62,38,0.7)";
        r!.lineWidth = 0.8 + h() * 2.2;
        r!.stroke();
      }
      p(r, M * 0.1, 0.5, 9, 1.1);
      r!.fillStyle = g(r, 0, M * 0.12, [
        [0, "#050403"],
        [0.8, "#140f0a"],
        [1, "#3a2a1a"],
      ]);
      r!.fill();
      c(
        [
          [0, 0],
          [0.5, 30],
          [0.8, 140],
          [1, 128],
        ],
        M * 0.17,
      );
    });
  for (let _ of DECAL_TILES.scorch)
    v(_, (M: number) => {
      r!.fillStyle = g(r, 0, M * 0.98, [
        [0, "rgba(6,5,5,0.92)"],
        [0.3, "rgba(10,9,8,0.85)"],
        [0.55, "rgba(22,18,15,0.5)"],
        [0.8, "rgba(30,24,20,0.16)"],
        [1, "rgba(30,24,20,0)"],
      ]);
      r!.fillRect(-M, -M, 2 * M, 2 * M);
      for (let E = 0; E < 90; E++) {
        let w = h() * f,
          S = M * (0.1 + h() * 0.3),
          z = M * (0.5 + h() * 0.46);
        r!.beginPath();
        r!.moveTo(Math.cos(w - 0.03) * S, Math.sin(w - 0.03) * S);
        r!.lineTo(Math.cos(w) * z, Math.sin(w) * z);
        r!.lineTo(Math.cos(w + 0.03) * S, Math.sin(w + 0.03) * S);
        r!.closePath();
        r!.fillStyle = `rgba(8,7,6,${0.12 + h() * 0.3})`;
        r!.fill();
      }
      for (let E = 0; E < 60; E++) {
        let w = h() * f,
          S = M * (0.15 + h() * 0.6);
        r!.fillStyle = h() < 0.3 ? "rgba(150,140,128,0.25)" : "rgba(0,0,0,0.4)";
        r!.beginPath();
        r!.arc(Math.cos(w) * S, Math.sin(w) * S, 1 + h() * 4, 0, f);
        r!.fill();
      }
    });
  for (let _ of DECAL_TILES.soot)
    v(_, (M: number) => {
      for (let E = 0; E < 14; E++) {
        let w = h() * f,
          S = h() * M * 0.3,
          z = M * (0.15 + h() * 0.3),
          H = Math.cos(w) * S,
          O = Math.sin(w) * S,
          q = r!.createRadialGradient(H, O, 0, H, O, z);
        q.addColorStop(0, "rgba(8,8,8,0.4)");
        q.addColorStop(1, "rgba(8,8,8,0)");
        r!.fillStyle = q;
        r!.fillRect(-M, -M, 2 * M, 2 * M);
      }
      p(r, M * 0.1, 0.4, 12);
      r!.fillStyle = "rgba(0,0,0,0.9)";
      r!.fill();
    });
  for (let _ of DECAL_TILES.bullet_glass)
    v(_, (M: number) => {
      r!.fillStyle = g(r, 0, M * 0.5, [
        [0, "rgba(235,240,242,0.55)"],
        [1, "rgba(235,240,242,0)"],
      ]);
      r!.fillRect(-M, -M, 2 * M, 2 * M);
      for (let E = 0; E < 13; E++) {
        let w = ((E + h() * 0.6) / 13) * f;
        d(
          r,
          w,
          M * 0.07,
          M * (0.5 + h() * 0.45),
          0.12,
          0.9 + h(),
          "rgba(240,246,248,0.85)",
        );
      }
      for (let E = 0; E < 3; E++) {
        let w = M * (0.2 + E * 0.17 + h() * 0.05);
        for (let S = 0; S < 9; S++) {
          if (h() < 0.45) {
            continue;
          }
          let z = (S / 9) * f;
          r!.beginPath();
          r!.arc(0, 0, w, z, z + 0.5);
          r!.strokeStyle = "rgba(240,246,248,0.6)";
          r!.lineWidth = 1;
          r!.stroke();
        }
      }
      p(r, M * 0.07, 0.3, 10);
      r!.fillStyle = "#060606";
      r!.fill();
    });
  let x = new CanvasTexture(n);
  x.colorSpace = SRGBColorSpace;
  x.anisotropy = 4;
  let y = new CanvasTexture(s);
  y.colorSpace = NoColorSpace;
  let b = 2 / i,
    m = (_: number) => {
      let M = _ % DECAL_COLS,
        E = Math.floor(_ / DECAL_COLS);
      return [
        (M + b) / DECAL_COLS,
        1 - (E + 1 - b) / DECAL_ROWS,
        (M + 1 - b) / DECAL_COLS,
        1 - (E + b) / DECAL_ROWS,
      ];
    },
    A: CanvasTexture | null = null;
  try {
    let _ = l!.getImageData(0, 0, e, t),
      M = _.data;
    if (M && M.length === e * t * 4) {
      let E = l!.createImageData(e, t),
        w = E.data,
        S = 5 / 255;
      for (let z = 0; z < t; z++) {
        let H = Math.max(0, z - 1) * e,
          O = Math.min(t - 1, z + 1) * e;
        for (let q = 0; q < e; q++) {
          let U = Math.max(0, q - 1),
            T = Math.min(e - 1, q + 1),
            D = (M[(z * e + T) * 4] - M[(z * e + U) * 4]) * S,
            C = (M[(O + q) * 4] - M[(H + q) * 4]) * S,
            G = 1 / Math.sqrt(D * D + C * C + 1),
            j = (z * e + q) * 4;
          w[j] = (-D * G * 0.5 + 0.5) * 255;
          w[j + 1] = (C * G * 0.5 + 0.5) * 255;
          w[j + 2] = (G * 0.5 + 0.5) * 255;
          w[j + 3] = 255;
        }
      }
      l!.putImageData(E, 0, 0);
      A = new CanvasTexture(o);
      A.colorSpace = NoColorSpace;
    }
  } catch {
    A = null;
  }
  return {
    map: x,
    orm: y,
    nrm: A,
    uv: m,
  };
}
