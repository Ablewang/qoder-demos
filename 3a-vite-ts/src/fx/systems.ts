import type { GameContext } from "../types/context";
import type {
  BufferGeometryEventMap,
  DataTexture,
  DepthTexture,
  InstancedMeshEventMap,
  NormalBufferAttributes,
  Object3DEventMap,
  PerspectiveCamera,
} from "three";
import {
  AddEquation,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  DoubleSide,
  DynamicDrawUsage,
  Euler,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  Quaternion,
  ShaderMaterial,
  Vector2,
  Vector3,
  ZeroFactor,
} from "three";
import { DECAL_TILES, bakeDecalAtlas } from "./atlases";

const BILLBOARD_VERT = `
attribute vec4 aPos;    // xyz centre, w size (m)
attribute vec4 aAxis;   // mode 1: stretch axis (length = streak length); mode 2: plane normal; w = roll (rad)
attribute vec4 aCol;    // rgb (HDR), a
attribute vec4 aMisc;   // x atlas frame, y mode (0 billboard, 1 velocity-stretched, 2 surface-aligned), z age 0..1, w sun visibility
uniform vec2 uAtlas;
uniform float uPx;      // world size of one pixel at distance 1
varying vec2 vUv;
varying vec4 vCol;
varying vec3 vOff;
varying vec3 vToCam;
varying vec3 vInfo;     // view z, age, shade
varying float vSoftD;
varying vec3 vT;
varying vec3 vB;
void main() {
  vec2 c = position.xy;
  vec3 center = aPos.xyz; float size = aPos.w; float mode = aMisc.y;
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 toCam = cameraPosition - center; float dist = length(toCam); toCam /= max(dist, 1e-4);
  float sn = sin(aAxis.w), cs = cos(aAxis.w);
  vec2 rc = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
  vec3 off; float comp = 1.0;
  if (mode < 0.5) {
    off = (camR * rc.x + camU * rc.y) * size;
    vT = camR * cs + camU * sn; vB = camU * cs - camR * sn;
  } else if (mode < 1.5) {
    float len = length(aAxis.xyz); vec3 d = aAxis.xyz / max(len, 1e-5);
    vec3 side = cross(d, toCam); float sl = length(side); side = sl > 1e-3 ? side / sl : camR;
    float w = max(size, dist * uPx * 1.4); comp = size / w;
    if (aMisc.w > 1.5) w = min(w, dist * uPx * aMisc.w);       // additive only: cap on-screen width (tracers near the lens)
    off = d * (c.x * max(len, w)) + side * (c.y * w);
    vT = d; vB = side;
  } else {
    vec3 n = normalize(aAxis.xyz);
    vec3 t = normalize(abs(n.y) > 0.9 ? cross(n, vec3(1.0, 0.0, 0.0)) : cross(vec3(0.0, 1.0, 0.0), n));
    vec3 b = cross(n, t);
    off = (t * rc.x + b * rc.y) * size;
    vT = t * cs + b * sn; vB = b * cs - t * sn;
  }
  vec4 mv = viewMatrix * vec4(center + off, 1.0);
  gl_Position = projectionMatrix * mv;
  float f = floor(aMisc.x + 0.5);
  float col = mod(f, uAtlas.x), row = floor(f / uAtlas.x);
  vUv = (vec2(col, row) + c + 0.5) / uAtlas;
  vCol = vec4(aCol.rgb * comp, aCol.a);
  vOff = off / max(size, 1e-4);
  vToCam = toCam;
  vInfo = vec3(mv.z, aMisc.z, aMisc.w);
  vSoftD = clamp(size * 0.4, 0.04, 0.7);
}`;
const BILLBOARD_FRAG_COMMON = `
uniform sampler2D uTex;
uniform sampler2D uDepth;
uniform vec2 uRes;
uniform vec2 uNearFar;
uniform float uSoft;
varying vec2 vUv;
varying vec4 vCol;
varying vec3 vOff;
varying vec3 vToCam;
varying vec3 vInfo;
varying float vSoftD;
varying vec3 vT;
varying vec3 vB;
float softFade() {
  float s = 1.0;
  if (uSoft > 0.5) {
    float d = texture2D(uDepth, gl_FragCoord.xy / uRes).x;
    float zs = (uNearFar.x * uNearFar.y) / ((uNearFar.y - uNearFar.x) * d - uNearFar.y);
    s = clamp((vInfo.x - zs) / vSoftD, 0.0, 1.0);
  }
  return s;
}`;
const BILLBOARD_LIT_FRAG =
  BILLBOARD_FRAG_COMMON +
  `
uniform vec3 uSun, uSunDir, uAmbLo, uAmbHi;
void main() {
  vec4 t = texture2D(uTex, vUv);
  float er = vInfo.y * 0.45;                                  // wisps erode as the puff ages
  float a = smoothstep(er, er + (vInfo.z > 1.5 ? 0.38 : 0.6), t.a) * vCol.a;   // fire lobes: denser body, crisper edge
  a *= softFade() * smoothstep(0.2, 0.9, -vInfo.x);           // soft intersection + fade right at the lens
  if (a < 0.004) discard;
  vec3 V = normalize(vToCam);
  vec3 q = vOff * 2.0; float r2 = min(dot(q, q), 1.0);
  vec3 Ns = q + V * (sqrt(1.0 - r2) * 0.9 + 0.05);            // overall sphere normal
  vec2 tn = t.rg * 2.0 - 1.0;                                 // billow normal from the flipbook
  vec3 Nb = vT * tn.x + vB * tn.y + V * sqrt(max(1.0 - dot(tn, tn), 0.0));
  vec3 N = normalize(Ns * 0.55 + Nb);
  float wrap = clamp((dot(N, uSunDir) + 0.45) / 1.45, 0.0, 1.0);
  float back = pow(clamp(dot(-V, uSunDir), 0.0, 1.0), 5.0);   // looking into the sun: forward scatter through thin edges
  float thin = 1.0 - t.b * smoothstep(0.0, 0.5, a);
  float hot = step(1.5, vInfo.z), shade = vInfo.z - 2.0 * hot;      // aMisc.w >= 2: emissive fire lobe (colour = emission)
  vec3 sun = uSun * (wrap * wrap * 0.85 + back * (0.15 + 1.3 * thin)) * shade;
  vec3 amb = mix(uAmbLo, uAmbHi, N.y * 0.5 + 0.5) * (1.0 - 0.35 * t.b);
  vec3 col = vCol.rgb * (amb + sun);
  if (hot > 0.5) {
    // alpha-blended fire: hot dense cores, dim orange skin, soot underneath. Because it is NOT additive, overlapping lobes
    // keep their shape and smoke in front can occlude them.
    float lump = clamp(dot(tn, vec2(0.6, 0.8)) * 0.6 + 0.5, 0.0, 1.0);
    float core = t.b * t.b * smoothstep(0.15, 0.9, t.a);
    vec3 fire = vCol.rgb * (0.10 + 1.7 * core) * (0.45 + 1.1 * lump);
    col = vec3(0.045, 0.042, 0.04) * (amb + sun) + fire;
  }
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb *= gl_FragColor.a;                         // premultiply after the (possibly no-op) output transform
}`;
const BILLBOARD_ADDITIVE_FRAG =
  BILLBOARD_FRAG_COMMON +
  `
void main() {
  float t = texture2D(uTex, vUv).r;
  float k = t * vCol.a * softFade();
  if (k < 0.002) discard;
  gl_FragColor = vec4(vCol.rgb * k, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const _billboardBufferSize = new Vector2();
export function createBillboardSystem(
  i: GameContext,
  e: number,
  {
    lit: t,
    tex: n,
    cols: s,
    rows: o,
    renderOrder: r,
    sun: a,
    sunDir: l,
    ambLo: c,
    ambHi: u,
  }: {
    lit: boolean;
    tex: DataTexture;
    cols: number;
    rows: number;
    renderOrder: number;
    sun?: Vector3;
    sunDir?: Vector3;
    ambLo?: Vector3;
    ambHi?: Vector3;
  },
) {
  let h = new InstancedBufferGeometry();
  h.setAttribute(
    "position",
    new BufferAttribute(
      new Float32Array([
        -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
      ]),
      3,
    ),
  );
  h.setIndex([0, 1, 2, 0, 2, 3]);
  let f = (S: string) => {
      let z = new InstancedBufferAttribute(new Float32Array(e * 4), 4);
      z.setUsage(DynamicDrawUsage);
      h.setAttribute(S, z);
      return z;
    },
    p = f("aPos"),
    d = f("aAxis"),
    v = f("aCol"),
    g = f("aMisc");
  h.instanceCount = 0;
  let x = {
    uTex: {
      value: n,
    },
    uAtlas: {
      value: new Vector2(s, o),
    },
    uPx: {
      value: 0.001,
    },
    uDepth: {
      value: null as DepthTexture | null,
    },
    uRes: {
      value: new Vector2(1, 1),
    },
    uNearFar: {
      value: new Vector2(0.08, 900),
    },
    uSoft: {
      value: 0,
    },
  };
  if (t) {
    Object.assign(x, {
      uSun: {
        value: a,
      },
      uSunDir: {
        value: l,
      },
      uAmbLo: {
        value: c,
      },
      uAmbHi: {
        value: u,
      },
    });
  }
  let y = new ShaderMaterial({
    uniforms: x,
    vertexShader: BILLBOARD_VERT,
    fragmentShader: t ? BILLBOARD_LIT_FRAG : BILLBOARD_ADDITIVE_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    fog: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: t ? OneMinusSrcAlphaFactor : OneFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
  });
  y.name = t ? "fx_lit" : "fx_add";
  let b = new Mesh(h, y);
  b.frustumCulled = false;
  b.renderOrder = r;
  b.castShadow = false;
  b.receiveShadow = false;
  b.matrixAutoUpdate = false;
  b.name = y.name;
  b.onBeforeRender = (S, z, H) => {
    let O = S.getRenderTarget(),
      q: number | undefined;
    if (O) {
      q = O.height;
    } else {
      S.getDrawingBufferSize(_billboardBufferSize);
      q = _billboardBufferSize.y;
    }
    let U = H.projectionMatrix.elements;
    x.uPx.value = 2 / (Math.max(U[5], 0.001) * Math.max(q, 1));
    let T = i.render,
      D = T && T.depthTexture;
    if (
      D &&
      D.image &&
      H === i.camera &&
      T.depthTextureIsLive !== true &&
      i.params.fxsoft !== "0"
    ) {
      x.uDepth.value = D;
      x.uSoft.value = 1;
      if (T.resolution && T.resolution.x > 0) {
        x.uRes.value.set(T.resolution.x, T.resolution.y);
      } else {
        x.uRes.value.set(D.image.width || 1, D.image.height || 1);
      }
      x.uNearFar.value.set(
        (H as PerspectiveCamera).near,
        (H as PerspectiveCamera).far,
      );
    } else {
      x.uDepth.value = null;
      x.uSoft.value = 0;
    }
  };
  let m = p.array,
    A = d.array,
    _ = v.array,
    M = g.array,
    E = {
      mesh: b,
      cap: e,
      n: 0,
      P: m,
      A,
      C: _,
      M,
      begin() {
        E.n = 0;
      },
      push(
        S: number,
        z: number,
        H: number,
        O: number,
        q: number,
        U: number,
        T: number,
        D: number,
        C: number,
        G: number,
        j: number,
        N: number,
        Q: number,
        K: number,
        ie: number,
        F: number,
      ) {
        let X = E.n;
        if (X >= e) {
          return false;
        }
        let ne = X * 4;
        m[ne] = S;
        m[ne + 1] = z;
        m[ne + 2] = H;
        m[ne + 3] = O;
        A[ne] = q;
        A[ne + 1] = U;
        A[ne + 2] = T;
        A[ne + 3] = D;
        _[ne] = C;
        _[ne + 1] = G;
        _[ne + 2] = j;
        _[ne + 3] = N;
        M[ne] = Q;
        M[ne + 1] = K;
        M[ne + 2] = ie;
        M[ne + 3] = F;
        E.n = X + 1;
        return true;
      },
      end: null as (() => void) | null,
    },
    w = [p, d, v, g];
  E.end = () => {
    let S = E.n;
    h.instanceCount = S;
    b.visible = S > 0;
    if (!!S) {
      for (let z = 0; z < 4; z++) {
        let H = w[z];
        H.clearUpdateRanges();
        H.addUpdateRange(0, S * 4);
        H.needsUpdate = true;
      }
    }
  };
  return E;
}
export const PARTICLE_FLAG_BOUNCE = 1;
export const PARTICLE_FLAG_KILL_ON_GROUND = 2;
const PARTICLE_FLAG_STICK = 4;
export const ParticlePool = class {
  declare freeTop: number;
  declare free: Uint16Array<ArrayBuffer>;
  declare order: Uint16Array<ArrayBuffer>;
  declare ramp: Uint8Array<ArrayBuffer>;
  declare flags: Uint8Array<ArrayBuffer>;
  declare mode: Uint8Array<ArrayBuffer>;
  declare frame: Uint8Array<ArrayBuffer>;
  declare gy: Float32Array<ArrayBuffer>;
  declare key: Float32Array<ArrayBuffer>;
  declare shade: Float32Array<ArrayBuffer>;
  declare stretch: Float32Array<ArrayBuffer>;
  declare fout: Float32Array<ArrayBuffer>;
  declare fin: Float32Array<ArrayBuffer>;
  declare seed: Float32Array<ArrayBuffer>;
  declare turb: Float32Array<ArrayBuffer>;
  declare wind: Float32Array<ArrayBuffer>;
  declare grav: Float32Array<ArrayBuffer>;
  declare drag: Float32Array<ArrayBuffer>;
  declare a: Float32Array<ArrayBuffer>;
  declare b: Float32Array<ArrayBuffer>;
  declare g: Float32Array<ArrayBuffer>;
  declare r: Float32Array<ArrayBuffer>;
  declare rotv: Float32Array<ArrayBuffer>;
  declare rot: Float32Array<ArrayBuffer>;
  declare sk: Float32Array<ArrayBuffer>;
  declare s1: Float32Array<ArrayBuffer>;
  declare s0: Float32Array<ArrayBuffer>;
  declare life: Float32Array<ArrayBuffer>;
  declare age: Float32Array<ArrayBuffer>;
  declare vz: Float32Array<ArrayBuffer>;
  declare vy: Float32Array<ArrayBuffer>;
  declare vx: Float32Array<ArrayBuffer>;
  declare pz: Float32Array<ArrayBuffer>;
  declare py: Float32Array<ArrayBuffer>;
  declare px: Float32Array<ArrayBuffer>;
  declare n: number;
  declare sorted: boolean;
  declare cap: number;
  constructor(e: number, t: boolean) {
    this.cap = e;
    this.sorted = t;
    this.n = 0;
    this.freeTop = e;
    let n = () => new Float32Array(e);
    this.px = n();
    this.py = n();
    this.pz = n();
    this.vx = n();
    this.vy = n();
    this.vz = n();
    this.age = n();
    this.life = n();
    this.s0 = n();
    this.s1 = n();
    this.sk = n();
    this.rot = n();
    this.rotv = n();
    this.r = n();
    this.g = n();
    this.b = n();
    this.a = n();
    this.drag = n();
    this.grav = n();
    this.wind = n();
    this.turb = n();
    this.seed = n();
    this.fin = n();
    this.fout = n();
    this.stretch = n();
    this.shade = n();
    this.key = n();
    this.gy = n();
    this.frame = new Uint8Array(e);
    this.mode = new Uint8Array(e);
    this.flags = new Uint8Array(e);
    this.ramp = new Uint8Array(e);
    this.order = new Uint16Array(e);
    this.free = new Uint16Array(e);
    for (let s = 0; s < e; s++) this.free[s] = e - 1 - s;
  }
  clear() {
    this.n = 0;
    this.freeTop = this.cap;
    for (let e = 0; e < this.cap; e++) this.free[e] = this.cap - 1 - e;
  }
  emit(
    e: number,
    t: number,
    n: number,
    s: number,
    o: number,
    r: number,
    a: number,
    l: number,
    c: number,
  ) {
    if (this.freeTop === 0) {
      return -1;
    }
    let u = this.free[--this.freeTop];
    this.order[this.n++] = u;
    this.px[u] = e;
    this.py[u] = t;
    this.pz[u] = n;
    this.vx[u] = s;
    this.vy[u] = o;
    this.vz[u] = r;
    this.age[u] = -1;
    this.life[u] = a;
    this.s0[u] = l;
    this.s1[u] = c;
    this.sk[u] = 2;
    this.rot[u] = 0;
    this.rotv[u] = 0;
    this.r[u] = 1;
    this.g[u] = 1;
    this.b[u] = 1;
    this.a[u] = 1;
    this.drag[u] = 0;
    this.grav[u] = 0;
    this.wind[u] = 0;
    this.turb[u] = 0;
    this.seed[u] = Math.random() * 100;
    this.fin[u] = 0;
    this.fout[u] = 0.5;
    this.stretch[u] = 0.02;
    this.shade[u] = 1;
    this.key[u] = 0;
    this.gy[u] = 0;
    this.frame[u] = 0;
    this.mode[u] = 0;
    this.flags[u] = 0;
    this.ramp[u] = 0;
    return u;
  }
  update(e: number, t: any, n: Vector3, s: Vector3, o: number) {
    let {
        px: r,
        py: a,
        pz: l,
        vx: c,
        vy: u,
        vz: h,
        age: f,
        life: p,
        order: d,
        flags: v,
      } = this,
      g = n.x,
      x = n.y,
      y = n.z,
      b = 0,
      m = this.n;
    for (let A = 0; A < m; A++) {
      let _ = d[A];
      if (f[_] < 0) {
        f[_] = 0;
      } else {
        f[_] += e;
        if (f[_] >= p[_]) {
          this.free[this.freeTop++] = _;
          continue;
        }
        let M = 1 - Math.exp(-this.drag[_] * e),
          E = this.wind[_];
        c[_] += (s.x * E - c[_]) * M;
        u[_] += (s.y * E - u[_]) * M;
        h[_] += (s.z * E - h[_]) * M;
        u[_] -= this.grav[_] * e;
        let w = this.turb[_];
        if (w > 0) {
          let H = this.seed[_];
          c[_] += Math.sin(a[_] * 2.3 + H + o * 1.7) * w * e;
          h[_] += Math.cos(r[_] * 1.9 + H * 1.3 + o * 1.3) * w * e;
          u[_] += Math.sin(l[_] * 2.1 + H * 0.7 + o * 2.1) * w * 0.4 * e;
        }
        r[_] += c[_] * e;
        a[_] += u[_] * e;
        l[_] += h[_] * e;
        this.rot[_] += this.rotv[_] * e;
        let S = v[_],
          z = this.gy[_] + 0.012;
        if (S && a[_] < z) {
          if (S & PARTICLE_FLAG_KILL_ON_GROUND) {
            this.free[this.freeTop++] = _;
            continue;
          }
          if (S & PARTICLE_FLAG_BOUNCE) {
            a[_] = z;
            if (u[_] < 0) {
              u[_] = -u[_] * (0.25 + (this.seed[_] % 1) * 0.3);
              c[_] *= 0.65;
              h[_] *= 0.65;
            }
          } else if (S & PARTICLE_FLAG_STICK) {
            a[_] = z;
            c[_] = u[_] = h[_] = 0;
          }
        }
      }
      if (this.sorted) {
        let M = r[_] - g,
          E = a[_] - x,
          w = l[_] - y;
        this.key[_] = M * M + E * E + w * w;
      }
      d[b++] = _;
    }
    this.n = b;
    if (this.sorted && b > 1) {
      let A = this.key;
      for (let _ = 1; _ < b; _++) {
        let M = d[_],
          E = A[M],
          w = _ - 1;
        for (; w >= 0 && A[d[w]] < E;) {
          d[w + 1] = d[w];
          w--;
        }
        d[w + 1] = M;
      }
    }
    for (let A = 0; A < b; A++) {
      let _ = d[A],
        M = f[_] / p[_],
        E = 1 - M,
        w = 1 - Math.pow(E, this.sk[_]),
        S = this.s0[_] + (this.s1[_] - this.s0[_]) * w,
        z = this.a[_],
        H = this.fin[_],
        O = this.fout[_];
      if (H > 0 && M < H) {
        z *= M / H;
      }
      if (M > O) {
        let Q = 1 - (M - O) / (1 - O);
        z *= Q * Q * (3 - 2 * Q);
      }
      let q = this.r[_],
        U = this.g[_],
        T = this.b[_],
        D = this.ramp[_];
      if (D === 1) {
        q *= Math.pow(E, 0.5);
        U *= Math.pow(E, 1.4);
        T *= Math.pow(E, 3);
      } else if (D === 2) {
        let Q = 1 - Math.pow(M, 1.6),
          K = Q * Math.sqrt(Q);
        q *= K;
        U *= (0.22 + 0.78 * Math.pow(Q, 1.3)) * K;
        T *= (0.04 + 0.96 * Math.pow(Q, 3.5)) * K;
      } else if (D === 3) {
        let Q = 0.55 + 0.45 * Math.sin(o * 17 + this.seed[_] * 9);
        q *= Q;
        U *= Q * (0.6 + 0.4 * E);
        T *= Q * E;
      }
      let C = this.mode[_],
        G = 0,
        j = 1,
        N = 0;
      if (C === 1) {
        let Q = this.stretch[_];
        G = c[_] * Q;
        j = u[_] * Q;
        N = h[_] * Q;
      }
      if (
        !t.push(
          r[_],
          a[_],
          l[_],
          S,
          G,
          j,
          N,
          this.rot[_],
          q,
          U,
          T,
          z,
          this.frame[_],
          C,
          M,
          this.shade[_],
        )
      ) {
        break;
      }
    }
  }
};
export const LightPool = class {
  declare n: any;
  declare frames: Uint8Array<ArrayBuffer>;
  declare b: Float32Array<ArrayBuffer>;
  declare g: Float32Array<ArrayBuffer>;
  declare r: Float32Array<ArrayBuffer>;
  declare width: Float32Array<ArrayBuffer>;
  declare len: Float32Array<ArrayBuffer>;
  declare trav: Float32Array<ArrayBuffer>;
  declare speed: Float32Array<ArrayBuffer>;
  declare dist: Float32Array<ArrayBuffer>;
  declare dz: Float32Array<ArrayBuffer>;
  declare dy: Float32Array<ArrayBuffer>;
  declare dx: Float32Array<ArrayBuffer>;
  declare fz: Float32Array<ArrayBuffer>;
  declare fy: Float32Array<ArrayBuffer>;
  declare fx: Float32Array<ArrayBuffer>;
  declare cap: number;
  constructor(e = 48) {
    this.cap = e;
    this.n = 0;
    let t = () => new Float32Array(e);
    this.fx = t();
    this.fy = t();
    this.fz = t();
    this.dx = t();
    this.dy = t();
    this.dz = t();
    this.dist = t();
    this.speed = t();
    this.trav = t();
    this.len = t();
    this.width = t();
    this.r = t();
    this.g = t();
    this.b = t();
    this.frames = new Uint8Array(e);
  }
  clear() {
    this.n = 0;
  }
  add(
    e: Vector3,
    t: Vector3,
    n: number,
    s: number,
    o: number,
    r: number,
    a: number,
  ) {
    let l = this.n;
    if (l >= this.cap) {
      l = 0;
    } else {
      this.n++;
    }
    let c = t.x - e.x,
      u = t.y - e.y,
      h = t.z - e.z,
      f = Math.sqrt(c * c + u * u + h * h);
    if (f < 0.001) {
      if (l === this.n - 1) {
        this.n--;
      }
      return;
    }
    this.fx[l] = e.x;
    this.fy[l] = e.y;
    this.fz[l] = e.z;
    this.dx[l] = c / f;
    this.dy[l] = u / f;
    this.dz[l] = h / f;
    this.dist[l] = f;
    this.speed[l] = r;
    this.trav[l] = 0;
    this.len[l] = Math.min(Math.max(r * 0.022, 2), 7);
    this.width[l] = a;
    this.r[l] = n;
    this.g[l] = s;
    this.b[l] = o;
    this.frames[l] = 0;
  }
  update(e: number, t: any, n: number, s: number) {
    let o = this.n;
    for (let r = 0; r < o; r++) {
      let a = this.speed[r],
        l = this.dist[r],
        c = this.len[r];
      if (this.frames[r] === 0) {
        this.trav[r] = Math.min(
          l,
          a * Math.max(e, 0.008) * (0.35 + Math.random() * 0.4),
        );
      } else {
        this.trav[r] += a * e;
      }
      let u = Math.min(this.trav[r], l),
        h = Math.max(0, this.trav[r] - c);
      if (h >= l) {
        if (this.frames[r] >= 2) {
          o--;
          if (r !== o) {
            for (let E of TRACER_SOA_FIELDS)
              (this as unknown as Record<string, Float32Array>)[E][r] = (
                this as unknown as Record<string, Float32Array>
              )[E][o];
            this.frames[r] = this.frames[o];
          }
          r--;
          continue;
        }
        h = Math.max(0, l - c * 0.5);
        u = l;
      }
      this.frames[r] = Math.min(250, this.frames[r] + 1);
      let f = (u + h) * 0.5,
        p = Math.max(u - h, 0.05),
        d = this.dx[r],
        v = this.dy[r],
        g = this.dz[r],
        x = this.width[r],
        y = this.fx[r] + d * f,
        b = this.fy[r] + v * f,
        m = this.fz[r] + g * f,
        A = this.r[r],
        _ = this.g[r],
        M = this.b[r];
      t.push(y, b, m, x, d * p, v * p, g * p, 0, A, _, M, 1, n, 1, 0, 5);
      t.push(
        y,
        b,
        m,
        x * 6,
        d * p * 1.05,
        v * p * 1.05,
        g * p * 1.05,
        0,
        A * 0.04,
        _ * 0.032,
        M * 0.028,
        1,
        n,
        1,
        0,
        28,
      );
      t.push(
        this.fx[r] + d * u,
        this.fy[r] + v * u,
        this.fz[r] + g * u,
        x * 5,
        0,
        1,
        0,
        0,
        A * 0.2,
        _ * 0.16,
        M * 0.12,
        1,
        s,
        0,
        0,
        1,
      );
    }
    this.n = o;
  }
};
const TRACER_SOA_FIELDS = [
  "fx",
  "fy",
  "fz",
  "dx",
  "dy",
  "dz",
  "dist",
  "speed",
  "trav",
  "len",
  "width",
  "r",
  "g",
  "b",
];
const _fxInstMatrix = new Matrix4();
const _fxInstQuat = new Quaternion();
const _fxInstPos = new Vector3();
const _fxInstScale = new Vector3();
const _debrisSpinAxis = new Vector3();
function debrisGeo() {
  let i: BufferGeometry = new BoxGeometry(1, 1, 1, 2, 1, 2),
    e = i.attributes.position,
    t = 1234.5,
    n = () => (
      (t = Math.sin(t * 12.9898 + 78.233) * 43758.5453),
      (t -= Math.floor(t)),
      t
    ),
    s = new Map();
  for (let o = 0; o < e.count; o++) {
    let r =
        e.getX(o).toFixed(3) +
        "," +
        e.getY(o).toFixed(3) +
        "," +
        e.getZ(o).toFixed(3),
      a = s.get(r);
    if (!a) {
      let l = e.getX(o),
        c = e.getY(o),
        u = e.getZ(o),
        f = Math.abs(l) > 0.49 && Math.abs(u) > 0.49 ? 0.72 + n() * 0.2 : 1;
      l = l * f + (n() - 0.5) * 0.14;
      u = u * f + (n() - 0.5) * 0.14;
      c = c * (0.8 + n() * 0.3) + (n() - 0.5) * 0.1;
      a = [l, c, u];
      s.set(r, a);
    }
    e.setXYZ(o, a[0], a[1], a[2]);
  }
  i = i.toNonIndexed();
  i.computeVertexNormals();
  return i;
}
export const DebrisSystem = class {
  declare state: Uint8Array<ArrayBuffer>;
  declare floor: Float32Array<ArrayBuffer>;
  declare life: Float32Array<ArrayBuffer>;
  declare age: Float32Array<ArrayBuffer>;
  declare sz: Float32Array<ArrayBuffer>;
  declare sy: Float32Array<ArrayBuffer>;
  declare sx: Float32Array<ArrayBuffer>;
  declare spin: Float32Array<ArrayBuffer>;
  declare ang: Float32Array<ArrayBuffer>;
  declare az: Float32Array<ArrayBuffer>;
  declare ay: Float32Array<ArrayBuffer>;
  declare ax: Float32Array<ArrayBuffer>;
  declare vz: Float32Array<ArrayBuffer>;
  declare vy: Float32Array<ArrayBuffer>;
  declare vx: Float32Array<ArrayBuffer>;
  declare pz: Float32Array<ArrayBuffer>;
  declare py: Float32Array<ArrayBuffer>;
  declare px: Float32Array<ArrayBuffer>;
  declare mesh: InstancedMesh<
    BufferGeometry,
    MeshStandardMaterial,
    InstancedMeshEventMap
  >;
  declare live: number;
  declare next: number;
  declare cap: number;
  declare G: GameContext;
  constructor(e: GameContext, t = 256) {
    this.G = e;
    this.cap = t;
    this.next = 0;
    this.live = 0;
    let n = new MeshStandardMaterial({
      color: 16777215,
      roughness: 0.82,
      metalness: 0.05,
    });
    n.name = "fx_debris";
    let s = (this.mesh = new InstancedMesh(debrisGeo(), n, t));
    s.instanceMatrix.setUsage(DynamicDrawUsage);
    s.instanceColor = new InstancedBufferAttribute(
      new Float32Array(t * 3).fill(1),
      3,
    );
    s.frustumCulled = false;
    s.castShadow = false;
    s.receiveShadow = true;
    s.name = "fx_debris";
    let o = () => new Float32Array(t);
    this.px = o();
    this.py = o();
    this.pz = o();
    this.vx = o();
    this.vy = o();
    this.vz = o();
    this.ax = o();
    this.ay = o();
    this.az = o();
    this.ang = o();
    this.spin = o();
    this.sx = o();
    this.sy = o();
    this.sz = o();
    this.age = o();
    this.life = o();
    this.floor = o();
    this.state = new Uint8Array(t);
    _fxInstMatrix.makeScale(0, 0, 0);
    for (let r = 0; r < t; r++)
      _fxInstMatrix.toArray(s.instanceMatrix.array, r * 16);
    s.visible = false;
  }
  clear() {
    this.state.fill(0);
    _fxInstMatrix.makeScale(0, 0, 0);
    for (let e = 0; e < this.cap; e++)
      _fxInstMatrix.toArray(this.mesh.instanceMatrix.array, e * 16);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.live = 0;
    this.mesh.visible = false;
  }
  add(
    e: number,
    t: number,
    n: number,
    s: number,
    o: number,
    r: number,
    a: number,
    l: number,
    c: number,
    u: number,
    h: number,
    f: number,
    p: number,
    d: number,
  ) {
    let v = this.next;
    this.next = (v + 1) % this.cap;
    this.px[v] = e;
    this.py[v] = t;
    this.pz[v] = n;
    this.vx[v] = s;
    this.vy[v] = o;
    this.vz[v] = r;
    let g = Math.random() - 0.5,
      x = Math.random() - 0.5,
      y = Math.random() - 0.5,
      b = Math.hypot(g, x, y) || 1;
    this.ax[v] = g / b;
    this.ay[v] = x / b;
    this.az[v] = y / b;
    this.ang[v] = Math.random() * 6.28;
    this.spin[v] = (Math.random() - 0.5) * 50;
    this.sx[v] = a;
    this.sy[v] = l;
    this.sz[v] = c;
    this.age[v] = 0;
    this.life[v] = p;
    this.floor[v] = d;
    this.state[v] = 1;
    let m = this.mesh.instanceColor!.array;
    m[v * 3] = u;
    m[v * 3 + 1] = h;
    m[v * 3 + 2] = f;
    this.mesh.instanceColor!.needsUpdate = true;
  }
  update(e: number) {
    let t = this.state,
      n = this.mesh.instanceMatrix.array,
      s = 0,
      o = false;
    for (let r = 0; r < this.cap; r++) {
      let a = t[r];
      if (!a) {
        continue;
      }
      this.age[r] += e;
      let l = this.life[r] - this.age[r];
      if (l <= 0) {
        t[r] = 0;
        _fxInstMatrix.makeScale(0, 0, 0);
        _fxInstMatrix.toArray(n, r * 16);
        o = true;
        continue;
      }
      s++;
      if (a === 2 && l > 0.5) {
        continue;
      }
      if (a === 1) {
        this.vy[r] -= 9.81 * e;
        this.px[r] += this.vx[r] * e;
        this.py[r] += this.vy[r] * e;
        this.pz[r] += this.vz[r] * e;
        this.ang[r] += this.spin[r] * e;
        let u =
          this.floor[r] + Math.min(this.sx[r], this.sy[r], this.sz[r]) * 0.5;
        if (this.py[r] < u && this.vy[r] < 0) {
          this.py[r] = u;
          if (this.vy[r] > -1.2) {
            t[r] = 2;
            this.vx[r] = this.vy[r] = this.vz[r] = 0;
          } else {
            this.vy[r] = -this.vy[r] * 0.32;
            this.vx[r] *= 0.55;
            this.vz[r] *= 0.55;
            this.spin[r] *= 0.5;
          }
        }
      }
      let c = l < 0.5 ? l / 0.5 : 1;
      _debrisSpinAxis.set(this.ax[r], this.ay[r], this.az[r]);
      _fxInstQuat.setFromAxisAngle(_debrisSpinAxis, this.ang[r]);
      _fxInstPos.set(this.px[r], this.py[r], this.pz[r]);
      _fxInstScale.set(this.sx[r] * c, this.sy[r] * c, this.sz[r] * c);
      _fxInstMatrix.compose(_fxInstPos, _fxInstQuat, _fxInstScale);
      _fxInstMatrix.toArray(n, r * 16);
      o = true;
    }
    this.live = s;
    this.mesh.visible = s > 0;
    if (o) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }
};
const _shellBounceEvent = {
  pos: new Vector3(),
  surface: "concrete",
};
const _shellDownDir = new Vector3(0, -1, 0);
const _shellRayOrigin = new Vector3();
const _shellQuat = new Quaternion();
const _shellEuler = new Euler();
function shellCasingProfile() {
  let t = [
      [0, 0],
      [0.006076, 0],
      [0.0062, 0.0012],
      [0.005083999999999999, 0.0022],
      [0.005083999999999999, 0.0034],
      [0.006013999999999999, 0.0046],
      [0.005889999999999999, 0.036399999999999995],
      [0.004092, 0.0416],
      [0.003968, 0.052],
      [0.003224, 0.052],
      [0.0031, 0.044719999999999996],
    ],
    n = new LatheGeometry(
      t.map((s) => new Vector2(s[0], s[1] - 0.052 / 2)),
      10,
    );
  n.computeVertexNormals();
  return n;
}
export const ShellSystem = class {
  declare surface: any;
  declare mesh: any;
  declare bounces: Uint8Array<ArrayBuffer>;
  declare state: Uint8Array<ArrayBuffer>;
  declare floor: Float32Array<ArrayBuffer>;
  declare rest: Float32Array<ArrayBuffer>;
  declare age: Float32Array<ArrayBuffer>;
  declare wz: Float32Array<ArrayBuffer>;
  declare wy: Float32Array<ArrayBuffer>;
  declare wx: Float32Array<ArrayBuffer>;
  declare qw: Float32Array<ArrayBuffer>;
  declare qz: Float32Array<ArrayBuffer>;
  declare qy: Float32Array<ArrayBuffer>;
  declare qx: Float32Array<ArrayBuffer>;
  declare vz: Float32Array<ArrayBuffer>;
  declare vy: Float32Array<ArrayBuffer>;
  declare vx: Float32Array<ArrayBuffer>;
  declare pz: Float32Array<ArrayBuffer>;
  declare py: Float32Array<ArrayBuffer>;
  declare px: Float32Array<ArrayBuffer>;
  declare next: number;
  declare cap: number;
  declare G: GameContext;
  constructor(e: GameContext, t = 60) {
    this.G = e;
    this.cap = t;
    this.next = 0;
    let n: any;
    try {
      n = e.mats.get("brass");
    } catch {
      n = null;
    }
    if (!n || !n.isMaterial) {
      n = new MeshStandardMaterial({
        color: 11570492,
        roughness: 0.3,
        metalness: 1,
      });
    }
    let s = (this.mesh = new InstancedMesh(shellCasingProfile(), n, t));
    s.instanceMatrix.setUsage(DynamicDrawUsage);
    s.frustumCulled = false;
    s.castShadow = false;
    s.receiveShadow = true;
    s.name = "fx_shells";
    let o = () => new Float32Array(t);
    this.px = o();
    this.py = o();
    this.pz = o();
    this.vx = o();
    this.vy = o();
    this.vz = o();
    this.qx = o();
    this.qy = o();
    this.qz = o();
    this.qw = o().fill(1);
    this.wx = o();
    this.wy = o();
    this.wz = o();
    this.age = o();
    this.rest = o();
    this.floor = o();
    this.state = new Uint8Array(t);
    this.bounces = new Uint8Array(t);
    _fxInstMatrix.makeScale(0, 0, 0);
    for (let r = 0; r < t; r++)
      _fxInstMatrix.toArray(s.instanceMatrix.array, r * 16);
    s.visible = false;
    this.surface = new Array(t).fill("concrete");
  }
  clear() {
    this.state.fill(0);
    _fxInstMatrix.makeScale(0, 0, 0);
    for (let e = 0; e < this.cap; e++)
      _fxInstMatrix.toArray(this.mesh.instanceMatrix.array, e * 16);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = false;
  }
  _floorAt(e: number) {
    let t = this.G.physics;
    this.floor[e] = 0;
    this.surface[e] = "concrete";
    if (t && t.raycast) {
      _shellRayOrigin.set(this.px[e], this.py[e] + 0.25, this.pz[e]);
      let n = t.raycast(_shellRayOrigin, _shellDownDir, 6);
      if (n) {
        this.floor[e] = n.point.y;
        this.surface[e] = n.surface || "concrete";
      } else {
        this.floor[e] = -50;
      }
    }
  }
  add(e: Vector3, t: Vector3) {
    let n = this.next;
    this.next = (n + 1) % this.cap;
    this.px[n] = e.x;
    this.py[n] = e.y;
    this.pz[n] = e.z;
    this.vx[n] = t.x;
    this.vy[n] = t.y;
    this.vz[n] = t.z;
    _shellEuler.set(
      Math.random() * 6.28,
      Math.random() * 6.28,
      Math.random() * 6.28,
    );
    _fxInstQuat.setFromEuler(_shellEuler);
    this.qx[n] = _fxInstQuat.x;
    this.qy[n] = _fxInstQuat.y;
    this.qz[n] = _fxInstQuat.z;
    this.qw[n] = _fxInstQuat.w;
    this.wx[n] = (Math.random() - 0.5) * 40;
    this.wy[n] = (Math.random() - 0.5) * 20;
    this.wz[n] = (Math.random() - 0.5) * 40;
    this.age[n] = 0;
    this.rest[n] = 0;
    this.state[n] = 1;
    this.bounces[n] = 0;
    this._floorAt(n);
  }
  update(e: number) {
    let t = this.state,
      n = this.mesh.instanceMatrix.array,
      s = 0,
      o = false;
    for (let r = 0; r < this.cap; r++) {
      let a = t[r];
      if (!a) {
        continue;
      }
      s++;
      this.age[r] += e;
      let l = 1;
      if (a === 1) {
        this.vy[r] -= 9.81 * e;
        this.px[r] += this.vx[r] * e;
        this.py[r] += this.vy[r] * e;
        this.pz[r] += this.vz[r] * e;
        let c = this.wx[r],
          u = this.wy[r],
          h = this.wz[r],
          f = this.qx[r],
          p = this.qy[r],
          d = this.qz[r],
          v = this.qw[r],
          g = 0.5 * e,
          x = f + g * (c * v + u * d - h * p),
          y = p + g * (u * v + h * f - c * d),
          b = d + g * (h * v + c * p - u * f),
          m = v - g * (c * f + u * p + h * d),
          A = 1 / (Math.hypot(x, y, b, m) || 1);
        this.qx[r] = x * A;
        this.qy[r] = y * A;
        this.qz[r] = b * A;
        this.qw[r] = m * A;
        let _ = this.floor[r] + 0.0065;
        if (this.py[r] < _ && this.vy[r] < 0) {
          this.py[r] = _;
          let M = this.bounces[r]++;
          if (M < 2) {
            _shellBounceEvent.pos.set(this.px[r], this.py[r], this.pz[r]);
            _shellBounceEvent.surface = this.surface[r];
            this.G.events.emit("shell:bounce", _shellBounceEvent);
          }
          if (this.vy[r] > -0.9 || M >= 4) {
            t[r] = 2;
            this.vx[r] = this.vy[r] = this.vz[r] = 0;
            _shellEuler.set(Math.PI / 2, 0, Math.random() * 6.28, "ZXY");
            _fxInstQuat.setFromEuler(_shellEuler);
            this.qx[r] = _fxInstQuat.x;
            this.qy[r] = _fxInstQuat.y;
            this.qz[r] = _fxInstQuat.z;
            this.qw[r] = _fxInstQuat.w;
          } else {
            this.vy[r] = -this.vy[r] * (0.32 + Math.random() * 0.16);
            this.vx[r] = this.vx[r] * 0.6 + (Math.random() - 0.5) * 0.6;
            this.vz[r] = this.vz[r] * 0.6 + (Math.random() - 0.5) * 0.6;
            this.wx[r] = (Math.random() - 0.5) * 50;
            this.wy[r] = (Math.random() - 0.5) * 30;
            this.wz[r] = (Math.random() - 0.5) * 50;
            if (M === 0) {
              this._floorAt(r);
            }
          }
        }
        if (this.age[r] > 8) {
          t[r] = 2;
        }
      } else {
        this.rest[r] += e;
        if (this.rest[r] < 4 && this.rest[r] > e * 1.5) {
          continue;
        }
        if (this.rest[r] >= 4.7) {
          t[r] = 0;
          _fxInstMatrix.makeScale(0, 0, 0);
          _fxInstMatrix.toArray(n, r * 16);
          o = true;
          continue;
        }
        if (this.rest[r] >= 4) {
          l = 1 - (this.rest[r] - 4) / 0.7;
        }
      }
      _shellQuat.set(this.qx[r], this.qy[r], this.qz[r], this.qw[r]);
      _fxInstPos.set(this.px[r], this.py[r], this.pz[r]);
      _fxInstScale.set(l, l, l);
      _fxInstMatrix.compose(_fxInstPos, _shellQuat, _fxInstScale);
      _fxInstMatrix.toArray(n, r * 16);
      o = true;
    }
    this.mesh.visible = s > 0;
    if (o) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }
};
const DECAL_SIZES: Record<string, number> = {
  bullet_metal: 0.25,
  bullet_concrete: 0.34,
  bullet_wood: 0.24,
  scorch: 2.4,
  soot: 0.3,
  bullet_glass: 0.3,
};
const DECAL_FADE_COUNT = 14;
export const DecalSystem = class {
  declare uvs: any;
  declare atlas: any;
  declare mesh: Mesh<
    BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>,
    MeshStandardMaterial,
    Object3DEventMap
  >;
  declare baseA: Float32Array<ArrayBuffer>;
  declare col: BufferAttribute;
  declare uv: BufferAttribute;
  declare nor: BufferAttribute;
  declare pos: BufferAttribute;
  declare count: number;
  declare next: number;
  declare cap: number;
  constructor(e: GameContext, t = 160) {
    this.cap = t;
    this.next = 0;
    this.count = 0;
    let n = (this.atlas = bakeDecalAtlas(256)),
      s = new BufferGeometry();
    this.pos = new BufferAttribute(new Float32Array(t * 12), 3);
    this.pos.setUsage(DynamicDrawUsage);
    this.nor = new BufferAttribute(new Float32Array(t * 12), 3);
    this.nor.setUsage(DynamicDrawUsage);
    this.uv = new BufferAttribute(new Float32Array(t * 8), 2);
    this.uv.setUsage(DynamicDrawUsage);
    this.col = new BufferAttribute(new Float32Array(t * 16), 4);
    this.col.setUsage(DynamicDrawUsage);
    this.baseA = new Float32Array(t);
    s.setAttribute("position", this.pos);
    s.setAttribute("normal", this.nor);
    s.setAttribute("uv", this.uv);
    s.setAttribute("color", this.col);
    let o = new Uint16Array(t * 6);
    for (let l = 0; l < t; l++) {
      let c = l * 4,
        u = l * 6;
      o[u] = c;
      o[u + 1] = c + 1;
      o[u + 2] = c + 2;
      o[u + 3] = c;
      o[u + 4] = c + 2;
      o[u + 5] = c + 3;
    }
    s.setIndex(new BufferAttribute(o, 1));
    let r = new MeshStandardMaterial({
      map: n.map,
      roughnessMap: n.orm,
      metalnessMap: n.orm,
      roughness: 1,
      metalness: 1,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    if (n.nrm) {
      r.normalMap = n.nrm;
      r.normalScale = new Vector2(1, 1);
    }
    r.name = "fx_decals";
    let a = (this.mesh = new Mesh(s, r));
    a.frustumCulled = false;
    a.castShadow = false;
    a.receiveShadow = true;
    a.renderOrder = -5;
    a.matrixAutoUpdate = false;
    a.name = "fx_decals";
    a.visible = false;
    this.uvs = {};
    for (let l in DECAL_TILES)
      this.uvs[l] = DECAL_TILES[l].map((c: number) => n.uv(c));
  }
  clear() {
    this.col.array.fill(0);
    this.pos.array.fill(0);
    this.col.needsUpdate = this.pos.needsUpdate = true;
    this.next = 0;
    this.count = 0;
    this.mesh.visible = false;
  }
  add(e: Vector3, t: Vector3, n: string, s?: number | undefined, o = 1, r = 1) {
    let a = this.uvs[n] || this.uvs.bullet_concrete,
      l = a[(Math.random() * a.length) | 0],
      c = (s || DECAL_SIZES[n] || 0.25) * (0.85 + Math.random() * 0.3) * 0.5,
      u = this.next;
    this.next = (u + 1) % this.cap;
    if (this.count < this.cap) {
      this.count++;
    }
    let h = t.x,
      f = t.y,
      p = t.z,
      d = Math.hypot(h, f, p) || 1;
    h /= d;
    f /= d;
    p /= d;
    let v: number | undefined, g: number | undefined, x: number | undefined;
    if (Math.abs(f) > 0.9) {
      v = 1;
      g = 0;
      x = 0;
    } else {
      v = -p;
      g = 0;
      x = h;
    }
    let y = v * h + g * f + x * p;
    v -= h * y;
    g -= f * y;
    x -= p * y;
    let b = Math.hypot(v, g, x) || 1;
    v /= b;
    g /= b;
    x /= b;
    let m = f * x - p * g,
      A = p * v - h * x,
      _ = h * g - f * v,
      M =
        n === "bullet_wood"
          ? (Math.random() - 0.5) * 0.3
          : Math.random() * 6.283,
      E = Math.cos(M),
      w = Math.sin(M),
      S = (v * E + m * w) * c,
      z = (g * E + A * w) * c,
      H = (x * E + _ * w) * c,
      O = (m * E - v * w) * c,
      q = (A * E - g * w) * c,
      U = (_ * E - x * w) * c,
      T = 0.004 + (u % 7) * 3e-4,
      D = e.x + h * T,
      C = e.y + f * T,
      G = e.z + p * T,
      j = this.pos.array,
      N = this.nor.array,
      Q = this.uv.array,
      K = this.col.array,
      ie = u * 12;
    j[ie] = D - S - O;
    j[ie + 1] = C - z - q;
    j[ie + 2] = G - H - U;
    j[ie + 3] = D + S - O;
    j[ie + 4] = C + z - q;
    j[ie + 5] = G + H - U;
    j[ie + 6] = D + S + O;
    j[ie + 7] = C + z + q;
    j[ie + 8] = G + H + U;
    j[ie + 9] = D - S + O;
    j[ie + 10] = C - z + q;
    j[ie + 11] = G - H + U;
    for (let F = 0; F < 4; F++) {
      N[ie + F * 3] = h;
      N[ie + F * 3 + 1] = f;
      N[ie + F * 3 + 2] = p;
    }
    ie = u * 8;
    Q[ie] = l[0];
    Q[ie + 1] = l[1];
    Q[ie + 2] = l[2];
    Q[ie + 3] = l[1];
    Q[ie + 4] = l[2];
    Q[ie + 5] = l[3];
    Q[ie + 6] = l[0];
    Q[ie + 7] = l[3];
    ie = u * 16;
    this.baseA[u] = r;
    for (let F = 0; F < 4; F++) {
      K[ie + F * 4] = o;
      K[ie + F * 4 + 1] = o;
      K[ie + F * 4 + 2] = o;
      K[ie + F * 4 + 3] = r;
    }
    if (this.count >= this.cap) {
      for (let F = 0; F < DECAL_FADE_COUNT; F++) {
        let X = (this.next + F) % this.cap,
          ne = (this.baseA[X] * (F + 1)) / (DECAL_FADE_COUNT + 1),
          re = X * 16;
        K[re + 3] = K[re + 7] = K[re + 11] = K[re + 15] = ne;
      }
    }
    this.pos.needsUpdate =
      this.nor.needsUpdate =
      this.uv.needsUpdate =
      this.col.needsUpdate =
        true;
    this.mesh.visible = true;
  }
};
