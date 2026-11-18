import type { GameContext } from "../types/context";
import type { CanvasTexture, DataTexture } from "three";
import {
  AdditiveBlending,
  BufferAttribute,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  Sphere,
  Vector2,
  Vector3,
  Vector4,
} from "three";
import { SKY, SUN } from "../config/world";
import { PUDDLE_FIELD } from "./noise";

const GLSL_RAIN_COMMON = `
uniform vec3 uBoxMin[4]; uniform vec3 uBoxMax[4];
bool wInside(vec3 p){
  for (int i = 0; i < 4; i++) { if (all(greaterThan(p, uBoxMin[i])) && all(lessThan(p, uBoxMax[i]))) return true; }
  return false;
}
float wPhase(float c){ float g = 0.72; return (1.0 - g * g) / (12.566 * pow(1.0 + g * g - 2.0 * g * c, 1.5)); }
`;
const RAIN_STREAK_VERT = `
uniform float uTime, uRain, uPix, uDrip; uniform vec3 uVel, uBox, uSunDir, uSunCol, uAmb;
attribute vec4 aSeed;
varying vec3 vCol; varying float vA; varying vec2 vUv;
${GLSL_RAIN_COMMON}
uniform vec4 uSky[8];   // roof openings (x, z, half w, half d): rain falls through these into the shed
bool wSky(vec3 p){
  for (int i = 0; i < 8; i++) { if (abs(p.x - uSky[i].x) < uSky[i].z && abs(p.z - uSky[i].y) < uSky[i].w) return true; }
  return false;
}
void main(){
  vUv = position.xy;
  float sp = 0.82 + 0.36 * aSeed.w;
  vec3 vel = uVel * sp;
  vec3 p; float len; float kill = 0.0;
  if (aSeed.w < 0.0) {                       // eave drip line (shed south eave), free-fall from 7 m
    float T = 1.19; float t = fract(uTime / T * (0.9 + 0.2 * aSeed.y) + aSeed.z) * T;
    p = vec3(mix(-16.0, 12.0, aSeed.x), 7.0 - 4.9 * t * t, -10.72 + 0.05 * sin(aSeed.x * 911.0));
    vel = vec3(0.0, -9.81 * t - 0.3, 0.0); len = 0.022 * length(vel) + 0.03;
    kill = 1.0 - uDrip;
    if (fract(aSeed.x * 37.7) > 0.55 + 0.45 * uRain) kill = 1.0;
  } else {
    p = aSeed.xyz * uBox + vel * uTime;
    p = mod(p - cameraPosition + 0.5 * uBox, uBox) - 0.5 * uBox + cameraPosition;
    len = 0.03 * length(vel);
    if (fract(aSeed.w * 7.13 + aSeed.x) > uRain) kill = 1.0;
    if (wInside(p) && !wSky(p)) kill = 1.0;
  }
  if (p.y < (p.x > 30.0 ? -1.6 : 0.0)) kill = 1.0;
  vec3 dir = normalize(vel);
  vec3 toP = p - cameraPosition; float dist = length(toP);
  vec3 side = normalize(cross(dir, toP));
  float w0 = 0.005 + 0.004 * fract(aSeed.w * 3.7);
  float w = max(w0, dist * uPix * 0.75);
  vec3 wp = p + dir * (len * (position.y - 0.5)) + side * (w * position.x);
  float a = (w0 / w) * smoothstep(0.7, 2.6, dist) * (1.0 - smoothstep(0.38, 0.5, dist / uBox.x));
  float c = dot(toP / max(dist, 1e-3), uSunDir);
  vCol = uAmb + uSunCol * wPhase(c);
  vA = a * (0.55 + 0.45 * fract(aSeed.w * 13.3));
  gl_Position = kill > 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const RAIN_STREAK_FRAG = `
