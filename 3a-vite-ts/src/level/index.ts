// Container-port level assembly: yard, warehouse, quay, objectives, spawns.
import type { Object3D, Object3DEventMap, Vector3 } from "three";
import { Group } from "three";
import type { GameContext } from "../types/context";
import type { AnyMesh, TextBatch } from "../types/three";
import { mergeByMaterial } from "../utils/geometry";
import { createStaticBuilder } from "./static-builder";
import { createTextBatch } from "./text-batch";
import {
  WAREHOUSE,
  buildCableRun,
  buildHydrantBox,
  buildWarehouse,
} from "./warehouse";
import { buildQuay } from "./quay";
import {
  QUARTER_TURN,
  layoutContainerYard,
  layoutPerimeter,
  makeVec3,
} from "./yard";

export async function createLevel(i: GameContext) {
  let e = new Group();
  e.name = "level";
  i.scene.add(e);
  let t = createStaticBuilder(i);
  layoutContainerYard(t);
  layoutPerimeter(t);
  let n = buildWarehouse(t),
    s = buildQuay(t),
    o = t.place(
      "relay_node",
      1.5,
      7.5,
      0.35,
      {
        seed: 1,
      },
      0,
    ),
    r = t.place(
      "relay_node",
      n.relayPos.x,
      n.relayPos.z,
      QUARTER_TURN * 0.9,
      {
        seed: 2,
      },
      WAREHOUSE.FLOOR,
    ),
    a = t.place(
      "relay_node",
      s.relayPos.x,
      s.relayPos.z,
      -0.2,
      {
        seed: 3,
      },
      0,
    );
  buildCableRun(
    t,
    [
      [-2, -27.5, 1.2],
      [-2, -27.55, 0.08],
      [-1.4, -25.6],
      [-2.4, -23],
      [-1.9, -20.3],
    ],
    0.03,
    t.MI("rubber"),
    WAREHOUSE.FLOOR + 0.028,
  );
  buildHydrantBox(t, 20.4, -7.3, 0.2);
  buildCableRun(
    t,
    [
      [20.5, -7],
      [21.4, -4.9],
      [22.4, -2.6],
      [22.9, -0.7],
    ],
    0.03,
  );
  t.staticRoot.updateMatrixWorld(true);
  let l: Object3D<Object3DEventMap>[] = [];
  t.staticRoot.traverse((z) => {
    if (
      z.userData &&
      z.userData.noMerge &&
      !(z.parent && isNoMerge(z.parent, t.staticRoot))
    ) {
      l.push(z);
    }
  });
  for (let z of l) t.dynRoot.attach(z);
  let c = new Set<any>();
  t.staticRoot.traverse((z) => {
    if ((z as AnyMesh).isMesh && !Array.isArray((z as AnyMesh).material)) {
      c.add((z as AnyMesh).material);
    }
  });
  let u = new Map();
  for (let z of c)
    if (!(
      !z.isMeshStandardMaterial ||
      z.vertexColors ||
      z.transparent ||
      !z.name ||
      !(i.mats.names || []).includes(z.name)
    )) {
      try {
        let H =
          z.userData && z.userData.interior
            ? {
                interior: true,
              }
            : {};
        if (i.mats.get(z.name, H) !== z) {
          continue;
        }
        let O = i.mats.get(z.name, {
          ...H,
          vertexColors: true,
        });
        if (O !== z && c.has(O)) {
          u.set(z, O);
        }
      } catch {}
    }
  t.staticRoot.traverse((z) => {
    if (!(z as AnyMesh).isMesh || Array.isArray((z as AnyMesh).material)) {
      return;
    }
    let H = u.get((z as AnyMesh).material);
    if (H) {
      (z as AnyMesh).material = H;
    }
    let O =
      !(z as AnyMesh).material.transparent &&
      !(z as AnyMesh).material.isMeshBasicMaterial;
    z.castShadow = O;
    z.receiveShadow = !(z as AnyMesh).material.isMeshBasicMaterial;
  });
  let h: TextBatch = {
    count: 0,
    update() {},
  };
  try {
    h = createTextBatch(t.staticRoot);
  } catch (z: any) {
    console.error("[level] label atlas failed", z);
  }
  let f = mergeByMaterial(t.staticRoot);
  f.name = "level-merged";
  e.add(f);
  e.add(t.dynRoot);
  for (let z of [o, r, a]) {
    for (let H = z.children.length - 1; H >= 0; H--) z.remove(z.children[H]);
    t.dynRoot.add(z);
  }
  let p = 0;
  f.traverse((z) => {
    if ((z as AnyMesh).isMesh) {
      let H = (z as AnyMesh).geometry;
      p += (H.index ? H.index.count : H.attributes.position.count) / 3;
    }
  });
  let d = {
      pos: makeVec3(-32, 0, 6),
      yaw: -QUARTER_TURN,
    },
    v = [
      {
        id: "relay_a",
        label: "甲号中继 · 堆场",
        zone: "yard",
        pos: makeVec3(1.5, 0, 7.5),
        object: o,
      },
      {
        id: "relay_b",
        label: "乙号中继 · 仓库",
        zone: "shed",
        pos: makeVec3(n.relayPos.x, WAREHOUSE.FLOOR, n.relayPos.z),
        object: r,
      },
      {
        id: "relay_c",
        label: "丙号中继 · 码头",
        zone: "quay",
        pos: makeVec3(s.relayPos.x, 0, s.relayPos.z),
        object: a,
      },
    ],
    g = (z: number, H: number, O: string) => ({
      pos: makeVec3(z, 0, H),
      zone: O,
      type: "ground",
    }),
    x = (z: number, H: number, O: number, q: string) => ({
      pos: makeVec3(z, H, O),
      zone: q,
      type: "air",
    }),
    y = [
      g(-19, -1.4, "yard"),
      g(3.5, -1.6, "yard"),
      g(14.2, 16.4, "yard"),
      g(-3.2, 16.6, "yard"),
      g(-16, 26, "yard"),
      g(6, 26, "yard"),
      g(4.2, -5.12, "yard"),
      g(-7.8, 21.4, "yard"),
      g(-11.3, 12.5, "yard"),
      g(17.5, 22.2, "yard"),
      x(10, 11, 23.5, "yard"),
      x(2, 11, 21.5, "yard"),
      x(13, 9, 11, "yard"),
      x(-4, 12.5, -4.5, "yard"),
      x(9, 10, 1.5, "yard"),
      x(-10, 12, 24.5, "yard"),
      g(-12.4, -24.8, "shed"),
      g(9.6, -25.3, "shed"),
      g(-13.4, -19.6, "shed"),
      g(4.6, -13.8, "shed"),
      g(-21, -27.2, "shed"),
      g(-18.6, -22, "shed"),
      g(13.6, -24, "shed"),
      g(-26.6, -15, "shed"),
      x(-8, 5.4, -20.5, "shed"),
      x(5, 5.2, -18, "shed"),
      x(-20, 10.5, -20, "shed"),
      x(14.5, 10, -22, "shed"),
      x(-2, 12.5, -8.5, "shed"),
      g(27.7, -24.2, "quay"),
      g(18.3, -25.4, "quay"),
      g(27.2, -12.6, "quay"),
      g(20.2, 14, "quay"),
      g(23.4, 23.2, "quay"),
      g(18, 24.4, "quay"),
      g(27.4, 11.6, "quay"),
      x(36, 9, 4, "quay"),
      x(38, 11, -6, "quay"),
      x(35, 8.5, 16, "quay"),
      x(24, 12.5, 10.5, "quay"),
      x(33.5, 10, 24.5, "quay"),
      x(22, 13, -14, "quay"),
    ],
    b = [
      {
        name: "gate",
        min: [-40, -30],
        max: [-24, 30],
      },
      {
        name: "yard",
        min: [-24, -10],
        max: [16, 30],
      },
      {
        name: "shed",
        min: [-24, -30],
        max: [16, -10],
      },
      {
        name: "quay",
        min: [16, -30],
        max: [40, 30],
      },
    ],
    m = [
      {
        min: makeVec3(WAREHOUSE.X0, 0, WAREHOUSE.Z0),
        max: makeVec3(WAREHOUSE.X1, WAREHOUSE.RIDGE, WAREHOUSE.Z1),
      },
    ],
    A = [
      {
        pos: [-34, 1.6, 6.2],
        look: [-12, 2.6, 6.6],
      },
      {
        pos: [-20, 1.3, 5.6],
        look: [0, 2.2, 7],
      },
      {
        pos: [-6.2, 2.1, 7.9],
        look: [2, 1.6, 7.6],
      },
      {
        pos: [-6.6, 2.5, 0.4],
        look: [-4, 2.6, -12],
      },
      {
        pos: [-4.4, 1.9, -8.6],
        look: [-2.4, 2.8, -19.5],
      },
      {
        pos: [-3.2, 2.2, -15],
        look: [-2, 2.2, -20.5],
      },
      {
        pos: [4.2, 2.6, -19.6],
        look: [12, 3.2, -19.5],
      },
      {
        pos: [15, 2, -19.5],
        look: [24, 3.5, -6],
      },
      {
        pos: [20.2, 1.7, -9],
        look: [23, 1.6, 0],
      },
      {
        pos: [25.9, 1.8, 1.5],
        look: [27.5, 1.2, 12],
      },
      {
        pos: [27.3, 1.8, 12],
        look: [29.6, 0.4, 20],
      },
      {
        pos: [28.4, 1.9, 17.2],
        look: [31.5, -0.8, 21],
      },
    ],
    _ = [
      makeVec3(-33.9, 0, 3.8),
      makeVec3(-27.3, 0, 2.3),
      makeVec3(-19.2, 0, 4.7),
      makeVec3(-17.4, 0, 4.9),
      makeVec3(-12.5, 0, 7.2),
      makeVec3(-9.3, 0, 6.4),
      makeVec3(-6.3, 0, 7.3),
      makeVec3(-2.9, 0, 6.1),
      makeVec3(-2.9, 0, 4.5),
      makeVec3(5.6, 0, 5.8),
      makeVec3(5.6, 0, 4.2),
      makeVec3(-2.2, 0, 10.4),
      makeVec3(5, 0, 8.9),
      makeVec3(-4.8, 0, 10.6),
      makeVec3(7.5, 0, 7.7),
      makeVec3(9.2, 0, 4.4),
      makeVec3(-1, 0, 13.6),
      makeVec3(-13.5, 0, -1.5),
      makeVec3(-9.6, 0, -0.7),
      makeVec3(7.8, 0, -1.5),
      makeVec3(-4.2, 0, -2.2),
      makeVec3(-0.9, 0, -6.7),
      makeVec3(-6.7, 0, -7),
      makeVec3(1.2, 0, -8.9),
      makeVec3(-8.1, 0, 15.4),
      makeVec3(0.6, 0, 16.9),
      makeVec3(4.2, 0, 15.7),
      makeVec3(-16, 0, 15.6),
      makeVec3(12, 0, 17.2),
      makeVec3(2.9, 0, -17),
      makeVec3(4.2, 0, -15.3),
      makeVec3(6.9, 0, -20.6),
      makeVec3(-7.6, 0, -17.4),
      makeVec3(-8.3, 0, -14.3),
      makeVec3(9.6, 0, -21.9),
      makeVec3(-13.2, 0, -14.4),
      makeVec3(-11.6, 0, -18.6),
      makeVec3(0, 0, -25.8),
      makeVec3(-12.4, 0, -25.8),
      makeVec3(21.4, 0, -4.7),
      makeVec3(25.3, 0, 3.9),
      makeVec3(25.7, 0, -4.4),
      makeVec3(20.2, 0, -15.4),
      makeVec3(26.4, 0, -15.4),
      makeVec3(20.6, 0, 14.4),
      makeVec3(26.8, 0, 14.4),
      makeVec3(20.6, 0, 21.2),
      makeVec3(27.4, 0, 22.4),
      makeVec3(19.6, 0, -21.4),
      makeVec3(27, 0, -16.2),
      makeVec3(25.6, 0, 6),
      makeVec3(13.5, 2.59, 12.4),
      makeVec3(4.4, 2.59, 12.4),
      makeVec3(12.9, 0, 8.8),
      makeVec3(11.6, 0, 4.9),
    ],
    M = i.physics.nav,
    E = (z: Vector3) => {
      if (!(!M || !M.isWalkable || z.y > 0.2 || M.isWalkable(z.x, z.z))) {
        for (let H of [0.5, 1, 1.5, 2])
          for (let O = 0; O < 8; O++) {
            let q = z.x + Math.cos(O * 0.7854) * H,
              U = z.z + Math.sin(O * 0.7854) * H;
            if (M.isWalkable(q, U)) {
              z.x = q;
              z.z = U;
              return;
            }
          }
      }
    };
  _.forEach(E);
  y.forEach((z) => {
    if (z.type === "ground") {
      E(z.pos);
    }
  });
  let w = false;
  return {
    root: e,
    playerStart: d,
    objectives: v,
    extraction: {
      pos: s.extraction.clone(),
      radius: 2.5,
    },
    enemySpawns: y,
    zones: b,
    interiorBoxes: m,
    cinematicPath: A,
    coverPoints: _,
    skylights: n.skylights,
    shedLights: n.lights,
    vantage: {
      stairsFoot: makeVec3(-2.2, 0, 12.4),
      roof: makeVec3(13.5, 2.59, 12.4),
    },
    stats: {
      labelsAtlased: h.count,
      containers: t.placed.filter((z) => z.name.startsWith("container")).length,
      props: t.placed.length,
      tris: Math.round(p),
      meshes: f.children.length + countMeshes(t.dynRoot),
    },
    placed: t.placed,
    groundSurfaceAt(z: number, H: number) {
      return t.isMetal(z, H) ? "metal" : "concrete";
    },
    update(z: number) {
      n.update(z);
      h.update(z);
      for (let H = 0; H < t.updaters.length; H++)
        try {
          t.updaters[H](z);
        } catch (O: any) {
          if (!w) {
            w = true;
            console.error("[level] prop update threw", O);
          }
        }
    },
  };
}
function isNoMerge(i: any, e: Group<Object3DEventMap>) {
  for (; i && i !== e;) {
    if (i.userData && i.userData.noMerge) {
      return true;
    }
    i = i.parent;
  }
  return false;
}
function countMeshes(i: Group<Object3DEventMap>) {
  let e = 0;
  i.traverse((t) => {
    if ((t as AnyMesh).isMesh) {
      e++;
    }
  });
  return e;
}
export async function levelShowcase(i: GameContext) {
  let e = await createLevel(i);
  return {
    cam: [-32, 1.7, 6],
    target: [0, 2.4, 6.4],
    update: (t: number) => e.update(t),
  };
}
