// Wet apron with puddles/markings, planar reflections, sea and rain.
import type { PlaneGeometry } from "three";
import {
  BoxGeometry,
  CylinderGeometry,
  DataTexture,
  Group,
  MathUtils,
  Mesh,
} from "three";
import type { GameContext } from "../types/context";
import { WORLD } from "../config/world";
import {
  PUDDLE_FIELD,
  bakeGroundDetail,
  bakePuddleMap,
  samplePuddleMap,
} from "./noise";
import { dataTexture, paintMarkings } from "./textures";
import { createApronMaterial, createPlanarReflection } from "./apron";
import { createSea, seaHeight } from "./sea";
import { createRain } from "./rain";

export async function createGround(i: GameContext) {
  let e = (i.quality.tex || 512) >= 1024,
    t = Math.min(
      8,
      i.renderer.capabilities.getMaxAnisotropy
        ? i.renderer.capabilities.getMaxAnisotropy()
        : 1,
    ),
    n = e ? 1024 : 512,
    s = bakePuddleMap(n),
    o = dataTexture(s, n, {
      repeat: false,
      aniso: 2,
    }),
    r = e ? 512 : 256,
    { det: a, nrm: l } = bakeGroundDetail(r),
    c = dataTexture(a, r, {
      aniso: t,
    }),
    u = dataTexture(l, r, {
      aniso: t,
    });
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.race([
        document.fonts.load('900 40px "PingFang SC"'),
        new Promise((M) => setTimeout(M, 350)),
      ]);
    }
  } catch {}
  let h = paintMarkings(e ? 2048 : 1024, t),
    f = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  f.needsUpdate = true;
  let p = {
      mask: o,
      detail: c,
      detailN: u,
      marks: h,
      black: f,
    },
    d = new Group();
  d.name = "ground";
  let v = createApronMaterial(i, p),
    g = createSea(i, p),
    x = createRain(i, p);
  d.add(v.mesh, g.mesh, g.skirt, x.rain, x.splash);
  i.scene.add(d);
  let y = createPlanarReflection(i, v.uniforms, [
    v.mesh,
    g.mesh,
    x.rain,
    x.splash,
  ]);
  if (i.render && i.render.addPrePass) {
    i.render.addPrePass(y.pass);
  }
  let b = (M: number, E: number) => {
      let w = i.level && i.level.interiorBoxes;
      if (!w) {
        return false;
      }
      for (let S = 0; S < w.length; S++) {
        let z = w[S];
        if (
          z &&
          z.min &&
          M > z.min.x &&
          M < z.max.x &&
          E > z.min.z &&
          E < z.max.z
        ) {
          return true;
        }
      }
      return false;
    },
    m = (M: number, E: number) =>
      M > PUDDLE_FIELD.x0 &&
      M < PUDDLE_FIELD.x0 + PUDDLE_FIELD.size &&
      E > PUDDLE_FIELD.z0 &&
      E < PUDDLE_FIELD.z0 + PUDDLE_FIELD.size,
    A = 0,
    _Init = {
      root: d,
      apron: v.mesh,
      sea: g.mesh,
      rain: x.rain,
      planar: y,
      reflectionTarget: y.target,
      reflectionCamera: y.camera,
      maskTexture: o,
      uniforms: v.uniforms,
      puddleDepth(M: number, E: number) {
        return M > WORLD.quayX || !m(M, E) || b(M, E)
          ? -0.2
          : 0.5 - samplePuddleMap(s, n, M, E, 0);
      },
      isPuddle(M: number, E: number) {
        return _.puddleDepth(M, E) > 0.015;
      },
      wetnessAt(M: number, E: number) {
        if (M > WORLD.quayX) {
          return 1;
        }
        if (b(M, E)) {
          return 0.12;
        }
        if (!m(M, E)) {
          return 0.6;
        }
        let w = 0.5 - samplePuddleMap(s, n, M, E, 0);
        if (w > 0.015) {
          return 1;
        }
        let S = MathUtils.smoothstep,
          z = S(w, -0.11, 0),
          H = S(w, -0.65, -0.02),
          O = 1 - S(samplePuddleMap(s, n, M, E, 1) + H * 0.55, 0.2, 0.42);
        return Math.min(0.95, 0.25 + (1 - O) * 0.4 + z * 0.3);
      },
      seaHeight(M: number, E: number) {
        return seaHeight(M, E, A);
      },
      setRain(M: number) {
        x.setRain(M);
      },
      get rainLevel() {
        return x.rainLevel;
      },
      setReflections(M: any) {
        y.enabled = !!M;
      },
      update(M: number) {
        A += M;
        x.update(M);
        v.uniforms.uTime.value = A;
        v.uniforms.uRain.value = x.rainLevel;
        g.uniforms.uTime.value = A;
      },
    },
    _ = _Init as typeof _Init & { stub: any };
  return _;
}
export async function groundShowcase(i: GameContext) {
  let e = i.scene.children.find(
    (o) =>
      (o as Mesh).isMesh &&
      (o as Mesh).geometry &&
      (o as Mesh).geometry.type === "PlaneGeometry" &&
      (o as Mesh<PlaneGeometry>).geometry.parameters &&
      (o as Mesh<PlaneGeometry>).geometry.parameters.width === 80,
  );
  if (e) {
    i.scene.remove(e);
  }
  i.ground = await createGround(i);
  let t = new Group(),
    n = (
      o: BoxGeometry | CylinderGeometry,
      r: any,
      a: number,
      l: number,
      c: number,
      u = 0,
    ) => {
      let h = new Mesh(o, r);
      h.position.set(a, l, c);
      h.rotation.y = u;
      h.castShadow = h.receiveShadow = true;
      t.add(h);
      return h;
    },
    s = (o: string) => i.mats.get(o);
  n(new BoxGeometry(6.06, 2.59, 2.44), s("paint_red"), 3, 1.295, -0.2);
  n(new BoxGeometry(6.06, 2.59, 2.44), s("paint_blue"), 9.4, 1.295, -0.2);
  n(new BoxGeometry(6.06, 2.59, 2.44), s("paint_teal"), 9.4, 3.885, -0.2);
  n(new BoxGeometry(12.19, 2.59, 2.44), s("paint_yellow"), 3, 1.295, 11.2);
  n(new BoxGeometry(6.06, 2.59, 2.44), s("paint_white"), 12.4, 1.295, 11.2);
  n(new BoxGeometry(1.1, 1.1, 1.1), s("paint_orange"), 5.6, 0.55, 4.7, 0.4);
  n(
    new CylinderGeometry(0.29, 0.29, 0.88, 20),
    s("plastic_blue"),
    3.9,
    0.44,
    6.3,
  );
  n(
    new CylinderGeometry(0.29, 0.29, 0.88, 20),
    s("steel_rust"),
    4.6,
    0.44,
    6.6,
  );
  n(new CylinderGeometry(0.06, 0.06, 5, 10), s("steel_galv"), 12.5, 2.5, 6.2);
  n(
    new BoxGeometry(0.08, 1.6, 0.08),
    i.mats.emissive(16726556, 6),
    6.6,
    0.82,
    2.6,
  );
  n(
    new BoxGeometry(0.08, 1.6, 0.08),
    i.mats.emissive(3524863, 5),
    2.2,
    0.82,
    3.2,
  );
  n(
    new BoxGeometry(2.4, 0.08, 0.06),
    i.mats.emissive(16773328, 6),
    9.4,
    2.2,
    1.06,
  );
  n(
    new BoxGeometry(0.3, 0.12, 0.3),
    i.mats.emissive(16760944, 12),
    12.5,
    5,
    6.2,
  );
  n(
    new BoxGeometry(0.06, 1.2, 0.06),
    i.mats.emissive(5832570, 5),
    23,
    0.62,
    8.2,
  );
  n(new BoxGeometry(1.2, 1.2, 1.2), s("steel_dark"), 22.4, 0.6, 9.6, 0.3);
  i.scene.add(t);
  return {
    cam: [-9, 1.65, 5.6],
    target: [14, 0.4, 5],
  };
}