varying vec3 vCol; varying float vA; varying vec2 vUv;
void main(){
  float x = 1.0 - abs(vUv.x) * 2.0;
  float e = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
  gl_FragColor = vec4(vCol, vA * x * e);
}`;
const RAIN_SPLASH_VERT = `
uniform float uTime, uRain; uniform vec3 uSunDir, uSunCol, uAmb, uMaskRect; uniform sampler2D uMask;
attribute vec4 aSeed;
varying vec3 vCol; varying float vA; varying vec2 vUv; varying float vLife;
${GLSL_RAIN_COMMON}
vec2 sHash(vec2 p){ vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
void main(){
  vUv = position.xy;
  float period = 0.26 + 0.14 * aSeed.z;
  float tt = uTime / period + aSeed.w * 10.0; float cyc = floor(tt); float life = fract(tt);
  vec2 r = sHash(aSeed.xy * 91.7 + cyc * 0.371);
  vec2 rr = r - 0.5; rr *= 0.35 + 1.3 * abs(rr);                    // denser near the player
  vec2 snap = floor(cameraPosition.xz / 4.0) * 4.0;
  vec3 p = vec3(snap.x + rr.x * 30.0, 0.0, snap.y + rr.y * 30.0);
  float kill = 0.0;
  vec2 muv = (p.xz - uMaskRect.xy) * uMaskRect.z;
  float inM = step(0.0, muv.x) * step(muv.x, 1.0) * step(0.0, muv.y) * step(muv.y, 1.0);
  float pud = step(textureLod(uMask, muv, 0.0).r, 0.49) * inM;
  float k = fract(aSeed.w * 5.3 + cyc * 0.17);
  if (pud < 0.5 && k > 0.3) kill = 1.0;
  if (k > 0.2 + 0.8 * uRain) kill = 1.0;
  if (p.x > 29.7 || wInside(p + vec3(0.0, 0.2, 0.0))) kill = 1.0;
  float sz = mix(0.04, 0.08, aSeed.z) * mix(0.65, 1.0, pud);
  float wd = sz * (0.7 + 1.5 * life), ht = sz * (0.4 + 1.3 * sin(life * 3.14159));
  vec3 toP = p - cameraPosition; float dist = length(toP);
  vec3 side = normalize(vec3(toP.z, 0.0, -toP.x));
  vec3 wp = p + side * (wd * position.x * 2.0) + vec3(0.0, ht * position.y + 0.004, 0.0);
  float c = dot(toP / max(dist, 1e-3), uSunDir);
  vCol = uAmb * 1.4 + uSunCol * wPhase(c) * 0.8;
  vA = (1.0 - life) * (1.0 - smoothstep(11.0, 15.0, dist)) * mix(0.5, 1.0, pud);
  vLife = life;
  gl_Position = kill > 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const RAIN_SPLASH_FRAG = `
varying vec3 vCol; varying float vA; varying vec2 vUv; varying float vLife;
void main(){
  float x = vUv.x * 2.0, y = vUv.y;
  // little crown: a rim arc that opens outward, plus a few thrown droplets
  float dome = smoothstep(1.0, 0.25, length(vec2(x * 1.15, y * 1.5)));
  float crown = dome * (0.35 + 0.65 * smoothstep(0.25, 0.75, length(vec2(x, y * 1.4))));
  float core = smoothstep(0.5, 0.0, length(vec2(x * 1.6, (y - 0.25) * 1.6))) * (1.0 - vLife);
  float dots = smoothstep(0.16, 0.05, length(vec2(abs(x) - 0.75, y - 0.82))) + smoothstep(0.14, 0.04, length(vec2(x - 0.2, y - 0.93)));
  float a = clamp(crown * 0.5 + core * 0.8 + dots * 0.0, 0.0, 1.0) * vA * 0.6;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol, a);
}`;
function rainQuadGeo(i: number, e: number, t: () => number) {
  let n = new InstancedBufferGeometry();
  n.setAttribute(
    "position",
    new BufferAttribute(
      new Float32Array([-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0]),
      3,
    ),
  );
  n.setIndex([0, 1, 2, 2, 1, 3]);
  let s = new Float32Array((i + e) * 4);
  for (let o = 0; o < (i + e) * 4; o++) s[o] = t();
  for (let o = i; o < i + e; o++) s[o * 4 + 3] = -1;
  n.setAttribute("aSeed", new InstancedBufferAttribute(s, 4));
  n.instanceCount = i + e;
  n.boundingSphere = new Sphere(new Vector3(), 1e5);
  return n;
}
export function createRain(
  i: GameContext,
  e: {
    mask: DataTexture;
    detail: DataTexture;
    detailN: DataTexture;
    marks: CanvasTexture;
    black: DataTexture;
  },
) {
  let t = i.rng && i.rng.fork ? i.rng.fork() : Math.random,
    n = Math.max(0.15, i.quality.rain || 0.5),
    s = Math.round(9e3 * n),
    o = 260,
    r = Math.round(900 * n),
    a = [0, 1, 2, 3].map(() => new Vector3()),
    l = [0, 1, 2, 3].map(() => new Vector3()),
    c = SUN.color.clone().multiplyScalar(1.9),
    u = SKY.fog.clone().multiplyScalar(0.15),
    h = {
      uTime: {
        value: 0,
      },
      uRain: {
        value: 0.6,
      },
      uBoxMin: {
        value: a,
      },
      uBoxMax: {
        value: l,
      },
      uSunDir: {
        value: SUN.dir.clone(),
      },
      uSunCol: {
        value: c,
      },
      uAmb: {
        value: u,
      },
    },
    f = [0, 1, 2, 3, 4, 5, 6, 7].map(() => new Vector4(0, 0, -1, -1)),
    p = {
      ...h,
      uSky: {
        value: f,
      },
      uPix: {
        value: 0.002,
      },
      uDrip: {
        value: 0,
      },
      uVel: {
        value: new Vector3(-2.6, -9.4, 1.1),
      },
      uBox: {
        value: new Vector3(26, 15, 26),
      },
    },
    d = new ShaderMaterial({
      uniforms: p,
      vertexShader: RAIN_STREAK_VERT,
      fragmentShader: RAIN_STREAK_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      fog: false,
    }),
    v = new Mesh(rainQuadGeo(s, o, t), d);
  v.frustumCulled = false;
  v.renderOrder = 900;
  v.name = "rain";
  v.matrixAutoUpdate = false;
  v.castShadow = v.receiveShadow = false;
  let g = {
      ...h,
      uMask: {
        value: e.mask,
      },
      uMaskRect: {
        value: new Vector3(
          PUDDLE_FIELD.x0,
          PUDDLE_FIELD.z0,
          1 / PUDDLE_FIELD.size,
        ),
      },
    },
    x = new ShaderMaterial({
      uniforms: g,
      vertexShader: RAIN_SPLASH_VERT,
      fragmentShader: RAIN_SPLASH_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      fog: false,
    }),
    y = new Mesh(rainQuadGeo(r, 0, t), x);
  y.frustumCulled = false;
  y.renderOrder = 890;
  y.name = "rainSplash";
  y.matrixAutoUpdate = false;
  let b = 0.6,
    m = 0.6,
    A = 22 + t() * 25,
    _ = 0,
    M = new Vector2();
  return {
    rain: v,
    splash: y,
    wind: p.uVel.value,
    setRain(w: number) {
      m = Math.min(1, Math.max(0, w));
    },
    get rainLevel() {
      return b;
    },
    update(w: number) {
      _ += w;
      b += (m - b) * Math.min(1, w * 0.8);
      h.uTime.value = _;
      h.uRain.value = b;
      v.visible = y.visible = b > 0.01;
      let S = i.camera;
      if (S) {
        let O = i.render && i.render.resolution;
        if (O && O.x > 8) {
          M.copy(O);
        } else {
          i.renderer.getDrawingBufferSize(M);
        }
        p.uPix.value =
          (2 * Math.tan((S.fov * Math.PI) / 360)) / Math.max(1, M.y);
      }
      let z = (i.level && i.level.interiorBoxes) || [];
      for (let O = 0; O < 4; O++) {
        let q = z[O];
        if (q && q.min && q.max) {
          a[O].set(q.min.x - 0.15, q.min.y - 1, q.min.z - 0.15);
          l[O].set(q.max.x + 0.15, q.max.y + 0.3, q.max.z + 0.15);
        } else {
          a[O].set(0, 0, 0);
          l[O].set(0, 0, 0);
        }
      }
      p.uDrip.value = z.length ? 1 : 0;
      let H = (i.level && i.level.skylights) || [];
      for (let O = 0; O < 8; O++) {
        let q = H[O];
        if (q && q.w > 0) {
          f[O].set(q.x, q.z, q.w * 0.5, (q.d || q.w) * 0.5);
        } else {
          f[O].set(0, 0, -1, -1);
        }
      }
      A -= w;
      if (A <= 0) {
        A = 30 + t() * 30;
        i.events.emit("thunder", {
          intensity: 0.3 + 0.7 * t(),
        });
      }
    },
  };
}
