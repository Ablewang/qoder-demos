import { ShaderChunk } from "three";

export const SURFACE_SPECS: Record<
  string,
  {
    fn: string;
    size: number;
    tile: number | number[];
    bump: number;
    hero?: boolean;
    p?: number[];
    seed?: number;
  }
> = {
  asphalt: {
    fn: "asphalt",
    size: 1,
    tile: 2,
    bump: 1.6,
    hero: true,
  },
  concrete: {
    fn: "concrete",
    size: 1,
    tile: 3,
    bump: 2.5,
  },
  brick: {
    fn: "brick",
    size: 0.5,
    tile: 1.8,
    bump: 6,
  },
  epoxy: {
    fn: "epoxy",
    size: 0.5,
    tile: 4,
    bump: 3,
  },
  paint: {
    fn: "paint",
    size: 1,
    tile: 2.5,
    bump: 2.5,
    p: [0.5],
  },
  hull: {
    fn: "hull",
    size: 0.5,
    tile: 4,
    bump: 12,
  },
  galv: {
    fn: "galv",
    size: 0.5,
    tile: 1,
    bump: 0.8,
  },
  metal: {
    fn: "metal",
    size: 0.5,
    tile: 1,
    bump: 0.5,
    p: [1],
  },
  brushed: {
    fn: "brushed",
    size: 0.5,
    tile: 0.5,
    bump: 0.4,
  },
  rust: {
    fn: "rust",
    size: 0.5,
    tile: 1.2,
    bump: 3,
  },
  diamond: {
    fn: "diamond",
    size: 0.5,
    tile: 0.5,
    bump: 2,
  },
  corrugated: {
    fn: "corrugated",
    size: 0.5,
    tile: [0.762, 2.286],
    bump: 19,
  },
  chainlink: {
    fn: "chainlink",
    size: 0.5,
    tile: 0.5,
    bump: 5,
  },
  hazard: {
    fn: "hazard",
    size: 0.5,
    tile: 1,
    bump: 2.5,
  },
  gunmetal: {
    fn: "gunmetal",
    size: 0.5,
    tile: 0.25,
    bump: 0.3,
    p: [0.6],
  },
  anodized: {
    fn: "gunmetal",
    size: 0.5,
    tile: 0.25,
    bump: 0.25,
    p: [0.2],
    seed: 11,
  },
  polymer: {
    fn: "polymer",
    size: 0.25,
    tile: 0.1,
    bump: 0.4,
  },
  carbon: {
    fn: "carbon",
    size: 0.25,
    tile: 0.05,
    bump: 0.5,
  },
  fabric: {
    fn: "fabric",
    size: 0.25,
    tile: 0.05,
    bump: 0.4,
  },
  armor: {
    fn: "armor",
    size: 0.5,
    tile: 0.5,
    bump: 0.8,
  },
  wood: {
    fn: "wood",
    size: 0.5,
    tile: 1.2,
    bump: 2.6,
  },
  plastic: {
    fn: "plastic",
    size: 0.5,
    tile: 1,
    bump: 1,
  },
  tarp: {
    fn: "tarp",
    size: 0.5,
    tile: 1.5,
    bump: 20,
  },
  cardboard: {
    fn: "cardboard",
    size: 0.5,
    tile: 1,
    bump: 0.8,
  },
  rope: {
    fn: "rope",
    size: 0.25,
    tile: 0.1,
    bump: 4,
  },
  tire: {
    fn: "tire",
    size: 0.5,
    tile: [0.5, 0.3],
    bump: 7,
  },
  glass: {
    fn: "glass",
    size: 0.5,
    tile: 1.5,
    bump: 1.5,
    p: [0.3],
  },
  glass_dirty: {
    fn: "glass",
    size: 0.5,
    tile: 1.5,
    bump: 1.5,
    p: [1],
    seed: 40,
  },
  water: {
    fn: "water",
    size: 0.25,
    tile: 4,
    bump: 30,
  },
};
const WET_DEFAULT = [0.42, 0.38, 0.5, 0];
const WET_PAINT = [0.05, 0.62, 0.65, 0.7];
const WET_METAL = [0, 0.7, 0.55, 0.5];
const WET_RUST = [0.3, 0.6, 0.55, 0];
const WET_PLASTIC = [0.08, 0.62, 0.6, 0.5];
const WET_WOOD = [0.4, 0.5, 0.6, 0];
const WET_NONE = [0, 1, 0, 0];
const MACRO_CONCRETE = [0.22, 0.12, 0.35, 0.35];
const MACRO_DEFAULT = [0.14, 0.1, 0.8, 0.2];
const MACRO_FINE = [0.07, 0.06, 3, 0];
const MACRO_NONE = [0, 0, 1, 0];
const materialDef = (
  i: string,
  e: {
    tint?: number;
    color?: number;
    wet?: number[];
    macro?: number[];
    rough?: number;
    alphaCut?: boolean;
    side?: number;
    metal?: number;
    transparent?: boolean;
  } = {},
) => ({
  set: i,
  tint: 0,
  color: 16777215,
  rough: 1,
  metal: 1,
  wet: WET_DEFAULT,
  macro: MACRO_DEFAULT,
  nrm: 1,
  ...e,
});
const paintDef = (i: number) =>
  materialDef("paint", {
    tint: 1,
    color: i,
    wet: WET_PAINT,
    macro: [0.2, 0.16, 0.4, 0.45],
  });
