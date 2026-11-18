// Renderer, scene, cameras, sky/env, shadows and post-processing frame loop.
import type { Material, Object3D, Object3DEventMap, Texture } from "three";
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CubeCamera,
  DepthTexture,
  DirectionalLight,
  Group,
  HalfFloatType,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  NoToneMapping,
  PCFShadowMap,
  PCFSoftShadowMap,
  PMREMGenerator,
  PerspectiveCamera,
  PointLight,
  RGBAFormat,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  UnsignedIntType,
  Vector2,
  Vector3,
  WebGLCubeRenderTarget,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import type { QualityName, QualityPreset } from "../config/quality";
import { QUALITY_PRESETS } from "../config/quality";
import type { GameContext } from "../types/context";
import {
  LAYER_VIEWMODEL,
  LAYER_WORLD,
  PLAYER_DIMS,
  SUN,
} from "../config/world";
import { boxGeo, makeMesh, roundedBoxGeo } from "../utils/geometry";
import { createNoiseTexture } from "./noise";
import { createSkyEnvMap, createSkyMesh } from "./sky";
import {
  fitSunShadow,
  installPcssShadows,
  restoreShadowChunk,
} from "./shadows";
import { POST_TAG, SHADOW_TAG_ALIAS, createPostPipeline } from "./post";

