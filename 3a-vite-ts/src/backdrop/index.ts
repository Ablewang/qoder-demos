// Distant cranes, vessels, tug, skyline and beacons.
import type {
  BufferGeometry,
  BufferGeometryEventMap,
  Mesh,
  MeshBasicMaterial,
  NormalBufferAttributes,
  Object3DEventMap,
} from "three";
import { Group, Object3D, Vector3 } from "three";
import type { GameContext } from "../types/context";
import { GeoBucket, catenary, createLampBatch, polyStrut, vec3 } from "./kit";
import { buildCrane } from "./cranes";
import { buildBeacons, buildShip, buildSkyline, buildTugboat } from "./vessels";

const BACKDROP_PARTS = ["crane", "ship", "boat", "sky"];
function buildBackdrop(
  i: GameContext,
  {
    only: e = null,
    showcase: t = false,
  }: { only?: string | null | null; showcase?: boolean } = {},
) {
  let n = (b: string) => !e || e === b,
    s = new Group();
  s.name = "backdrop";
  let o = createLampBatch(),
    r = new Vector3(31.5, -1.6, 21);
  if (t) {
    r.set(24, 0.34, 15);
  }
  let a: {
      root: Group<Object3DEventMap>;
      hullGrp: Group<Object3DEventMap>;
      tris: number;
    } | null = null,
    l: any = null,
    c: {
      root: Group<Object3DEventMap>;
      radar: Group<Object3DEventMap>;
      colliders: { min: number[]; max: number[] }[];
      tris: number;
      name: string;
    } | null = null,
    u: { root: Group<Object3DEventMap>; tris: number } | null = null,
    h: Mesh<
      BufferGeometry<NormalBufferAttributes, BufferGeometryEventMap>,
      MeshBasicMaterial,
      Object3DEventMap
    > | null = null;
  if (n("boat")) {
    a = buildTugboat(i, o);
    a.root.position.copy(r);
    a.root.rotation.y = -Math.PI / 2;
    s.add(a.root);
  }
  if (a && !t) {
    let b = new GeoBucket(),
      m = i.mats.get("rope");
    b.add(
      m,
      polyStrut(
        catenary(vec3(3.2, 0.95, 0.05), vec3(4.6, 2.12, 2.3), 0.22, 7),
        0.016,
        5,
      ),
    );
    b.add(
      m,
      polyStrut(
        catenary(vec3(-3.25, 0.82, 0.95), vec3(-4.6, 2.12, 2.3), 0.2, 7),
        0.016,
        5,
      ),
    );
    a.root.add(
      b.build({
        cast: false,
        recv: false,
      }),
    );
  }
  if (n("crane")) {
    l = buildCrane(i, o);
    s.add(l.root);
  }
  if (n("ship")) {
    c = buildShip(i, o);
    s.add(c.root);
  }
  if (n("sky")) {
    u = buildSkyline(i, o);
    s.add(u.root);
  }
  if (n("sky") || n("crane")) {
    h = buildBeacons(i, o.uTime, 12);
    s.add(h);
  }
  let f = o.build();
  if (f) {
    f.name = "backdrop-lamps";
    f.frustumCulled = false;
    s.add(f);
  }
  i.scene.add(s);
  let p: any[] = [],
    d = (
      b: {
        min: number[];
        max: number[];
        bulletOnly?: boolean;
        noNav?: boolean;
      },
      m: string,
    ) => {
      if (i.physics && i.physics.addBox) {
        p.push(
          i.physics.addBox(b.min, b.max, {
            surface: m,
            tag: "backdrop",
            noNav: !!b.noNav,
          }),
        );
      }
    };
  if (l) {
    for (let b of l.colliders) d(b, "metal");
  }
  if (c) {
    for (let b of c.colliders) d(b, "metal");
  }
  if (a && !t) {
    d(
      {
        min: [30.25, -1.7, 17.4],
        max: [32.8, -0.7, 24.6],
      },
      "rubber",
    );
  }
  let v = 0,
    g = 0;
  s.traverse((b) => {
    if ((b as Mesh).isMesh) {
      g++;
      let m = (b as Mesh).geometry;
      v += (m.index ? m.index.count : m.attributes.position.count) / 3;
    }
  });
  let x = 0;
  function y(b: number) {
    x += b;
    o.uTime.value = x;
    if (l) {
      let m = l.spreader;
      m.rotation.x =
        0.012 * Math.sin(x * 0.52) + 0.004 * Math.sin(x * 1.31 + 1);
      m.rotation.z = 0.009 * Math.sin(x * 0.41 + 1.1);
    }
    if (c) {
      c.radar.rotation.y = x * 1.9;
    }
    if (a) {
      a.root.position.y =
        r.y +
        (t ? 0 : 0.05 * Math.sin(x * 1.15) + 0.025 * Math.sin(x * 2.3 + 1.3));
      a.hullGrp.rotation.x =
        0.05 * Math.sin(x * 0.9 + 0.4) + 0.016 * Math.sin(x * 2.1);
      a.hullGrp.rotation.z = 0.02 * Math.sin(x * 1.3 + 2);
    }
  }
  y(0);
  return {
    update: y,
    root: s,
    boat: a ? a.root : new Object3D(),
    crane: l ? l.root : null,
    ship: c ? c.root : null,
    skyline: u ? u.root : null,
    gulls: h,
    lamps: f,
    colliders: p,
    spreader: l ? l.spreader : null,
    boatBase: r,
    extractionPoint: new Vector3(30, 0, 20),
    shipName: "几猫撤离艇",
    craneId: "几猫04号",
    stats: {
      tris: Math.round(v),
      drawCalls: g,
    },
  };
}
export async function createBackdrop(i: GameContext) {
  return buildBackdrop(i, {});
}
export function backdropShowcase(i: GameContext) {
  let e =
      i.params && BACKDROP_PARTS.includes(i.params.bshow)
        ? i.params.bshow
        : null,
    t = buildBackdrop(i, {
      only: e,
      showcase: true,
    });
  console.log("[backdrop] " + JSON.stringify(t.stats));
  let n = {
    crane: {
      cam: [0, 1.7, 27],
      target: [33, 13, 0],
    },
    ship: {
      cam: [24, 1.7, -2],
      target: [38, 9, -24],
    },
    boat: {
      cam: [19.5, 1.7, 11.5],
      target: [24, 0.9, 15],
    },
    sky: {
      cam: [-32, 1.7, 6],
      target: [30, 9, 0],
    },
  };
  return {
    ...(n[e as keyof typeof n] || n.crane),
    update: (s: number) => t.update(s),
  };
}
