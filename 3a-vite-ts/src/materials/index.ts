// GPU-baked procedural PBR materials and the material registry.
import type { Material, Texture } from "three";
import {
  Color,
  DoubleSide,
  GLSL3,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from "three";
import type { GameContext } from "../types/context";
import {
  COPY_FRAG,
  NORMAL_FROM_HEIGHT_FRAG,
  SURFACES,
  SURF_FRAG_HEAD,
  SURF_FRAG_MAIN,
  SURF_VERT,
} from "./surfaces";
import { createTextureBaker } from "./bake";
import {
  FALLBACK_MATERIAL,
  GLSL_MAT_AO,
  GLSL_MAT_MAP,
  GLSL_MAT_METALNESS,
  GLSL_MAT_NORMAL,
  GLSL_MAT_PARS,
  GLSL_MAT_ROUGHNESS,
  GLSL_MAT_VARYINGS,
  GLSL_MAT_VERTEX,
  MATERIAL_DEFS,
  SURFACE_SPECS,
} from "./library";

export function applyPatch(
  i: any,
  e: {
    uSlWet: { value: number };
    uSlWetP: { value: Vector4 };
    uSlMacro: { value: Vector4 };
    uSlUv: { value: Vector3 };
    uSlX: { value: Vector2 };
  },
) {
  Object.assign(i.uniforms, e);
  i.vertexShader = i.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
` + GLSL_MAT_VARYINGS,
    )
    .replace(
      "#include <project_vertex>",
      `#include <project_vertex>
` + GLSL_MAT_VERTEX,
    );
  i.fragmentShader = i.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
` + GLSL_MAT_PARS,
    )
    .replace("#include <map_fragment>", GLSL_MAT_MAP)
    .replace("#include <roughnessmap_fragment>", GLSL_MAT_ROUGHNESS)
    .replace("#include <metalnessmap_fragment>", GLSL_MAT_METALNESS)
    .replace("#include <normal_fragment_maps>", GLSL_MAT_NORMAL)
    .replace("#include <aomap_fragment>", GLSL_MAT_AO);
}
export async function createMaterials(i: GameContext) {
  let e = i.renderer || (i.render && i.render.renderer),
    t = i.params || {},
    n = +(t.tex || 0) || (i.quality && i.quality.tex) || 1024,
    s = Math.min(n, 1024),
    o = Math.min(
      8,
      e.capabilities.getMaxAnisotropy ? e.capabilities.getMaxAnisotropy() : 1,
    ),
    r = {
      wet: {
        value: t.wet !== undefined ? +t.wet : 1,
      },
    },
    a = {
      sets: 0,
      bytes: 0,
      ms: 0,
    },
    l = new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    c = new Scene(),
    u = new Mesh(new PlaneGeometry(2, 2));
  u.frustumCulled = false;
  c.add(u);
  let h = new Map(),
    f = new Map(),
    p = new Map(),
    d = 0,
    v: { normal: RawShaderMaterial; copy: RawShaderMaterial } | null = null,
    g = (
      O: string,
      q:
        | {
            tH: { value: null };
            uK: { value: Vector2 };
            uTexel: { value: number };
          }
        | { tA: { value: null }; uSq: { value: number } }
        | {
            uP: { value: Vector4 };
            uSeed: { value: number };
            uTexel: { value: number };
          },
    ) =>
      new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: SURF_VERT,
        fragmentShader: O,
        uniforms: q,
        depthTest: false,
        depthWrite: false,
      });
  function x() {
    if (!v) {
      v = {
        normal: g(NORMAL_FROM_HEIGHT_FRAG, {
          tH: {
            value: null,
          },
          uK: {
            value: new Vector2(),
          },
          uTexel: {
            value: 0,
          },
        }),
        copy: g(COPY_FRAG, {
          tA: {
            value: null,
          },
          uSq: {
            value: 0,
          },
        }),
      };
    }
    return v;
  }
  function y(
    O: WebGLRenderTarget<Texture> | WebGLRenderTarget<Texture[]> | null,
    q: Material | Material[],
  ) {
    u.material = q;
    e.setRenderTarget(O);
    e.render(c, l);
  }
  function b(O: number, q: boolean) {
    let U = new WebGLRenderTarget(O, O, {
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: LinearMipmapLinearFilter,
      magFilter: LinearFilter,
      wrapS: RepeatWrapping,
      wrapT: RepeatWrapping,
      anisotropy: o,
      colorSpace: q ? SRGBColorSpace : NoColorSpace,
    });
    a.bytes += O * O * 4 * 1.34;
    return U;
  }
  function m(O: any) {
    let q = Math.round(s * O.size);
    if (O.hero && n >= 2048) {
      q = 2048;
    }
    return Math.max(32, q);
  }
  function A(O: string) {
    let q = p.get(O);
    if (q) {
      return q;
    }
    let U = SURFACE_SPECS[O],
      T = performance.now(),
      D = m(U),
      C = Array.isArray(U.tile) ? U.tile : [U.tile, U.tile],
      G = h.get(D);
    if (!G) {
      G = new WebGLRenderTarget(D, D, {
        count: 3,
        depthBuffer: false,
        generateMipmaps: false,
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        wrapS: RepeatWrapping,
        wrapT: RepeatWrapping,
      });
      h.set(D, G);
    }
    let j = f.get(U.fn);
    if (!j) {
      j = g(
        SURF_FRAG_HEAD +
          SURFACES[U.fn as keyof typeof SURFACES] +
          SURF_FRAG_MAIN,
        {
          uP: {
            value: new Vector4(),
          },
          uSeed: {
            value: 0,
          },
          uTexel: {
            value: 0,
          },
        },
      );
      f.set(U.fn, j);
    }
    let N = U.p || [];
    j.uniforms.uP.value.set(N[0] || 0, N[1] || 0, N[2] || 0, N[3] || 0);
    j.uniforms.uSeed.value = U.seed || 0;
    j.uniforms.uTexel.value = 1 / D;
    let Q = x(),
      K = e.getRenderTarget(),
      ie = e.autoClear,
      F = e.xr.enabled,
      X = e.shadowMap.autoUpdate;
    e.autoClear = true;
    e.xr.enabled = false;
    e.shadowMap.autoUpdate = false;
    y(G, j);
    let ne = b(D, true),
      re = b(D, false),
      $ = b(D, false);
    Q.copy.uniforms.tA.value = G.textures[0];
    Q.copy.uniforms.uSq.value = 1;
    y(ne, Q.copy);
    Q.copy.uniforms.tA.value = G.textures[1];
    Q.copy.uniforms.uSq.value = 0;
    y(re, Q.copy);
    Q.normal.uniforms.tH.value = G.textures[2];
    Q.normal.uniforms.uTexel.value = 1 / D;
    Q.normal.uniforms.uK.value.set(
      (U.bump * 0.001 * D) / C[0],
      (U.bump * 0.001 * D) / C[1],
    );
    y($, Q.normal);
    e.setRenderTarget(K);
    e.autoClear = ie;
    e.xr.enabled = F;
    e.shadowMap.autoUpdate = X;
    for (let ue of [ne, re, $]) {
      ue.texture.repeat.set(1 / C[0], 1 / C[1]);
      ue.texture.name = "sl_" + O;
    }
    q = {
      key: O,
      albedo: ne.texture,
      orm: re.texture,
      normal: $.texture,
      tile: C,
      size: D,
      targets: [ne, re, $],
    };
    p.set(O, q);
    a.sets++;
    a.ms += performance.now() - T;
    d = performance.now();
    return q;
  }
  function _() {
    for (let O of h.values()) O.dispose();
    h.clear();
    for (let O of f.values()) O.dispose();
    f.clear();
  }
  let M = new Map(),
    E = new Set<any>();
  function w(
    O: any,
    q: {
      vertexColors?: any;
      triplanar?: any;
      scale?: any;
      doubleSide?: any;
      interior?: any;
      color?: any;
    } = {},
  ) {
    let U =
        O +
        "|" +
        (q.vertexColors ? "v" : "") +
        (q.triplanar ? "t" + (q.scale || 1) : "") +
        (q.doubleSide ? "d" : "") +
        (q.interior ? "i" : "") +
        (q.color !== undefined ? "c" + q.color : ""),
      T = M.get(U);
    if (T) {
      return T;
    }
    let D = MATERIAL_DEFS[O];
    if (!D) {
      if (!E.has(O)) {
        E.add(O);
        console.warn(`[mats] unknown material "${O}" \u2014 using fallback`);
      }
      D = FALLBACK_MATERIAL;
    }
    let C: any;
    try {
      C = A(D.set);
    } catch (K: any) {
      if (!E.has("gen:" + D.set)) {
        E.add("gen:" + D.set);
        console.error(
          `[mats] texture set "${D.set}" failed: ${(K && K.message) || K}`,
        );
      }
      T = new MeshStandardMaterial({
        color: q.color !== undefined ? q.color : D.tint ? D.color : 8421504,
        roughness: 0.6,
        metalness: 0,
        vertexColors: !!q.vertexColors,
      });
      T.name = O;
      M.set(U, T);
      return T;
    }
    let G = !!q.triplanar,
      j = !D.transparent && !D.alphaCut;
    T = new MeshStandardMaterial({
      map: C.albedo,
      normalMap: C.normal,
      roughnessMap: C.orm,
      metalnessMap: C.orm,
      aoMap: C.orm,
      color: q.color !== undefined ? q.color : D.color,
      roughness: D.rough,
      metalness: D.metal,
      vertexColors: !!q.vertexColors,
    });
    T.normalScale.set(D.nrm, D.nrm);
    T.name = O;
    if (q.doubleSide || D.side === 2) {
      T.side = DoubleSide;
    }
    if (D.transparent) {
      T.transparent = true;
      T.depthWrite = false;
      T.envMapIntensity = 1.4;
    }
    if (D.alphaCut) {
      T.alphaTest = 0.5;
    }
    T.defines = {
      ...T.defines,
      SL_TINT: D.tint,
    };
    if (G) {
      T.defines.SL_TRIPLANAR = "";
    }
    if (j) {
      T.defines.SL_FX = "";
    }
    if (D.alphaCut && !G) {
      T.defines.SL_ACUT = "";
    }
    let N = {
      uSlWet: r.wet,
      uSlWetP: {
        value: new Vector4(...D.wet),
      },
      uSlMacro: {
        value: new Vector4(...D.macro),
      },
      uSlUv: {
        value: new Vector3(1, 1, G ? (q.scale || 1) / C.tile[0] : C.size),
      },
      uSlX: {
        value: new Vector2(q.interior ? 0.12 : 1, 0),
      },
    };
    T.userData.sl = N;
    T.userData.set = C.key;
    T.userData.tile = C.tile;
    if (q.interior) {
      T.userData.interior = true;
    }
    T.onBeforeCompile = (K: any) => applyPatch(K, N);
    let Q =
      "sl2|" +
      D.tint +
      (G ? "t" : "") +
      (j ? "f" : "") +
      (D.alphaCut ? "a" : "");
    T.customProgramCacheKey = () => Q;
    M.set(U, T);
    return T;
  }
  function S(O = 16777215, q = 4) {
    let U = "em|" + O + "|" + q;
    if (M.has(U)) {
      return M.get(U);
    }
    let T = new MeshBasicMaterial({
      color: new Color(O).multiplyScalar(q),
      toneMapped: true,
    });
    T.name = "emissive";
    M.set(U, T);
    return T;
  }
  let z = createTextureBaker(i, o);
  return {
    get: w,
    emissive: S,
    decal: z.decal,
    label: z.label,
    number: z.number,
    names: Object.keys(MATERIAL_DEFS),
    decalNames: z.names,
    uniforms: r,
    update(O: any) {
      if (h.size && performance.now() - d > 4e3) {
        _();
      }
    },
    prewarm(O: any) {
      for (let q of O || Object.keys(MATERIAL_DEFS)) w(q);
    },
    stats() {
      return {
        sets: a.sets,
        textureMB: +(a.bytes / 1048576).toFixed(1),
        genMs: +a.ms.toFixed(0),
        decalMB: +(z.bytes() / 1048576).toFixed(1),
      };
    },
    tileOf(O: string | number) {
      let q = MATERIAL_DEFS[O];
      return q ? SURFACE_SPECS[q.set].tile : 1;
    },
  };
}
const TRIPLANAR_PREVIEW_MATS = new Set([
  "gunmetal",
  "anodized_black",
  "polymer_black",
  "polymer_tan",
  "rubber",
  "carbon",
  "glove_fabric",
  "armor_white",
  "armor_orange",
]);
function worldUvSphereGeo(i: number) {
  let e = new SphereGeometry(i, 48, 32),
    t = e.attributes.uv;
  for (let n = 0; n < t.count; n++)
    t.setXY(n, t.getX(n) * 2 * Math.PI * i, t.getY(n) * Math.PI * i);
  return e;
}
function worldUvPlaneGeo(i: number, e: number) {
  let t = new PlaneGeometry(i, e),
    n = t.attributes.uv;
  for (let s = 0; s < n.count; s++) n.setXY(s, n.getX(s) * i, n.getY(s) * e);
  return t;
}
export function materialsShowcase(i: GameContext) {
  let e = i.mats,
    t = new Group();
  i.scene.add(t);
  let n = i.params.only
      ? String(i.params.only).split(",").filter(Boolean)
      : null,
    s = !n || n.includes("decals"),
    o = n ? n.filter((g) => g !== "decals") : e.names,
    r = n ? Math.max(1, o.length) : 10,
    a = 1.9,
    l = 3.6,
    c = worldUvSphereGeo(0.42),
    u = worldUvPlaneGeo(1.5, 1.5),
    h = worldUvPlaneGeo(1.5, 1.5).rotateX(-Math.PI / 2),
    f = (
      g: PlaneGeometry | SphereGeometry,
      x: any,
      y: number,
      b: number,
      m: number,
    ) => {
      let A = new Mesh(g, x);
      A.position.set(y, b, m);
      A.castShadow = A.receiveShadow = true;
      t.add(A);
      return A;
    };
  o.forEach((g, x) => {
    let y = ((x % r) - (r - 1) / 2) * a,
      b = -Math.floor(x / r) * l,
      m = e.get(
        g,
        g.startsWith("glass") || g === "chainlink"
          ? {
              doubleSide: true,
            }
          : {},
      );
    f(u, m, y, 0.76, b);
    f(h, m, y, 0.012, b + 1.1);
    f(
      c,
      TRIPLANAR_PREVIEW_MATS.has(g)
        ? e.get(g, {
            triplanar: true,
          })
        : m,
      y,
      0.46,
      b + 1.25,
    );
  });
  let p: number[] | undefined,
    d: number[] | undefined,
    v = r * a;
  if (n && o.length) {
    p = [0.25 * v, 1.5, 2.6 + v * 0.42];
    d = [0, 0.62, 0.5];
  } else {
    p = [0, 9.5, 12];
    d = [0, 0, -7];
  }
  if (s) {
    let g = n && !o.length ? 0 : v / 2 + 5.5,
      x = 8.4,
      y = 3.3,
      b = f(worldUvPlaneGeo(x, y), e.get("paint_blue"), g, y / 2, -1),
      m = f(worldUvPlaneGeo(x, y), e.get("concrete"), g, y / 2, -1.01);
    m.position.x += x;
    let A = e.decalNames,
      _ = -x / 2 + 0.25,
      M = y - 0.75,
      E = 0.62,
      w = (z: any, H: number, O?: any) => {
        let q = H * z.aspect;
        if (_ + q > x * 1.5 - 0.2) {
          return;
        }
        if (_ < x / 2 && _ + q > x / 2 - 0.15) {
          _ = x / 2 + 0.25;
        }
        let U = new Mesh(new PlaneGeometry(q, H), z.material);
        U.position.set(g + _ + q / 2, M + H / 2, -0.996);
        U.renderOrder = 2;
        t.add(U);
        _ += q + 0.14;
      };
    [A.slice(0, 9), A.slice(9, 17), A.slice(17)].forEach((z, H) => {
      _ = -x / 2 + 0.25;
      M = y - 0.75 - H * 0.78;
      z.forEach((O) => w(e.decal(O), E));
    });
    _ = -x / 2 + 0.25;
    M = y - 0.75 - 3 * 0.78 - 0.05;
    w(
      e.label("几猫港区  B4-0271", {
        color: "white",
      }),
      0.3,
    );
    w(
      e.label("最大总重 30480 千克", {
        color: "yellow",
        distress: 0.6,
      }),
      0.22,
    );
    w(
      e.label("危险", {
        color: "red",
        distress: 0.2,
      }),
      0.3,
    );
    w(
      e.label("请勿靠近", {
        color: "black",
        font: "sans",
      }),
      0.25,
    );
    w(e.number(4), 0.3);
    w(e.number(7), 0.3);
    if (n && !o.length) {
      p = [x / 2, 1.7, 7.2];
      d = [x / 2, 1.6, -1];
    }
  }
  if (i.params.wet !== undefined) {
    e.uniforms.wet.value = +i.params.wet;
  }
  console.log("[mats] " + JSON.stringify(e.stats()));
  return {
    cam: p,
    target: d,
    update() {},
  };
}
