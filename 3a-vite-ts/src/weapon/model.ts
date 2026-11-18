import type { BufferGeometryEventMap, NormalBufferAttributes } from "three";
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SRGBColorSpace,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  Vector3,
} from "three";
import { SKY, SUN } from "../config/world";
import { mergeGeos } from "../utils/geometry";
import {
  FINGERS,
  GLOVE_CUFF,
  GLOVE_CUFF_DARK,
  GLOVE_GUARD,
  GLOVE_PAD,
  GLOVE_PULL_TAB,
  GLOVE_STITCH,
  SEGMENT_GRID_STEPS,
  SLEEVE_BASE,
  SLEEVE_REFLECTIVE,
  SLEEVE_STRIPE,
  SkinBuilder,
  buildHand,
  buildSleeve,
  fingerChain,
  fingerSegment,
  gridEdgeProfile,
  gridSurface,
  hash1,
  mirrorGeo,
  palmBasis,
  palmNormal,
  palmPoint,
  palmProfile,
  signedPow,
  wSmoothstep,
} from "./geometry";

interface HandDef {
  mirror: boolean;
  fingers: (number[] | null)[];
  indexPoses?: number[][];
  thumb: number[][];
  forearm: number[];
  sleeve: number;
  debugParts?: [string, BufferGeometry][] | null;
}
export function buildRifleParts(i: HandDef) {
  let e: BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>[] = [],
    t = i.debugParts || null,
    n = (
      d: string,
      v: BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>,
    ) => (e.push(v), t && t.push([d, v]), v);
  n("palm", buildSleeve());
  {
    let d: number[] = [];
    for (let v = 0; v <= 30; v++) d.push(-1 + v / 15);
    n(
      "guard",
      gridSurface(
        d,
        [-1, -0.9, -0.5, 0, 0.5, 0.9, 1],
        (
          v: number,
          g: number,
          x: { set: (arg0: number, arg1: number, arg2: number) => void },
        ) => {
          let y = -5e-4 + v * 0.0405,
            b = palmProfile(y) + 0.0045 - g * 0.011,
            m = Math.min(gridEdgeProfile(v), gridEdgeProfile(g)),
            A = 0;
          for (let M = 0; M < 4; M++) {
            let E = (y - FINGERS[M].base[0]) / 0.0058;
            A += (M === 3 ? 0.8 : 1) * Math.exp(-E * E);
          }
          A = Math.min(1, A) * (1 - 0.55 * g * g);
          x.set(
            y,
            palmPoint(y, b) +
              (m < 0 ? (g > 0.95 ? -0.008 : -0.003) : (0.0016 + 0.006 * A) * m),
            b,
          );
          let _ = m < 0 ? 0.6 : 0.85 + 1.3 * A;
          return [GLOVE_GUARD[0] * _, GLOVE_GUARD[1] * _, GLOVE_GUARD[2] * _];
        },
      ),
    );
  }
  for (let d = 0; d < 3; d++)
    n(
      "bar",
      fingerSegment(
        0.001,
        -0.034 - d * 0.015,
        0.023 + d * 0.0025,
        0.0052,
        0.0019,
        GLOVE_PAD,
        palmPoint,
      ),
    );
  n(
    "seam",
    fingerSegment(
      0,
      -0.0225,
      0.027,
      0.0013,
      9e-4,
      GLOVE_STITCH.map((d) => d * 0.8),
      palmPoint,
      null,
      false,
      SEGMENT_GRID_STEPS,
      [-1, 0, 1].map((d) => d * 0.9),
    ),
  );
  n(
    "heelPad",
    fingerSegment(
      0.013,
      -0.03,
      0.0135,
      0.017,
      0.0017,
      GLOVE_PAD,
      palmNormal,
      null,
      true,
    ),
  );
  let s: BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>[] = [];
  for (let d = 0; d < 4; d++) {
    if (d === 0 && i.indexPoses) {
      for (let v of i.indexPoses) s.push(fingerChain(FINGERS[0], v));
      continue;
    }
    n("finger" + d, fingerChain(FINGERS[d], i.fingers[d]));
  }
  n("thumb", palmBasis(i.thumb));
  n(
    "web",
    buildHand(
      new Vector3(i.thumb[0][0], i.thumb[0][1], i.thumb[0][2]).normalize(),
    ),
  );
  let o = new Vector3(i.forearm[0], i.forearm[1], i.forearm[2]).normalize(),
    r = i.sleeve || 0.36,
    a = 0.022,
    l = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), o),
    c = new Quaternion(),
    u = new Quaternion(),
    h = (d: Vector3) => (
      u.slerpQuaternions(c, l, wSmoothstep(0.002, 0.042, d.z)),
      (d.z -= a),
      d.applyQuaternion(u),
      (d.z += a),
      d
    );
  {
    let v = new SkinBuilder(24),
      g = new Vector3(),
      x: [number, number, number[], number][] = [
        [-0.0085, -0.0015, GLOVE_CUFF_DARK, 0.6],
        [-0.009, 0.0022, GLOVE_CUFF_DARK, 1.3],
        [-0.006, 0.0026, GLOVE_CUFF_DARK, 1.3],
        [-0.0052, 0.002, GLOVE_CUFF, 0.75],
        [0.004, 0.0014, GLOVE_CUFF, 1],
        [0.011, 0.0016, GLOVE_CUFF, 0.7],
        [0.0122, 0.003, GLOVE_CUFF_DARK, 1.2],
        [0.0305, 0.0032, GLOVE_CUFF_DARK, 1.2],
        [0.0317, 0.0018, GLOVE_CUFF, 0.7],
        [0.04, 0.002, GLOVE_CUFF, 1],
        [0.054, 0.0024, GLOVE_CUFF, 1],
        [0.058, 0.0026, GLOVE_STITCH, 0.7],
        [0.058, -0.004, GLOVE_CUFF, 0.4],
      ];
    for (let [y, b, m, A] of x)
      for (let _ = 0; _ < 24; _++) {
        let M = ((_ + 0.5) / 24) * Math.PI * 2,
          E = Math.sin(M);
        v.v(
          h(
            g.set(
              (0.0296 + b) * signedPow(Math.cos(M), 0.8),
              (E >= 0 ? 0.0185 + b : 0.0204 + b) * signedPow(E, 0.8),
              y,
            ),
          ),
          m,
          A,
        );
      }
    n("cuff", v.geo(true));
  }
  n(
    "strapTab",
    fingerSegment(
      0.009,
      0.0215,
      0.0135,
      0.0076,
      0.0017,
      (d: number) =>
        d > 0.55 ? GLOVE_STITCH.map((v) => v * 0.75) : [9, 9, 9.6],
      (d: number) =>
        0.0217 *
        Math.pow(1 - Math.pow(Math.min(0.999, Math.abs(d / 0.0328)), 2.5), 0.4),
      h,
    ),
  );
  n(
    "pullTab",
    fingerSegment(
      0.003,
      0.004,
      0.0065,
      0.0115,
      0.0022,
      GLOVE_PULL_TAB,
      () => 0.022,
      h,
      true,
    ),
  );
  {
    let d: number[] = [];
    for (let z = 0; z < 24; z++) {
      d.push(z * 15);
      if (z === 4 || z === 16) {
        d.push(z * 15 + 11.5);
      }
      if (z === 5 || z === 17) {
        d.push(z * 15 + 3.5);
      }
    }
    d.sort((z, H) => z - H);
    let v = d.length,
      g = d.indexOf(75),
      x = d.indexOf(255),
      y = new SkinBuilder(v),
      b = new Vector3(),
      m = 0.04 + r,
      A = [
        [0.0415, 0],
        [0.04, 1],
        [0.044, 2],
        [0.049, 3],
        [0.055, 3],
        [0.061, 3],
        [0.0655, 4],
        [0.0685, 5],
      ],
      _ = [0.1415, 0.143, 0.157, 0.1582, 0.1662, 0.1674, 0.181, 0.1825],
      M = _.slice(),
      E = Math.ceil((m - 0.074) / 0.0052);
    for (let z = 0; z <= E; z++) {
      let H = 0.074 + ((m - 0.074) * z) / E;
      if (!_.some((O) => Math.abs(O - H) < 0.0016)) {
        M.push(H);
      }
    }
    M.sort((z, H) => z - H);
    for (let z of M) A.push([z, 6]);
    let w = 0;
    for (let [z, H] of A)
      for (let O = 0; O < v; O++) {
        let q = (d[O] * Math.PI) / 180,
          U: number | undefined,
          T = 1,
          D = SLEEVE_BASE;
        if (H === 0) {
          U = 0.0292;
          T = 0.4;
        } else if (H === 1) {
          U = 0.0372;
          T = 1.15;
        } else if (H === 2) {
          U = 0.0377;
          T = 1.1;
        } else if (H === 3) {
          let C = Math.cos(q * 12);
          U = 0.0368 + 0.0012 * C;
          T = 0.62 + 0.26 * C;
        } else if (H === 4) {
          U = 0.0356;
          T = 0.55;
        } else if (H === 5) {
          U = 0.038;
          T = 0.9;
        } else {
          let C = (z - 0.0685) / (m - 0.0685),
            G = 0.0048 * Math.exp(-Math.pow((C - 0.13) / 0.11, 2)),
            j = 0.0048 * wSmoothstep(0.62, 0.85, C),
            N =
              Math.pow(
                Math.abs(
                  Math.sin(
                    (Math.PI * z) / 0.027 +
                      1.7 * Math.sin(q + 0.5) +
                      0.8 * Math.sin(2 * q + 1.3),
                  ),
                ),
                0.6,
              ) *
                2 -
              1.25,
            Q =
              Math.pow(
                Math.abs(
                  Math.sin(
                    (Math.PI * z) / 0.034 +
                      1.9 * Math.sin(q - 0.8) +
                      0.7 * Math.sin(2 * q),
                  ),
                ),
                0.6,
              ) *
                2 -
              1.25,
            K =
              Math.sin(z * 40 + 2 * Math.sin(q * 2 + 1)) +
              0.6 * Math.sin(3 * q + z * 25);
          U =
            0.0405 +
            0.012 * Math.pow(C, 0.85) +
            0.0025 * Math.exp(-Math.pow((z - 0.082) / 0.012, 2)) +
            G * N +
            j * Q +
            0.0016 * K;
          T =
            0.78 +
            0.26 * wSmoothstep(-1.1, 0.5, (G * N + j * Q) / (G + j + 8e-4)) +
            0.04 * K;
          let ie = hash1(w);
          if (z > 0.1575 && z < 0.167) {
            D = SLEEVE_REFLECTIVE;
            T *= 0.85 + 0.25 * ie;
          } else if (z > 0.1425 && z < 0.1815) {
            D = SLEEVE_STRIPE;
            T *= 0.78 + 0.3 * ie;
          }
        }
        if (H > 0) {
          if (O === g || O === x) {
            U += 0.0019;
            T *= 1.3;
          } else if (Math.abs(O - g) === 1 || Math.abs(O - x) === 1) {
            T *= 0.52;
          }
        }
        b.set(Math.cos(q) * U, Math.sin(q) * U * 0.84, z);
        y.v(b, D, T);
        w++;
      }
    for (let z = 0; z < v; z++) y.v(b.set(0, 0, m + 0.006), SLEEVE_BASE, 0.3);
    y.collapse();
    let S = y.geo(true);
    S.applyMatrix4(
      new Matrix4()
        .makeTranslation(0, 0, a)
        .multiply(new Matrix4().makeRotationFromQuaternion(l))
        .multiply(new Matrix4().makeTranslation(0, 0, -a)),
    );
    n("sleeve", S);
  }
  let p = {
    fabric: mergeGeos(e),
    rubber: null,
    index: s.length ? s : null,
    knuckle: FINGERS[0].base.slice(),
  };
  if (i.mirror) {
    mirrorGeo(p.fabric);
    if (p.index) {
      p.index.forEach(mirrorGeo);
    }
    p.knuckle[0] *= -1;
  }
  return p;
}
const MARKING_LAYOUT: Record<string, number[]> = {
  model: [8, 8, 330, 84],
  maker: [8, 100, 560, 40],
  cal: [8, 146, 560, 40],
  prop: [8, 192, 700, 40],
  safe: [8, 240, 90, 34],
  semi: [110, 240, 90, 34],
  auto: [212, 240, 90, 34],
  rack: [8, 290, 300, 110],
  warn: [330, 290, 420, 110],
  optic: [580, 8, 300, 60],
  light: [580, 76, 300, 60],
  dots: [320, 240, 60, 34],
  r2: [8, 420, 56, 40],
  r4: [72, 420, 56, 40],
  r6: [136, 420, 56, 40],
  r8: [200, 420, 56, 40],
  r10: [264, 420, 56, 40],
  r12: [328, 420, 56, 40],
};
const RIFLE_MARKINGS_W = 1024;
const RIFLE_MARKINGS_H = 512;
function paintRifleMarkings() {
  let i = document.createElement("canvas");
  i.width = RIFLE_MARKINGS_W;
  i.height = RIFLE_MARKINGS_H;
  let e = i.getContext("2d");
  e!.clearRect(0, 0, RIFLE_MARKINGS_W, RIFLE_MARKINGS_H);
  e!.textBaseline = "middle";
  let t = (u: string, h: string, f: string, p: string, d = "left") => {
      let [v, g, x, y] = MARKING_LAYOUT[u];
      e!.font = f;
      e!.fillStyle = p;
      e!.textAlign = d as CanvasTextAlign;
      e!.fillText(h, d === "left" ? v + 2 : v + x / 2, g + y / 2 + 1, x - 4);
    },
    n = '"PingFang SC", "PingFang SC", Arial, sans-serif',
    s = '"PingFang SC", "PingFang SC", monospace',
    o = '"PingFang SC", "PingFang SC", Impact, sans-serif',
    r = "rgba(196,198,194,0.92)";
  t("model", "PAC-9", `700 78px ${o}`, r);
  t("maker", "几猫兵工厂 · 港区装备", `600 30px ${n}`, r);
  t("cal", "CAL 5.8\xD740   SN PA-004217", `500 27px ${s}`, r);
  t("prop", "港务局装备 · 四号泊位武器库", `600 28px ${n}`, r);
  t("safe", "S", `700 30px ${n}`, r, "center");
  t("semi", "1", `700 30px ${n}`, r, "center");
  t("auto", "A", `700 30px ${n}`, "rgba(205,60,40,0.95)", "center");
  t("rack", "B4-07", `800 104px ${o}`, "rgba(214,206,170,0.9)", "center");
  for (let u of [2, 4, 6, 8, 10, 12])
    t("r" + u, "T" + u, `600 30px ${s}`, "rgba(190,192,188,0.85)", "center");
  t("optic", "HX-2 反射瞄具", `700 44px ${n}`, r, "center");
  t("light", "900 LM  IPX8", `600 40px ${n}`, r, "center");
  {
    let [u, h] = MARKING_LAYOUT.warn;
    e!.fillStyle = r;
    e!.textAlign = "left";
    e!.font = `600 24px ${n}`;
    [
      "警告：存放前必须清空弹膛",
      "仅限授权突击队员使用",
      "港务安全规程 44/7",
    ].forEach((f, p) => e!.fillText(f, u + 2, h + 20 + p * 34));
  }
  {
    let [u, h, f, p] = MARKING_LAYOUT.dots;
    e!.fillStyle = r;
    e!.beginPath();
    e!.arc(u + 12, h + p / 2, 7, 0, 7);
    e!.fill();
    e!.fillStyle = "rgba(205,60,40,0.95)";
    e!.beginPath();
    e!.arc(u + 40, h + p / 2, 7, 0, 7);
    e!.fill();
  }
  e!.globalCompositeOperation = "destination-out";
  let a = 7,
    l = () => ((a = (a * 16807) % 2147483647), a / 2147483647);
  for (let u = 0; u < 2600; u++) {
    e!.fillStyle = `rgba(0,0,0,${0.25 + l() * 0.6})`;
    let h = l() < 0.9 ? 1 + l() * 1.5 : 2 + l() * 5;
    e!.fillRect(
      l() * RIFLE_MARKINGS_W,
      l() * RIFLE_MARKINGS_H,
      h,
      h * (0.4 + l()),
    );
  }
  let c = new CanvasTexture(i);
  c.colorSpace = SRGBColorSpace;
  c.anisotropy = 8;
  c.generateMipmaps = true;
  c.minFilter = LinearMipmapLinearFilter;
  return c;
}
export function markingDecals(
  i: [string, number, number, number, number, string, number?][],
) {
  let e: any[] = [],
    t: number[] = [],
    n: number[] = [],
    s: number[] = [];
  for (let [l, c, u, h, f, p, d = 0] of i) {
    let [v, g, x, y] = MARKING_LAYOUT[l],
      b = (f * x) / y,
      m = v / RIFLE_MARKINGS_W,
      A = (v + x) / RIFLE_MARKINGS_W,
      _ = 1 - g / RIFLE_MARKINGS_H,
      M = 1 - (g + y) / RIFLE_MARKINGS_H,
      E = e.length / 3,
      w: any;
    if (p === "L") {
      w = [
        [c, u - f / 2, -(h + b / 2)],
        [c, u - f / 2, -(h - b / 2)],
        [c, u + f / 2, -(h - b / 2)],
        [c, u + f / 2, -(h + b / 2)],
      ];
    } else if (p === "R") {
      w = [
        [c, u - f / 2, -(h - b / 2)],
        [c, u - f / 2, -(h + b / 2)],
        [c, u + f / 2, -(h + b / 2)],
        [c, u + f / 2, -(h - b / 2)],
      ];
    } else {
      w = [
        [c - b / 2, u, -(h - f / 2)],
        [c + b / 2, u, -(h - f / 2)],
        [c + b / 2, u, -(h + f / 2)],
        [c - b / 2, u, -(h + f / 2)],
      ];
    }
    if (d) {
      let z = Math.cos(d),
        H = Math.sin(d),
        O = u,
        q = -h;
      for (let U of w) {
        let T = U[1] - O,
          D = U[2] - q;
        U[1] = O + T * z - D * H;
        U[2] = q + T * H + D * z;
      }
    }
    for (let z of w) e.push(z[0], z[1], z[2]);
    t.push(m, M, A, M, A, _, m, _);
    let S = p === "L" ? [-1, 0, 0] : p === "R" ? [1, 0, 0] : [0, 1, 0];
    for (let z = 0; z < 4; z++) n.push(S[0], S[1], S[2]);
    s.push(E, E + 1, E + 2, E, E + 2, E + 3);
  }
  let o = new BufferGeometry();
  o.setAttribute("position", new Float32BufferAttribute(e, 3));
  o.setAttribute("uv", new Float32BufferAttribute(t, 2));
  o.setAttribute("normal", new Float32BufferAttribute(n, 3));
  o.setIndex(s);
  let r = new MeshStandardMaterial({
      map: paintRifleMarkings(),
      transparent: true,
      roughness: 0.62,
      metalness: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
      side: DoubleSide,
    }),
    a = new Mesh(o, r);
  a.renderOrder = 2;
  return a;
}
export function extrudeOutline(i: number[][], e: number) {
  let t = new Shape();
  i.forEach((r, a) => (a ? t.lineTo(r[0], r[1]) : t.moveTo(r[0], r[1])));
  t.closePath();
  let n = new ShapeGeometry(t);
  n.translate(0, 0, -e);
  {
    let r = 1e9,
      a = -1e9,
      l = 1e9,
      c = -1e9;
    for (let f of i) {
      r = Math.min(r, f[0]);
      a = Math.max(a, f[0]);
      l = Math.min(l, f[1]);
      c = Math.max(c, f[1]);
    }
    let u = n.attributes.position,
      h = n.attributes.uv;
    for (let f = 0; f < u.count; f++)
      h.setXY(f, (u.getX(f) - r) / (a - r), (u.getY(f) - l) / (c - l));
  }
  let s = new ShaderMaterial({
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uBright: {
          value: 7,
        },
        uSun: {
          value: SUN.dir.clone(),
        },
        uSunCol: {
          value: SUN.color.clone(),
        },
        uZen: {
          value: SKY.zenith.clone(),
        },
        uHor: {
          value: SKY.horizonAway.clone(),
        },
        uTilt: {
          value: 0.1,
        },
      },
      vertexShader: `
      varying vec3 vView, vFwd, vRight, vUp, vWPos, vWN; varying vec2 vUv;
      uniform float uTilt;
      void main(){
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = mv.xyz;
        vFwd = (modelViewMatrix * vec4(0.0, 0.0, -1.0, 0.0)).xyz; vRight = (modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz; vUp = (modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
        vWPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vWN = normalize(mat3(modelMatrix) * normalize(vec3(0.0, -uTilt, 1.0)));   // real sights tilt the glass a few degrees
        gl_Position = projectionMatrix * mv;
      }`,
      fragmentShader: `
      varying vec3 vView, vFwd, vRight, vUp, vWPos, vWN; varying vec2 vUv;
      uniform float uBright; uniform vec3 uSun, uSunCol, uZen, uHor;
      void main(){
        vec3 d = normalize(vView), fw = normalize(vFwd);
        float k = max(dot(d, fw), 1e-3);
        vec2 a = vec2(dot(d, normalize(vRight)), dot(d, normalize(vUp))) / k;      // tangent of the angle off the bore axis
        float r = length(a), px = max(fwidth(r), 1e-5);
        float dotR = max(0.0011, px * 0.9), ringW = max(0.00045, px * 0.6);
        float dotI = 1.0 - smoothstep(dotR - px, dotR + px, r);
        float ring = 1.0 - smoothstep(ringW - px * 0.5, ringW + px, abs(r - 0.0128));
        float ang = atan(a.y, a.x);
        float tick = (1.0 - smoothstep(0.0, px * 1.2 + 0.0004, min(abs(a.x), abs(a.y)))) * step(0.0128, r) * (1.0 - smoothstep(0.0165, 0.0175, r));
        float ret = clamp(dotI + ring * 0.8 + tick * 0.8, 0.0, 1.0);
        // faint halo so the bloom has something to hold on to
        ret += 0.05 * exp(-r * r / 0.00002);
        vec3 retCol = vec3(1.0, 0.11, 0.045) * ret * uBright;
        // coated glass: sky/sun reflection through a ruby-teal dichroic coating, stronger at grazing angles
        vec3 wv = normalize(vWPos - cameraPosition); vec3 n = normalize(vWN); if (dot(n, wv) > 0.0) n = -n;
        vec3 rf = reflect(wv, n);
        float fres = pow(1.0 - abs(dot(wv, n)), 3.0);
        vec3 sky = mix(uHor, uZen, clamp(rf.y * 1.4 + 0.2, 0.0, 1.0));
        float sd = max(dot(rf, uSun), 0.0);
        sky += uSunCol * (pow(sd, 6.0) * 0.6 + pow(sd, 90.0) * 6.0);
        // blue -> amber dichroic coating across the glass, a soft diagonal sheen band, and a thin dark edge
        float band = smoothstep(0.25, 0.5, vUv.x * 0.6 + vUv.y) * (1.0 - smoothstep(0.62, 0.95, vUv.x * 0.6 + vUv.y));
        vec3 coat = mix(vec3(0.30, 0.50, 0.95), vec3(1.0, 0.62, 0.28), clamp(fres * 2.2 + vUv.y * 0.75 - 0.15, 0.0, 1.0));
        vec2 e = abs(vUv - 0.5) * 2.0; float edge = smoothstep(0.90, 1.0, max(e.x, e.y));
        float refl = 0.12 + 0.60 * fres + 0.07 * band;
        // faint emitter glow that stays visible off-axis (what you see of a powered sight from the hip)
        vec2 eg = (vUv - vec2(0.5, 0.16)) * vec2(1.0, 1.6); retCol += vec3(1.0, 0.10, 0.04) * 0.20 * exp(-dot(eg, eg) * 60.0) * (1.0 - smoothstep(0.985, 0.9995, k));
        vec3 col = (sky * 1.5 + vec3(0.03, 0.035, 0.045)) * coat * refl * (1.0 - edge) + retCol;
        float alpha = clamp(0.20 + 0.32 * fres + 0.05 * band + 0.6 * edge, 0.0, 0.94);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
    o = new Mesh(n, s);
  o.renderOrder = 5;
  return o;
}
export function buildOptics() {
  let i: number[] = [],
    e: number[] = [],
    t: number[] = [],
    n: number[] = [],
    s = (d: number[], v: number[], g: number[], x: number[], y: number) => {
      let b = i.length / 3;
      for (let m of [d, v, g, x]) i.push(m[0], m[1], m[2]);
      e.push(0, 0, 1, 0, 1, 1, 0, 1);
      for (let m = 0; m < 4; m++) t.push(y);
      n.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
  s(
    [-0.13, -0.13, -0.03],
    [0.13, -0.13, -0.03],
    [0.13, 0.13, -0.03],
    [-0.13, 0.13, -0.03],
    0,
  );
  s(
    [-0.13 * 0.7, -0.13 * 0.7, -0.09],
    [0.13 * 0.7, -0.13 * 0.7, -0.09],
    [0.13 * 0.7, 0.13 * 0.7, -0.09],
    [-0.13 * 0.7, 0.13 * 0.7, -0.09],
    0,
  );
  let r = 0.065,
    a = 0.34;
  s([-r, 0, 0.01], [r, 0, 0.01], [r, 0, -a], [-r, 0, -a], 1);
  s([0, -r, 0.01], [0, r, 0.01], [0, r, -a], [0, -r, -a], 1);
  let l = 0.17,
    c = 0.05,
    u = 0.035;
  s([-l, -c, u], [l, -c, u], [l, c, u], [-l, c, u], 2);
  s([-l, 0, u + c], [l, 0, u + c], [l, 0, u - c], [-l, 0, u - c], 2);
  s(
    [-0.05, -0.05, -0.01],
    [0.05, -0.05, -0.01],
    [0.05, 0.05, -0.01],
    [-0.05, 0.05, -0.01],
    3,
  );
  s(
    [-0.03, -0.03, 0.02],
    [0.03, -0.03, 0.02],
    [0.03, 0.03, 0.02],
    [-0.03, 0.03, 0.02],
    4,
  );
  let h = new BufferGeometry();
  h.setAttribute("position", new Float32BufferAttribute(i, 3));
  h.setAttribute("uv", new Float32BufferAttribute(e, 2));
  h.setAttribute("aType", new Float32BufferAttribute(t, 1));
  h.setIndex(n);
  let f = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: {
        uSeed: {
          value: 0,
        },
        uInt: {
          value: 0,
        },
        uHeat: {
          value: 0,
        },
        uJet: {
          value: 1,
        },
      },
      vertexShader: `attribute float aType; varying vec2 vUv; varying float vType;
      void main(){ vUv = uv; vType = aType; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec2 vUv; varying float vType; uniform float uSeed, uInt, uHeat, uJet;
      float h1(float n){ return fract(sin(n * 127.1 + uSeed * 311.7) * 43758.5453); }
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x); float I = 0.0; vec3 tintc = vec3(1.0, 0.50, 0.16);
        if (vType < 0.5) {
          float n1 = 3.0 + floor(h1(1.0) * 3.0), n2 = 5.0 + floor(h1(2.0) * 4.0);
          float pet = pow(abs(cos(a * n1 * 0.5 + h1(3.0) * 6.283)), 5.0) * (0.55 + 0.45 * h1(4.0));
          pet += pow(abs(cos(a * n2 * 0.5 + h1(5.0) * 6.283)), 14.0) * 0.55;
          float reach = 0.35 + 0.65 * pet;
          I = (0.25 + pet) * smoothstep(reach, reach * 0.15, r) * (0.75 + 0.25 * sin(r * 26.0 + h1(6.0) * 20.0));
        } else if (vType < 1.5) {
          float y = vUv.y, x = p.x * (1.0 + 0.5 * sin(y * 17.0 + h1(7.0) * 30.0) * y);
          float wdt = mix(0.20, 0.75, smoothstep(0.0, 0.35, y)) * (1.0 - y * 0.75);
          I = exp(-x * x / (wdt * wdt * 0.35)) * pow(1.0 - y, 1.4) * (0.7 + 0.3 * sin(y * 31.0 + h1(8.0) * 9.0)) * 0.9;
        } else if (vType < 2.5) {
          float u = abs(p.x), len = 0.55 + 0.45 * h1(9.0 + step(0.0, p.x));
          float wv = p.y * (1.0 + u * 3.0) + 0.12 * sin(u * 14.0 + h1(10.0) * 20.0) * u;
          I = exp(-wv * wv * 22.0) * smoothstep(len, 0.06, u) * smoothstep(0.02, 0.10, u) * 0.85 * uJet;
        } else if (vType < 3.5) {
          I = exp(-r * r * 5.0) * 2.4 * smoothstep(1.0, 0.6, r); tintc = vec3(1.0, 0.82, 0.58);
        } else {
          gl_FragColor = vec4(vec3(1.0, 0.28, 0.06) * exp(-r * r * 4.0) * smoothstep(1.0, 0.5, r) * uHeat, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }
        vec3 col = mix(tintc, vec3(1.0, 0.90, 0.70), clamp(I * I * 0.7, 0.0, 1.0)) * I * uInt;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
    p = new Mesh(h, f);
  p.renderOrder = 10;
  p.frustumCulled = false;
  return p;
}