export const MATERIAL_DEFS: any = {
  asphalt: materialDef("asphalt", {
    wet: [0.45, 0.3, 0.5, 0],
    macro: MACRO_CONCRETE,
  }),
  concrete: materialDef("concrete", {
    macro: MACRO_CONCRETE,
  }),
  concrete_dirty: materialDef("concrete", {
    color: 13616822,
    macro: [0.3, 0.15, 0.35, 0.9],
  }),
  concrete_painted: materialDef("concrete", {
    tint: 2,
    color: 9343638,
    rough: 0.9,
    wet: [0.15, 0.55, 0.6, 0.3],
    macro: [0.14, 0.1, 0.5, 0.3],
  }),
  brick: materialDef("brick"),
  floor_epoxy: materialDef("epoxy", {
    wet: [0.04, 0.75, 0.4, 0],
    macro: [0.12, 0.2, 0.45, 0.25],
  }),
  paint_red: paintDef(8200729),
  paint_blue: paintDef(2047846),
  paint_green: paintDef(2906692),
  paint_yellow: paintDef(12159516),
  paint_orange: paintDef(11751962),
  paint_white: paintDef(12172214),
  paint_grey: paintDef(5922920),
  paint_teal: paintDef(2055523),
  steel_galv: materialDef("galv", {
    wet: WET_METAL,
  }),
  steel_dark: materialDef("metal", {
    tint: 1,
    color: 4014406,
    rough: 1.15,
    wet: WET_METAL,
  }),
  steel_worn: materialDef("metal", {
    tint: 1,
    color: 9080466,
    rough: 0.9,
    wet: WET_METAL,
  }),
  steel_bare: materialDef("brushed", {
    tint: 1,
    color: 11843771,
    wet: WET_METAL,
    macro: MACRO_FINE,
  }),
  steel_rust: materialDef("rust", {
    wet: WET_RUST,
  }),
  diamond_plate: materialDef("diamond", {
    wet: WET_METAL,
  }),
  corrugated_roof: materialDef("corrugated", {
    wet: WET_METAL,
  }),
  chainlink: materialDef("chainlink", {
    tint: 3,
    alphaCut: true,
    side: 2,
    wet: WET_NONE,
    macro: MACRO_NONE,
  }),
  aluminium: materialDef("brushed", {
    tint: 1,
    color: 12896459,
    rough: 1.15,
    wet: WET_METAL,
    macro: MACRO_FINE,
  }),
  brass: materialDef("brushed", {
    tint: 1,
    color: 12753477,
    rough: 0.9,
    wet: WET_METAL,
    macro: [0.1, 0.08, 20, 0],
  }),
  hazard_stripes: materialDef("hazard", {
    wet: WET_PAINT,
  }),
  gunmetal: materialDef("gunmetal", {
    tint: 1,
    color: 2764081,
    wet: [0, 0.75, 0.6, 0.5],
    macro: [0.08, 0.06, 6, 0],
  }),
  anodized_black: materialDef("anodized", {
    tint: 1,
    color: 1184790,
    rough: 0.72,
    metal: 0.9,
    wet: [0, 0.75, 0.6, 0.5],
    macro: [0.06, 0.05, 6, 0],
  }),
  polymer_black: materialDef("polymer", {
    tint: 1,
    color: 1513498,
    wet: [0, 0.7, 0.6, 0.5],
    macro: [0.06, 0.06, 6, 0],
  }),
  polymer_tan: materialDef("polymer", {
    tint: 1,
    color: 7299144,
    wet: [0, 0.7, 0.6, 0.5],
    macro: [0.06, 0.06, 6, 0],
  }),
  rubber: materialDef("polymer", {
    tint: 1,
    color: 1052688,
    rough: 1.4,
    wet: [0.05, 0.6, 0.6, 0.4],
    macro: [0.06, 0.06, 6, 0],
  }),
  carbon: materialDef("carbon", {
    wet: [0, 0.8, 0.6, 0.5],
    macro: [0.05, 0.05, 6, 0],
  }),
  glove_fabric: materialDef("fabric", {
    tint: 1,
    color: 2303530,
    wet: [0.3, 0.7, 0.6, 0],
    macro: [0.08, 0.04, 8, 0],
  }),
  armor_white: materialDef("armor", {
    tint: 1,
    color: 11449528,
    wet: WET_PAINT,
    macro: [0.08, 0.08, 2.5, 0.15],
  }),
  armor_orange: materialDef("armor", {
    tint: 1,
    color: 12670234,
    wet: WET_PAINT,
    macro: [0.08, 0.08, 2.5, 0.15],
  }),
  wood_pallet: materialDef("wood", {
    wet: WET_WOOD,
    macro: [0.2, 0.1, 0.9, 0.4],
  }),
  wood_dark: materialDef("wood", {
    color: 9074794,
    wet: WET_WOOD,
    macro: [0.2, 0.1, 0.9, 0.4],
  }),
  plastic_blue: materialDef("plastic", {
    tint: 1,
    color: 1920134,
    wet: WET_PLASTIC,
  }),
  plastic_red: materialDef("plastic", {
    tint: 1,
    color: 9314074,
    wet: WET_PLASTIC,
  }),
  plastic_grey: materialDef("plastic", {
    tint: 1,
    color: 4935508,
    wet: WET_PLASTIC,
  }),
  tarp: materialDef("tarp", {
    tint: 1,
    color: 3885626,
    wet: WET_PLASTIC,
    macro: [0.1, 0.1, 1.2, 0.2],
  }),
  cardboard: materialDef("cardboard", {
    wet: [0.4, 0.75, 0.6, 0],
  }),
  rope: materialDef("rope", {
    macro: MACRO_FINE,
  }),
  tire: materialDef("tire", {
    wet: [0.1, 0.6, 0.6, 0.3],
    macro: MACRO_FINE,
  }),
  glass: materialDef("glass", {
    tint: 3,
    transparent: true,
    wet: WET_NONE,
    macro: MACRO_NONE,
  }),
  glass_dirty: materialDef("glass_dirty", {
    tint: 3,
    transparent: true,
    wet: WET_NONE,
    macro: MACRO_NONE,
  }),
  hull_paint: materialDef("hull", {
    tint: 1,
    color: 1778219,
    wet: WET_PAINT,
    macro: MACRO_CONCRETE,
  }),
  hull_red: materialDef("hull", {
    tint: 1,
    color: 6233880,
    wet: WET_PAINT,
    macro: MACRO_CONCRETE,
  }),
  water_dark: materialDef("water", {
    wet: WET_NONE,
    macro: MACRO_NONE,
  }),
};
export const FALLBACK_MATERIAL = materialDef("metal", {
  tint: 1,
  color: 8027520,
  wet: WET_METAL,
});
export const GLSL_MAT_VARYINGS = `
varying vec3 vSlPos;
#ifdef SL_TRIPLANAR
varying vec3 vSlONrm; varying vec3 vSlAx; varying vec3 vSlAy;
#endif
`;
export const GLSL_MAT_VERTEX = `
#ifdef SL_TRIPLANAR
  vSlPos = position; vSlONrm = normal;
  vec3 slAx = vec3(1.0, 0.0, 0.0), slAy = vec3(0.0, 1.0, 0.0);
  #ifdef USE_SKINNING
    slAx = (skinMatrix * vec4(slAx, 0.0)).xyz; slAy = (skinMatrix * vec4(slAy, 0.0)).xyz;
  #endif
  #ifdef USE_INSTANCING
    slAx = mat3(instanceMatrix) * slAx; slAy = mat3(instanceMatrix) * slAy;
  #endif
  vSlAx = normalize(mat3(modelViewMatrix) * slAx); vSlAy = normalize(mat3(modelViewMatrix) * slAy);
#else
  vec4 slWP = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    slWP = instanceMatrix * slWP;
  #endif
  vSlPos = (modelMatrix * slWP).xyz;
#endif
`;
export const GLSL_MAT_PARS = `
uniform float uSlWet; uniform vec4 uSlWetP; uniform vec4 uSlMacro; uniform vec3 uSlUv; uniform vec2 uSlX;
varying vec3 vSlPos;
#ifdef SL_TRIPLANAR
varying vec3 vSlONrm; varying vec3 vSlAx; varying vec3 vSlAy;
vec3 slTw; vec2 slUx; vec2 slUy; vec2 slUz;
vec4 slTri(sampler2D t){ return texture2D(t, slUx) * slTw.x + texture2D(t, slUy) * slTw.y + texture2D(t, slUz) * slTw.z; }
#endif
vec4 slORM; vec2 slUv; float slWetK = 0.0; float slUp = 0.0; float slMac = 0.5; float slMac2 = 0.5; float slBead = 0.0;
float slH(vec3 p){ p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float slN3(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(slH(i), slH(i + vec3(1.0, 0.0, 0.0)), f.x), mix(slH(i + vec3(0.0, 1.0, 0.0)), slH(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(slH(i + vec3(0.0, 0.0, 1.0)), slH(i + vec3(1.0, 0.0, 1.0)), f.x), mix(slH(i + vec3(0.0, 1.0, 1.0)), slH(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
`;
export const GLSL_MAT_MAP = `
#ifdef SL_TRIPLANAR
  { vec3 slOn = normalize(vSlONrm); vec3 slW3 = pow(abs(slOn), vec3(6.0)); slTw = slW3 / (slW3.x + slW3.y + slW3.z);
    vec3 slQ = vSlPos * uSlUv.z; slUx = slQ.zy; slUy = slQ.xz; slUz = slQ.xy; }
  vec4 sampledDiffuseColor = slTri(map);
  slORM = slTri(roughnessMap);
#else
  slUv = vMapUv * uSlUv.xy;
  vec4 sampledDiffuseColor = texture2D(map, slUv);
  slORM = texture2D(roughnessMap, slUv);
#endif
#ifdef SL_FX
  {
    #ifdef FLAT_SHADED
      vec3 slVN = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
    #else
      vec3 slVN = normalize(vNormal);
      #ifdef DOUBLE_SIDED
        slVN *= gl_FrontFacing ? 1.0 : -1.0;
      #endif
    #endif
    vec3 slWN = inverseTransformDirection(slVN, viewMatrix);
    vec3 slMp = vSlPos * uSlMacro.z;
    slMac = slN3(slMp); slMac2 = slN3(slMp * 3.7 + 11.3);
    float slM = slMac * 0.65 + slMac2 * 0.35 - 0.5;
    sampledDiffuseColor.rgb *= 1.0 + uSlMacro.x * slM * 2.0;
    float slGr = smoothstep(0.5, 0.85, slMac * 0.6 + slMac2 * 0.4 + (1.0 - slORM.r) * 0.3) * uSlMacro.w;
    sampledDiffuseColor.rgb *= 1.0 - slGr * 0.35;
    #if SL_TINT == 1
      sampledDiffuseColor.a *= 1.0 - slGr * 0.2;
    #endif
    // rain wetness: strongest on up-facing faces, streaky on verticals, none underneath
    slUp = smoothstep(0.15, 0.85, slWN.y);
    float slExpo = smoothstep(-0.4, -0.05, slWN.y);
    float slStreak = 0.0;
    #ifndef SL_TRIPLANAR
      float slSc = vSlPos.x + vSlPos.z;
      slStreak = slN3(vec3(slSc * 9.0, vSlPos.y * 0.55, slSc * 0.7 + 3.0)) * slN3(vec3(slSc * 29.0, vSlPos.y * 1.1, 7.0));
      slStreak = smoothstep(0.12, 0.42, slStreak) * smoothstep(0.3, 0.7, slN3(vec3(slSc * 1.1, vSlPos.y * 0.25, 1.7)));
    #endif
    float slW = uSlWet * uSlX.x * slExpo;
    slWetK = slW * mix(uSlWetP.z * (0.55 + 0.9 * slStreak), 0.75 + 0.5 * slMac, slUp);
    #ifndef SL_TRIPLANAR
      { float slLow = smoothstep(0.5, 0.0, vSlPos.y) * (1.0 - slUp) * slExpo;        // damp, splashed band where things meet the ground
        slWetK += slW * slLow * 0.6;
        float slLg = 1.0 - slLow * min(uSlMacro.w, 0.5) * 0.45;
        sampledDiffuseColor.rgb *= slLg;
        #if SL_TINT == 1
          sampledDiffuseColor.a *= slLg;
        #endif
      }
    #endif
    slWetK = clamp(slWetK, 0.0, 1.0);
    float slBf = clamp(1.0 - length(fwidth(vSlPos)) * 120.0, 0.0, 1.0);
    if (uSlWetP.w > 0.0 && slBf > 0.0) {
      float slB = slN3(vSlPos * 170.0) * 0.6 + slN3(vSlPos * 410.0 + 5.0) * 0.4;
      slBead = smoothstep(0.6, 0.68, slB) * uSlWetP.w * slW * slBf * (0.4 + 0.6 * slUp + 0.5 * slStreak);
    }
  }
#endif
#if SL_TINT == 1
  diffuseColor.rgb = sampledDiffuseColor.rgb + diffuse * sampledDiffuseColor.a;
#elif SL_TINT == 2
  { float slL = clamp(dot(sampledDiffuseColor.rgb, vec3(0.3333)) / 0.19, 0.55, 1.35);
    diffuseColor.rgb = mix(sampledDiffuseColor.rgb, diffuse * slL, sampledDiffuseColor.a * 0.96); }
#elif SL_TINT == 3
  diffuseColor *= sampledDiffuseColor;
#else
  diffuseColor.rgb *= sampledDiffuseColor.rgb;
#endif
#ifdef SL_FX
  { float slLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    diffuseColor.rgb = mix(vec3(slLum), diffuseColor.rgb, 1.0 + 0.25 * slWetK * uSlWetP.x * 2.0);
    diffuseColor.rgb *= 1.0 - uSlWetP.x * slWetK; }
#endif
#ifdef SL_ACUT
  // alpha-tested wire mesh that survives distance: wires stay ~1 px wide through the mips (lowered threshold),
  // then dissolve into a stable ~1/3-coverage dither veil once the diamonds themselves are sub-pixel.
  { vec2 slFw = fwidth(slUv) * 512.0; float slLod = log2(max(max(slFw.x, slFw.y), 1e-4));
    float slThC = 0.5 * exp2(-clamp(slLod - 1.0, 0.0, 4.0));
    float slIgn = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    float slTh = mix(slThC, 0.05 + slIgn * 0.80, smoothstep(3.5, 5.5, slLod));
    diffuseColor.a = sampledDiffuseColor.a > slTh ? 1.0 : 0.0;
    // sub-pixel wires: the surviving fragments stand in for a much thinner wire, so dim them (no white sheets in the sun)
    diffuseColor.rgb *= mix(1.0, 0.45, smoothstep(1.5, 4.5, slLod)); }
#endif
`;
export const GLSL_MAT_ROUGHNESS = `
float roughnessFactor = roughness * slORM.g;
#ifdef SL_FX
  roughnessFactor += uSlMacro.y * ((slMac2 - 0.5) * 1.4 + (slMac - 0.5) * 0.8);
  roughnessFactor = mix(roughnessFactor, roughnessFactor * uSlWetP.y, slWetK);
  roughnessFactor = mix(roughnessFactor, 0.05, slBead);
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) && !defined( SL_TRIPLANAR )
  { float slNl = length(texture2D(normalMap, slUv).xyz * 2.0 - 1.0);
    roughnessFactor = sqrt(roughnessFactor * roughnessFactor + clamp(1.0 - slNl, 0.0, 1.0) * 0.6); }
#endif
roughnessFactor = clamp(roughnessFactor, 0.045, 1.0);
`;
export const GLSL_MAT_METALNESS = `
float metalnessFactor = metalness * slORM.b;
`;
export const GLSL_MAT_NORMAL = `
#ifdef SL_TRIPLANAR
  { vec3 slOn = normalize(vSlONrm);
    vec3 slTx = texture2D(normalMap, slUx).xyz * 2.0 - 1.0, slTy = texture2D(normalMap, slUy).xyz * 2.0 - 1.0, slTz = texture2D(normalMap, slUz).xyz * 2.0 - 1.0;
    slTx.xy *= normalScale; slTy.xy *= normalScale; slTz.xy *= normalScale;
    slTx = vec3(slTx.xy + slOn.zy, abs(slTx.z) * slOn.x); slTy = vec3(slTy.xy + slOn.xz, abs(slTy.z) * slOn.y); slTz = vec3(slTz.xy + slOn.xy, abs(slTz.z) * slOn.z);
    vec3 slNo = normalize(slTx.zyx * slTw.x + slTy.xzy * slTw.y + slTz.xyz * slTw.z);
    vec3 slA = normalize(vSlAx), slB = normalize(vSlAy); vec3 slC = cross(slA, slB);
    normal = normalize(slA * slNo.x + slB * slNo.y + slC * slNo.z);
    #ifdef DOUBLE_SIDED
      normal *= faceDirection;
    #endif
  }
#elif defined( USE_NORMALMAP_TANGENTSPACE )
  { vec3 mapN = texture2D(normalMap, slUv).xyz * 2.0 - 1.0;
    mapN.xy *= normalScale * (1.0 - 0.45 * slWetK * slUp);
    normal = normalize(tbn * mapN); }
#endif
`;
export const GLSL_MAT_AO = ShaderChunk.aomap_fragment.replace(
  "texture2D( aoMap, vAoMapUv ).r",
  "slORM.r",
);