const ENV_INTENSITY_OUTDOOR = 2;
const ENV_INTENSITY_INTERIOR = 1;
export async function createRender(i: GameContext) {
  let e = i.params || {},
    t = document.getElementById("view") as HTMLCanvasElement,
    n = new WebGLRenderer({
      canvas: t,
      antialias: false,
      powerPreference: "high-performance",
      alpha: false,
      depth: true,
      stencil: false,
    });
  n.outputColorSpace = SRGBColorSpace;
  n.toneMapping = NoToneMapping;
  n.toneMappingExposure = 1;
  n.shadowMap.enabled = true;
  n.shadowMap.type = PCFShadowMap;
  n.shadowMap.autoUpdate = false;
  n.autoClear = false;
  n.info.autoReset = false;
  n.setClearColor(0, 1);
  let s = n.getContext(),
    o = {
      post: false,
      shadow: false,
      sky: false,
      other: 0,
    };
  n.debug.onShaderError = (ie, F, X, ne) => {
    let re = "",
      $ = "";
    try {
      re = ie.getShaderSource(ne) || "";
      $ =
        (ie.getShaderInfoLog(ne) || "") +
        " " +
        (ie.getShaderInfoLog(X) || "") +
        " " +
        (ie.getProgramInfoLog(F) || "");
    } catch {}
    let ue = "material";
    if (re.includes(POST_TAG)) {
      o.post = true;
      ue = "post pass " + (re.match(/SALTLINE_POST (\S+)/) || [])[1];
    } else if (re.includes("SALTLINE_SKY")) {
      o.sky = true;
      ue = "sky";
    } else if (re.includes(SHADOW_TAG_ALIAS)) {
      o.shadow = true;
      ue = "material (soft shadow chunk active)";
    } else {
      o.other++;
    }
    console.error(`[render] shader error in ${ue}: ${$.trim().slice(0, 700)}`);
  };
  let r = new Scene(),
    a = new PerspectiveCamera(PLAYER_DIMS.fov, 16 / 9, 0.08, 900);
  a.layers.set(LAYER_WORLD);
  a.rotation.order = "YXZ";
  r.add(a);
  let l = new PerspectiveCamera(PLAYER_DIMS.viewFov, 16 / 9, 0.01, 10);
  l.layers.set(LAYER_VIEWMODEL);
  let c = createNoiseTexture(),
    u = createSkyMesh(c);
  r.add(u.mesh);
  let h = new DirectionalLight(SUN.color, SUN.intensity);
  h.name = "sun";
  h.castShadow = true;
  let f = fitSunShadow(
      h,
      new Vector3(-41, -0.2, -33),
      new Vector3(37, 32, 31),
      new Vector3(-41, -3, -64),
      new Vector3(72, 36, 34),
    ),
    p = () => Math.min(i.quality.shadow || 2048, n.capabilities.maxTextureSize);
  h.shadow.mapSize.set(p(), p());
  h.shadow.bias = -12e-5;
  h.shadow.normalBias = 0.02;
  h.shadow.radius = 1;
  h.shadow.autoUpdate = true;
  r.add(h, h.target);
  let d = false;
  try {
    d = installPcssShadows(f, {
      taps: i.quality.name === "low" ? 10 : 16,
      searchTaps: 8,
    });
  } catch (ie: any) {
    console.warn("[render] soft shadows unavailable: " + ie);
  }
  let v = 6,
    g: PointLight[] = [];
  for (let ie = 0; ie < v; ie++) {
    let F = new PointLight(16777215, 0, 12, 2);
    F.userData = {
      busy: false,
      ttl: 0,
      dur: 0,
      peak: 0,
      persistent: false,
    };
    r.add(F);
    g.push(F);
  }
  let x = {
      flash(ie: Vector3, F = 16763008, X = 30, ne = 10, re = 0.06) {
        let $ =
          g.find((ue) => !ue.userData.busy) ||
          g
            .filter((ue) => !ue.userData.persistent)
            .sort((ue, me) => ue.userData.ttl - me.userData.ttl)[0];
        if ($) {
          $.position.copy(ie);
          $.color.set(F);
          $.distance = ne;
          $.intensity = X;
          Object.assign($.userData, {
            busy: true,
            ttl: re,
            dur: re,
            peak: X,
            persistent: false,
          });
        }
      },
      acquire() {
        let ie = g.find((F) => !F.userData.busy);
        return ie
          ? ((ie.userData.busy = true),
            (ie.userData.persistent = true),
            (ie.intensity = 0),
            {
              light: ie,
              release() {
                ie.userData.busy = false;
                ie.userData.persistent = false;
                ie.intensity = 0;
              },
            })
          : null;
      },
      update(ie: number) {
        for (let F of g) {
          let X = F.userData;
          if (X.busy && !X.persistent) {
            X.ttl -= ie;
            if (X.ttl <= 0) {
              X.busy = false;
              F.intensity = 0;
            } else {
              F.intensity = X.peak * (X.ttl / X.dur);
            }
          }
        }
      },
    },
    y: WebGLRenderTarget<Texture> | null = null;
  try {
    y = createSkyEnvMap(n, u);
    r.environment = y.texture;
    r.environmentIntensity = ENV_INTENSITY_OUTDOOR;
  } catch (ie: any) {
    console.error(
      "[render] environment capture failed: " + ((ie && ie.stack) || ie),
    );
  }
  let b = new DepthTexture(4, 4);
  b.type = UnsignedIntType;
  b.minFilter = b.magFilter = NearestFilter;
  let m = new WebGLRenderTarget(4, 4, {
      type: HalfFloatType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      depthTexture: b,
      samples: i.quality.msaa | 0,
      generateMipmaps: false,
    }),
    A: any = null,
    _ = e.post !== "0";
  if (e.ao === "0") {
    i.quality.ao = false;
  }
  if (e.vol === "0") {
    i.quality.volSteps = 0;
  }
  if (e.bloom === "0") {
    i.quality.bloom = false;
  }
  if (e.mb === "1") {
    i.quality.motionBlur = true;
  }
  if (_) {
    try {
      A = createPostPipeline(n, i, {
        noiseTex: c,
      });
    } catch (ie: any) {
      _ = false;
      console.error(
        "[render] post chain failed to initialise, using forward fallback: " +
          ((ie && ie.stack) || ie),
      );
    }
  }
  let M = !!(e.shot || e.show),
    E = false,
    w = {
      t: 99,
      power: 0,
      value: 0,
    };
  if (i.events && i.events.on) {
    i.events.on("thunder", (ie) => {
      w.t = 0;
      w.power = Math.min(1, (ie && ie.intensity) || 0.6);
      let F = Math.PI * (0.55 + Math.random() * 0.9);
      u.material.uniforms.uFlashDir.value
        .set(
          Math.cos(F),
          0.35 + Math.random() * 0.3,
          Math.sin(F) * (Math.random() < 0.5 ? -1 : 1),
        )
        .normalize();
    });
  }
  let SInit = {
      scale: 1,
      enabled: !(e.shot || e.show || e.dynres === "0"),
      acc: 0,
      n: 0,
      settle: 3.5,
      upWait: 4,
      upDelay: 4,
    },
    S = SInit as typeof SInit & { floorHits: any };
  function z(ie: number) {
    if (!S.enabled || !_ || ie > 1500) {
      return;
    }
    S.settle -= ie / 1e3;
    S.upWait -= ie / 1e3;
    if (S.settle > 0) {
      S.acc = 0;
      S.n = 0;
      return;
    }
    S.acc += ie;
    S.n++;
    if (S.n < 45 && S.acc < 900) {
      return;
    }
    let F = S.acc / S.n;
    S.acc = 0;
    S.n = 0;
    let X = S.scale;
    if (F > 21.5 && X > 0.6) {
      X = F > 45 ? 0.6 : Math.max(0.6, X - (F > 30 ? 0.2 : 0.1));
      S.upDelay = Math.min(60, S.upDelay * 2);
      S.upWait = S.upDelay;
    } else if (F < 17.4 && X < 1 && S.upWait <= 0) {
      X = Math.min(1, X + 0.1);
      S.upWait = 2;
    } else if (F < 17.4 && X >= 1) {
      S.upDelay = 4;
    }
    X = Math.round(X * 10) / 10;
    if (X <= 0.6 && F > 26) {
      S.floorHits = (S.floorHits || 0) + 1;
      let ne = (
        {
          ultra: "high",
          high: "medium",
          medium: "low",
        } as Record<string, QualityName | undefined>
      )[i.quality.name];
      if (S.floorHits >= 2 && ne && QUALITY_PRESETS[ne]) {
        S.floorHits = 0;
        S.scale = 0.8;
        S.settle = 2;
        S.upDelay = 4;
        console.log(
          "[render] frame time " +
            F.toFixed(0) +
            " ms at minimum scale: dropping quality to " +
            ne,
        );
        try {
          N.setQuality({
            ...QUALITY_PRESETS[ne],
          });
          i.events.emit("quality:auto", {
            name: ne,
          });
        } catch {}
        return;
      }
    } else {
      S.floorHits = 0;
    }
    if (X !== S.scale) {
      S.scale = X;
      S.settle = 1;
      N.resize();
    }
  }
  let H: any[] = [],
    O = {} as Record<string, number>,
    q = (ie: string, F: string) => {
      if (!O[ie]) {
        O[ie] = 1;
        console.error(F);
      }
    },
    U = {
      calls: 0,
      tris: 0,
    },
    T = 0,
    D = 0;
  function C() {
    a.updateMatrixWorld(true);
    l.matrixAutoUpdate = false;
    l.matrixWorldAutoUpdate = false;
    l.matrixWorld.copy(a.matrixWorld);
    l.matrixWorldInverse.copy(l.matrixWorld).invert();
  }
  function G() {
    if (n.toneMapping !== ACESFilmicToneMapping) {
      n.toneMapping = ACESFilmicToneMapping;
    }
    n.toneMappingExposure =
      0.6 * N.exposure * (1 - Math.min(1, Math.max(0, N.post.fade)));
    n.setRenderTarget(null);
    n.clear();
    n.shadowMap.needsUpdate = true;
    n.render(r, a);
    n.clearDepth();
    n.render(r, l);
  }
  function j(ie: number) {
    if (n.toneMapping !== NoToneMapping) {
      n.toneMapping = NoToneMapping;
    }
    n.toneMappingExposure = 1;
    n.setRenderTarget(m);
    n.clear(true, true, false);
    if (
      i.quality.name === "ultra" ||
      e.shot ||
      (T & 1) === 0 ||
      !h.shadow.map
    ) {
      n.shadowMap.needsUpdate = true;
    }
    n.render(r, a);
    if (E) {
      A.copyDepth(b);
      n.setRenderTarget(m);
    }
    s.depthRange(0, 0.05);
    let F = r.environmentIntensity,
      X = r.environment,
      ne =
        N.interiorEnv &&
        i.level &&
        i.level.interiorBoxes &&
        i.level.interiorBoxes[0],
      re = !!(
        ne &&
        ne.min &&
        a.position.x > ne.min.x &&
        a.position.x < ne.max.x &&
        a.position.z > ne.min.z &&
        a.position.z < ne.max.z &&
        a.position.y < ne.max.y
      );
    if (re) {
      r.environment = N.interiorEnv;
    }
    r.environmentIntensity =
      F *
      (re ? ENV_INTENSITY_INTERIOR / ENV_INTENSITY_OUTDOOR : 1) *
      (N.viewFill || 1.35);
    try {
      n.render(r, l);
    } finally {
      s.depthRange(0, 1);
      r.environmentIntensity = F;
      r.environment = X;
    }
    A.run({
      hdr: m,
      camera: a,
      sun: h,
      dt: ie,
      post: N.post,
      exposure: N.exposure,
      time: i.time ? i.time.t : T / 60,
      fast: M,
      thunder: w.value,
    });
    n.setRenderTarget(null);
    if (o.post) {
      throw new Error("a post shader failed to compile");
    }
  }
  let NInit = {
      renderer: n,
      scene: r,
      camera: a,
      viewCamera: l,
      sun: h,
      sky: u.mesh,
      sunDir: SUN.dir.clone(),
      lightPool: x,
      post: {
        damage: 0,
        lowHealth: 0,
        ads: 0,
        flash: 0,
        fade: 0,
        saturation: 1,
        focusDist: 0,
        shake: 0,
        wet: 1,
      },
      exposure: 1,
      env: y ? y.texture : null,
      interiorEnv: null as any,
      resolution: new Vector2(4, 4),
      depthTextureIsLive: false,
      tune: A ? A.TUNE : {},
      get advanced() {
        return _;
      },
      get autoExposure() {
        return A ? A.autoExposure : false;
      },
      set autoExposure(ie) {
        if (A) {
          A.autoExposure = !!ie;
        }
      },
      get depthTexture() {
        if (!A) {
          return null;
        }
        E = true;
        try {
          return A.ensureDepthCopy();
        } catch {
          return null;
        }
      },
      addPrePass(ie: any) {
        H.push(ie);
      },
      renderWorld(ie: PerspectiveCamera, F: WebGLRenderTarget<Texture>) {
        let X = n.getRenderTarget(),
          ne = n.shadowMap.needsUpdate,
          re = n.toneMapping,
          $ = n.toneMappingExposure,
          ue = ie.layers.mask;
        ie.layers.disable(LAYER_VIEWMODEL);
        n.shadowMap.needsUpdate = false;
        n.toneMapping = NoToneMapping;
        n.toneMappingExposure = 1;
        try {
          n.setRenderTarget(F);
          n.clear();
          n.render(r, ie);
        } finally {
          ie.layers.mask = ue;
          n.setRenderTarget(X);
          n.shadowMap.needsUpdate = ne;
          n.toneMapping = re;
          n.toneMappingExposure = $;
        }
      },
      async onLevelReady() {
        n.shadowMap.needsUpdate = true;
        try {
          K();
        } catch (ie: any) {
          console.error(
            "[render] interior probe failed: " + ((ie && ie.stack) || ie),
          );
        }
        try {
          if (_) {
            n.setRenderTarget(m);
          }
          await n.compileAsync(r, a);
          if (N.interiorEnv) {
            let ie = r.environment;
            r.environment = N.interiorEnv;
            try {
              n.compile(r, l);
            } finally {
              r.environment = ie;
            }
          }
        } catch {}
        n.setRenderTarget(null);
        S.settle = 3.5;
        S.acc = 0;
        S.n = 0;
      },
      setQuality(ie: QualityPreset) {
        i.quality = ie;
        let F = p();
        if (h.shadow.mapSize.x !== F) {
          h.shadow.mapSize.set(F, F);
          if (h.shadow.map) {
            h.shadow.map.dispose();
            h.shadow.map = null;
          }
        }
        let X = ie.msaa | 0;
        if (m.samples !== X) {
          m.samples = X;
          m.dispose();
        }
        if (A) {
          A.applyQuality();
        }
        N.resize();
      },
      resize() {
        let ie = Math.max(2, t!.clientWidth || window.innerWidth),
          F = Math.max(2, t!.clientHeight || window.innerHeight),
          X = Math.min(window.devicePixelRatio || 1, 2),
          ne = i.quality.scale || 1;
        if (_) {
          n.setPixelRatio(X);
          n.setSize(ie, F, false);
          let re = ne * S.scale,
            $ =
              (
                {
                  low: 1e6,
                  medium: 15e5,
                  high: 23e5,
                  ultra: 37e5,
                } as Record<string, number>
              )[i.quality.name] || 23e5,
            ue = ie * X * F * X * re * re;
          if (ue > $) {
            re *= Math.sqrt($ / ue);
          }
          let me = Math.max(16, Math.round(ie * X * re)),
            ee = Math.max(16, Math.round(F * X * re));
          m.setSize(me, ee);
          if (b.image.width !== me || b.image.height !== ee) {
            b.image.width = me;
            b.image.height = ee;
            b.needsUpdate = true;
          }
          if (A) {
            A.resize(me, ee);
          }
          N.resolution.set(me, ee);
        } else {
          n.setPixelRatio(X * ne);
          n.setSize(ie, F, false);
          N.resolution.set(Math.round(ie * X * ne), Math.round(F * X * ne));
        }
        a.aspect = l.aspect = ie / F;
        a.updateProjectionMatrix();
        l.updateProjectionMatrix();
      },
      frame(ie: number) {
        let F = performance.now();
        if (D) {
          z(F - D);
        }
        D = F;
        T++;
        n.info.reset();
        x.update(ie);
        let X = i.time ? i.time.t : T / 60;
        u.material.uniforms.uTime.value = X;
        w.t += ie;
        w.value =
          w.t < 0.9
            ? w.power *
              Math.exp(-w.t * 5) *
              (0.55 + 0.45 * Math.sin(w.t * 47) * Math.sin(w.t * 13 + 1)) *
              0.35
            : 0;
        u.material.uniforms.uFlash.value = Math.max(0, w.value);
        C();
        for (let ne of H)
          try {
            ne(n, r, a);
          } catch (re: any) {
            q("pre", "[render] pre-pass threw: " + ((re && re.stack) || re));
          }
        if (_) {
          try {
            j(ie);
          } catch (ne: any) {
            _ = false;
            try {
              s.depthRange(0, 1);
              n.setRenderTarget(null);
            } catch {}
            console.error(
              "[render] advanced pipeline disabled, falling back to forward rendering: " +
                ((ne && ne.stack) || ne),
            );
            N.resize();
          }
        }
        if (!_) {
          G();
        }
        U = {
          calls: n.info.render.calls,
          tris: n.info.render.triangles,
        };
      },
      stats() {
        let ie = n.info;
        return {
          calls: U.calls,
          tris: U.tris,
          geos: ie.memory.geometries,
          tex: ie.memory.textures,
          programs: ie.programs ? ie.programs.length : 0,
          res: [N.resolution.x, N.resolution.y],
          scale: S.scale,
          advanced: _,
          softShadows: d,
          adapt: A && e.shot ? A.readAdapt() : undefined,
        };
      },
    },
    N = NInit as typeof NInit & {
      viewFill: any;
      captureInteriorProbe: () => void;
    },
    Q: {
      cubeRT: WebGLCubeRenderTarget;
      cam: CubeCamera;
      pmrem: PMREMGenerator;
      out: any;
    } | null = null;
  function K() {
    let ie = i.level && i.level.interiorBoxes;
    if (!ie || !ie.length) {
      return;
    }
    let F = ie[0],
      X = (F.min.x + F.max.x) / 2,
      ne = (F.min.z + F.max.z) / 2,
      re = F.min.y + Math.min(2.4, (F.max.y - F.min.y) * 0.4);
    if (!Q) {
      let ee = new WebGLCubeRenderTarget(128, {
        type: HalfFloatType,
        generateMipmaps: false,
      });
      Q = {
        cubeRT: ee,
        cam: new CubeCamera(0.15, 300, ee),
        pmrem: new PMREMGenerator(n),
        out: null,
      };
      Q.cam.layers.set(LAYER_WORLD);
    }
    Q.cam.position.set(X, re, ne);
    Q.cam.updateMatrixWorld(true);
    let $ = n.toneMapping;
    n.toneMapping = NoToneMapping;
    u.material.uniforms.uEnv.value = 1;
    n.shadowMap.needsUpdate = true;
    try {
      Q.cam.update(n, r);
    } finally {
      u.material.uniforms.uEnv.value = 0;
      n.toneMapping = $;
      n.setRenderTarget(null);
    }
    if (Q.out) {
      Q.out.dispose();
    }
    Q.out = Q.pmrem.fromCubemap(Q.cubeRT.texture);
    N.interiorEnv = Q.out.texture;
    let ue = 0,
      me = new Set<any>();
    r.traverse((ee) => {
      let B = (ee as Mesh).material
        ? ((Array.isArray((ee as Mesh).material)
            ? (ee as Mesh).material
            : [(ee as Mesh).material]) as Material[])
        : null;
      if (B) {
        for (let P of B) {
          if (!(
            !P ||
            me.has(P) ||
            !P.userData ||
            P.userData.interior !== true ||
            !("envMap" in P)
          )) {
            me.add(P);
            P.envMap = N.interiorEnv;
            if (!P.userData.keepEnvIntensity) {
              (P as MeshStandardMaterial).envMapIntensity =
                ENV_INTENSITY_INTERIOR;
            }
            P.needsUpdate = true;
            ue++;
          }
        }
      }
    });
    if (ue) {
      console.log(`[render] interior probe assigned to ${ue} material(s)`);
    }
  }
  N.captureInteriorProbe = K;
  N.resize();
  window.addEventListener("resize", () => N.resize());
  try {
    let ie = new MeshStandardMaterial({
        color: 8421504,
      }),
      F = new Mesh(new BoxGeometry(1, 1, 1), ie);
    F.castShadow = F.receiveShadow = true;
    F.position.set(0, 0.5, -3);
    r.add(F);
    let X = () => {
      C();
      if (_) {
        j(0.016);
      } else {
        G();
      }
    };
    try {
      X();
    } catch (ne: any) {
      if (_) {
        _ = false;
        console.error(
          "[render] advanced pipeline failed its self test, using forward fallback: " +
            ((ne && ne.message) || ne),
        );
      }
    }
    if (o.shadow && d) {
      restoreShadowChunk();
      d = false;
      o.shadow = false;
      n.shadowMap.type = PCFSoftShadowMap;
      h.shadow.radius = 2;
      ie.dispose();
      F.material = new MeshStandardMaterial({
        color: 8421505,
      });
      console.warn(
        "[render] soft shadow chunk rejected by the driver, using stock PCF",
      );
      try {
        X();
      } catch {
        _ = false;
      }
    }
    if (o.sky) {
      console.error("[render] sky shader failed to compile");
    }
    r.remove(F);
    F.geometry.dispose();
    ie.dispose();
    F.material.dispose();
    if (!_) {
      try {
        s.depthRange(0, 1);
        n.setRenderTarget(null);
      } catch {}
      N.resize();
    }
    T = 0;
  } catch (ie: any) {
    console.error("[render] self test threw: " + ((ie && ie.stack) || ie));
  }
  return N;
}
export function renderShowcase(i: any) {
  let e = new Group();
  e.name = "render-showcase";
  let t = (h: Object3D<Object3DEventMap>) => (e.add(h), h),
    n = new SphereGeometry(0.42, 48, 24);
  for (let h = 0; h < 2; h++)
    for (let f = 0; f < 7; f++) {
      let p = new MeshStandardMaterial({
          color: h ? 12170408 : 8006172,
          roughness: 0.06 + f * 0.15,
          metalness: h ? 1 : 0,
        }),
        d = new Mesh(n, p);
      d.position.set(-3.6 + f * 1.2, 0.42 + h * 1.05, h * -1.1);
      d.castShadow = d.receiveShadow = true;
      t(d);
    }
  let s: [string, number, number, number, number, number][] = [
    ["paint_orange", -5.2, 1.4, 1.3, 1.2, 2.2],
    ["steel_worn", 4.6, 1, 0.9, 1, 1.6],
    ["paint_teal", 5.6, 0.6, 2.4, 0.9, 3.6],
    ["concrete", -2.2, 0.5, 0.5, 2.6, 3.2],
  ];
  for (let [h, f, p, d, v, g] of s) {
    let x = makeMesh(roundedBoxGeo(p, d, v, 0.03, "bottom"), i.mats.get(h));
    x.position.set(f, 0, g);
    x.rotation.y = f * 0.2;
    t(x);
  }
  for (let h = 0; h < 5; h++) {
    let f = makeMesh(
      roundedBoxGeo(0.5, 0.5, 0.5, 0.02, "bottom"),
      i.mats.get("wood_pallet"),
    );
    f.position.set(0.5 + h * 0.52, 0, 3.4 + (h % 2) * 0.04);
    t(f);
  }
  {
    let h = makeMesh(
      roundedBoxGeo(0.5, 0.5, 0.5, 0.02, "bottom"),
      i.mats.get("wood_pallet"),
    );
    h.position.set(1.3, 0.5, 3.42);
    h.rotation.y = 0.3;
    t(h);
  }
  let o = i.mats.get("concrete_dirty"),
    r = 9,
    a = 7.5,
    l = [
      [-14, -5.2],
      [-4.7, -1.6],
      [-1.1, 1.9],
      [2.4, 5.6],
      [6.3, 14],
    ];
  for (let [h, f] of l) {
    let p = makeMesh(boxGeo(0.4, a, f - h, "bottom"), o);
    p.position.set(r, 0, (h + f) / 2);
    t(p);
  }
  {
    let h = makeMesh(boxGeo(0.4, 1.2, 28, "bottom"), o);
    h.position.set(r, a, 0);
    t(h);
  }
  let c = [
    [-12, 0, -9, 6, 4, 0.3],
    [-12, 0, -3, 6, 4, 0.3],
    [-15, 0, -6, 0.3, 4, 6.3],
    [-12, 4, -6, 6.6, 0.3, 6.6],
  ];
  for (let [h, f, p, d, v, g] of c) {
    let x = makeMesh(boxGeo(d, v, g, "bottom"), i.mats.get("steel_dark"));
    x.position.set(h, f, p);
    t(x);
  }
  {
    let h = new Mesh(boxGeo(2.4, 0.06, 0.06), i.mats.emissive(16756832, 14));
    h.position.set(-12, 3.6, -6);
    t(h);
  }
  {
    let h = new Mesh(
      new SphereGeometry(0.06, 12, 8),
      i.mats.emissive(16726560, 30),
    );
    h.position.set(4.6, 1.02, 1.6);
    t(h);
  }
  i.scene.add(e);
  return {
    cam: [-8.5, 1.7, 4.2],
    target: [3, 1.5, 0.4],
    update: () => {
      let h = i.render.post,
        f = Math.round(i.camera.position.y * 1e3) % 10;
      h.damage = f === 1 ? 0.8 : 0;
      h.lowHealth = f === 2 ? 0.85 : 0;
      h.ads = f === 3 ? 1 : 0;
      h.flash = f === 4 ? 0.35 : 0;
      h.fade = f === 5 ? 0.5 : 0;
    },
  };
}
