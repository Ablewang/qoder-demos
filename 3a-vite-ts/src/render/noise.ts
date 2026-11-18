import {
  DataTexture,
  LinearFilter,
  NoColorSpace,
  RGBAFormat,
  RepeatWrapping,
  UnsignedByteType,
} from "three";

export const GLSL_NOISE = `
uniform sampler2D tNoise;
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return texture2D(tNoise, (i + f + 0.5) / 256.0).r; }
float fbm5(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * n2(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.3; a *= 0.5; } return s / 0.96875; }
float fbm3(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++){ s += a * n2(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.3; a *= 0.5; } return s / 0.875; }
`;
export const GLSL_SKY_COMMON = `
uniform vec3 uSunDir, uZen, uHor, uHorAway, uSunCol;
float skyToSun(vec3 d){ return clamp(dot(normalize(d.xz + vec2(1e-5)), normalize(uSunDir.xz)) * 0.5 + 0.5, 0.0, 1.0); }
vec3 horizonColor(vec3 d){
  float ts = skyToSun(d);
  vec3 c = mix(uHorAway, uHorAway * 1.25 + vec3(0.05, 0.03, 0.02), smoothstep(0.2, 0.75, ts));
  c = mix(c, uHor * vec3(1.9, 1.55, 1.2), pow(ts, 6.0));
  c = mix(c, vec3(1.0, 0.60, 0.24) * 3.4, pow(ts, 34.0));
  return c;
}
`;
export function createNoiseTexture() {
  let e = new Uint8Array(262144),
    t = 2654435769,
    n = () => (
      (t ^= t << 13),
      (t >>>= 0),
      (t ^= t >>> 17),
      (t ^= t << 5),
      (t >>>= 0),
      t / 4294967296
    );
  for (let o = 0; o < 256 * 256; o++) {
    e[o * 4] = n() * 256;
    e[o * 4 + 1] = n() * 256;
    e[o * 4 + 2] = n() * 256;
    e[o * 4 + 3] = 255;
  }
  let s = new DataTexture(e, 256, 256, RGBAFormat, UnsignedByteType);
  s.wrapS = s.wrapT = RepeatWrapping;
  s.magFilter = s.minFilter = LinearFilter;
  s.generateMipmaps = false;
  s.colorSpace = NoColorSpace;
  s.needsUpdate = true;
  return s;
}
