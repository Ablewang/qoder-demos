import {
  CanvasTexture,
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RGBAFormat,
  RepeatWrapping,
  UnsignedByteType,
} from "three";

export function dataTexture(
  i: Uint8Array<ArrayBuffer>,
  e: number,
  { repeat: t = true, aniso: n = 1 }: { repeat?: boolean; aniso?: number } = {},
) {
  let s = new DataTexture(i, e, e, RGBAFormat, UnsignedByteType);
  s.wrapS = s.wrapT = t ? RepeatWrapping : ClampToEdgeWrapping;
  s.magFilter = LinearFilter;
  s.minFilter = LinearMipmapLinearFilter;
  s.generateMipmaps = true;
  s.anisotropy = n;
  s.colorSpace = NoColorSpace;
  s.needsUpdate = true;
  return s;
}
export const MARKINGS_AREA = {
  x0: -40,
  z0: -30,
  w: 70,
  h: 60,
};
export function paintMarkings(i: number, e = 1) {
  let t = document.createElement("canvas");
  t.width = t.height = i;
  let n = t.getContext("2d");
  n!.fillStyle = "#000";
  n!.fillRect(0, 0, i, i);
  let s = i / MARKINGS_AREA.w,
    o = i / MARKINGS_AREA.h;
  n!.setTransform(s, 0, 0, o, -MARKINGS_AREA.x0 * s, -MARKINGS_AREA.z0 * o);
  n!.globalCompositeOperation = "lighter";
  let r = "#ff0000",
    a = "#00ff00",
    l = '"PingFang SC", "PingFang SC", Impact, "PingFang SC", sans-serif',
    c = 90210,
    u = () => {
      c |= 0;
      c = (c + 1831565813) | 0;
      let A = Math.imul(c ^ (c >>> 15), 1 | c);
      A = (A + Math.imul(A ^ (A >>> 7), 61 | A)) ^ A;
      return ((A ^ (A >>> 14)) >>> 0) / 4294967296;
    },
    h = (
      A: number,
      _: number,
      M: number,
      E: number,
      w: number,
      S: string,
      z?: number[],
    ) => {
      n!.strokeStyle = S;
      n!.lineWidth = w;
      n!.lineCap = "butt";
      n!.setLineDash(z || []);
      n!.beginPath();
      n!.moveTo(A, _);
      n!.lineTo(M, E);
      n!.stroke();
      n!.setLineDash([]);
    },
    f = (A: number, _: number, M: number, E: number, w: number, S: string) => {
      n!.strokeStyle = S;
      n!.lineWidth = w;
      n!.setLineDash([]);
      n!.strokeRect(A, _, M - A, E - _);
    },
    p = (A: number, _: number, M: number, E: number, w: string) => {
      n!.fillStyle = w;
      n!.fillRect(A, _, M - A, E - _);
    },
    d = (A: string, _: number, M: number, E: number, w: number, S: string) => {
      n!.save();
      n!.translate(_, M);
      n!.rotate(w);
      n!.scale(E / 100, E / 100);
      n!.font = `900 100px ${l}`;
      n!.textAlign = "left";
      n!.textBaseline = "middle";
      n!.fillStyle = S;
      let H = -n!.measureText(A).width / 2;
      n!.fillText(A, H, 0);
      n!.globalCompositeOperation = "source-over";
      n!.fillStyle = "#000";
      for (let O of A) {
        let q = n!.measureText(O).width;
        if (!" I1".includes(O)) {
          n!.fillRect(H + q * 0.36, -60, 4.5, 120);
        }
        H += q;
      }
      n!.globalCompositeOperation = "lighter";
      n!.restore();
    },
    v = (
      A: number,
      _: number,
      M: number,
      E: number,
      w: string,
      S = 1.1,
      z = 0.14,
    ) => {
      n!.save();
      n!.beginPath();
      n!.rect(A, _, M - A, E - _);
      n!.clip();
      let H = M - A + (E - _);
      for (let O = 0; O < H; O += S) h(A + O, _, A + O - (E - _), E, z, w);
      n!.restore();
      f(A, _, M, E, 0.15, w);
    },
    g = (A: number, _: number, M: number, E: string) => {
      n!.save();
      n!.translate(A, _);
      n!.scale(M, 1);
      n!.fillStyle = E;
      n!.beginPath();
      n!.moveTo(-1.6, -0.14);
      n!.lineTo(0.5, -0.14);
      n!.lineTo(0.5, -0.5);
      n!.lineTo(1.7, 0);
      n!.lineTo(0.5, 0.5);
      n!.lineTo(0.5, 0.14);
      n!.lineTo(-1.6, 0.14);
      n!.closePath();
      n!.fill();
      n!.restore();
    };
  h(-25.6, 3.6, 16.2, 3.6, 0.15, r);
  h(-25.6, 8.4, -5.6, 8.4, 0.15, r);
  h(10.4, 8.4, 16.2, 8.4, 0.15, r);
  h(-24, 6, -3, 6, 0.12, a, [3, 4.5]);
  h(6, 6, 15.5, 6, 0.12, a, [3, 4.5]);
  h(-23, 14, 16.2, 14, 0.15, r);
  h(-23, 18.6, 16.2, 18.6, 0.15, r);
  h(-23, 16.3, 15.5, 16.3, 0.1, a, [2, 6]);
  h(-23, -3.6, 16.2, -3.6, 0.12, r);
  h(-23, 0.56, 16.2, 0.56, 0.12, r);
  h(-23, 24.2, 16.2, 24.2, 0.12, r);
  h(-37.5, 2.6, -26.4, 2.6, 0.15, a);
  h(-37.5, 9.2, -26.4, 9.2, 0.15, a);
  g(-14, 4.7, 1, a);
  g(13, 7.3, -1, a);
  g(-16, 15.2, 1, a);
  g(2, 17.5, -1, a);
  p(-26.2, 3.6, -25.75, 8.4, a);
  for (let A = 2.75; A < 9; A += 1) p(-31.2, A, -28.2, A + 0.5, a);
  d("减速慢行", -21.4, 6, 1.7, Math.PI / 2, a);
  d("10", -19, 6, 1.8, Math.PI / 2, a);
  n!.strokeStyle = a;
  n!.lineWidth = 0.14;
  n!.beginPath();
  n!.ellipse(-19, 6, 1.35, 1.8, 0, 0, Math.PI * 2);
  n!.stroke();
  h(-30.4, 2.6, -30.4, -10.2, 0.12, a);
  h(-29, 2.6, -29, -8.8, 0.12, a);
  h(-30.4, -10.2, -7, -10.2, 0.12, a);
  h(-29, -8.8, -7, -8.8, 0.12, a);
  for (let A = -28; A < -7.5; A += 2.2) h(A, -10.2, A + 0.9, -8.8, 0.1, a);
  for (let A = -7.5; A < 2; A += 2.2) h(-30.4, A, -29, A + 0.9, 0.1, a);
  let x = [
      [-22.5, -10.3],
      [-5.3, 6.9],
      [10.5, 16.6],
    ],
    y = (A: number, _: number, M: string, E: number, w: number, S: boolean) => {
      x.forEach((z, H) => {
        if (S && H === 1) {
          return;
        }
        let O = H === 2 ? 1 : 2,
          q = _ - A > 4 ? 2 : 1;
        for (let U = 0; U < O; U++)
          for (let T = 0; T < q; T++) {
            let D = z[0] + ((z[1] - z[0]) * U) / O,
              C = z[0] + ((z[1] - z[0]) * (U + 1)) / O,
              G = A + ((_ - A) * T) / q,
              j = A + ((_ - A) * (T + 1)) / q;
            f(D - 0.12, G - 0.12, C + 0.12, j + 0.12, 0.1, a);
          }
        d(M + (H + 1), (z[0] + z[1]) / 2, E, 0.85, w, r);
      });
    };
  y(-6.34, -3.9, "D0", -2.9, Math.PI, false);
  y(0.86, 3.3, "C0", -0.15, 0, false);
  y(8.7, 13.64, "B0", 14.75, Math.PI, true);
  y(18.9, 23.84, "A0", 17.85, 0, false);
  for (let A of [-10.3, -5.3, 6.9, 10.5])
    h(
      A + (A === -10.3 || A === 6.9 ? 0.35 : -0.35),
      -6.3,
      A + (A === -10.3 || A === 6.9 ? 0.35 : -0.35),
      23.8,
      0.1,
      r,
      [1.5, 1.5],
    );
  v(-6.6, -10.9, -0.4, -8.9, r, 0.9, 0.12);
  v(12.2, -22.6, 16.2, -16.4, r);
  v(-0.9, 5.4, 3.9, 9.9, r, 0.95, 0.13);
  d("请勿靠近", 1.5, 10.6, 0.62, 0, r);
  v(19.8, -4.2, 27.2, 4.2, r, 1.2, 0.16);
  d("请勿靠近", 17.4, -19.5, 0.8, Math.PI / 2, r);
  h(16.9, -29.5, 16.9, 27.5, 0.15, r);
  h(17.7, -29.5, 17.7, 27.5, 0.1, r, [1, 1]);
  h(19.3, -29.5, 19.3, 27.5, 0.1, r, [1, 1]);
  h(27.7, -29.5, 27.7, 27.5, 0.1, r, [1, 1]);
  d("四号泊位", 23.5, 21.6, 1.9, 0, a);
  d("四号泊位", 23.5, -7.7, 1.7, Math.PI, a);
  for (let A = -27; A < 27; A += 9)
    d(
      String(400 + Math.round((A + 27) / 9) * 5),
      26.9,
      A + 2,
      0.5,
      Math.PI / 2,
      a,
    );
  n!.lineCap = "round";
  let b = (
    A: number,
    _: number,
    M: number,
    E: number,
    w: number,
    S: number,
  ) => {
    for (let z of [-0.95, 0.95])
      for (let H of [-0.16, 0.16]) {
        n!.strokeStyle = `rgba(0,0,255,${S})`;
        n!.lineWidth = 0.26;
        n!.beginPath();
        n!.moveTo(A, _ + z + H);
        n!.quadraticCurveTo((A + M) / 2, (_ + E) / 2 + w + z + H, M, E + z + H);
        n!.stroke();
      }
  };
  for (let A = 0; A < 46; A++) {
    let _ = u() < 0.68 ? 6 : 16.3,
      M = _ + (u() - 0.5) * 2.6,
      E = -36 + u() * 40,
      w = 8 + u() * 26;
    b(
      E,
      M,
      Math.min(E + w, 28),
      M + (u() - 0.5) * 1.6,
      (u() - 0.5) * 1.4,
      0.1 + u() * 0.22,
    );
  }
  for (let A = 0; A < 12; A++) {
    let _ = u() < 0.5 ? 6 : 16.3,
      M = u() < 0.5 ? -1 : 1,
      E = 0.12 + u() * 0.2;
    n!.strokeStyle = `rgba(0,0,255,${E})`;
    n!.lineWidth = 0.3;
    n!.beginPath();
    n!.moveTo(10 + u() * 4, _ + (u() - 0.5) * 2);
    n!.quadraticCurveTo(21 + u() * 3, _, 22 + u() * 4, _ + M * (8 + u() * 10));
    n!.stroke();
  }
  for (let A = 0; A < 60; A++) {
    let _ = -34 + u() * 62,
      M = -8 + u() * 34,
      E = 0.6 + u() * 2.5,
      w = (u() - 0.5) * 0.5;
    n!.strokeStyle = `rgba(0,0,255,${0.15 + u() * 0.3})`;
    n!.lineWidth = 0.12 + u() * 0.2;
    n!.beginPath();
    n!.moveTo(_, M);
    n!.lineTo(_ + Math.cos(w) * E, M + Math.sin(w) * E);
    n!.stroke();
  }
  let m = new CanvasTexture(t);
  m.flipY = false;
  m.colorSpace = NoColorSpace;
  m.wrapS = m.wrapT = ClampToEdgeWrapping;
  m.minFilter = LinearMipmapLinearFilter;
  m.magFilter = LinearFilter;
  m.generateMipmaps = true;
  m.anisotropy = e;
  m.needsUpdate = true;
  return m;
}
