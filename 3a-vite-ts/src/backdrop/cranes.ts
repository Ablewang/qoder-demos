import type { GameContext } from "../types/context";
import type { BoxGeometry, CylinderGeometry, PlaneGeometry } from "three";
import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import {
  GeoBucket,
  axisCylinder,
  backdropMaterial,
  boxBetween,
  girder,
  lampGeo,
  panelGeo,
  polyStrut,
  railLine,
  strut,
  vec3,
} from "./kit";

const CRANE_LEG_X_LAND = 18.5;
const CRANE_LEG_X_SEA = 28.5;
const CRANE_LEG_HALF_SPAN_Z = 5.4;
const CRANE_BOOM_BOTTOM_Y = 21.2;
const CRANE_BOOM_TOP_Y = 22.8;
const CRANE_BOOM_HALF_WIDTH = 1.8;
const CRANE_BOOM_X_BACK = 12;
const CRANE_BOOM_X_TIP = 62;
const CRANE_TROLLEY_X = 41;
const CRANE_TINT_MAIN = [0.82, 0.95, 1.12];
const CRANE_TINT_SHADE = [0.6, 0.72, 0.86];
const CRANE_TINT_WARM = [1, 0.95, 0.85];
const CRANE_TINT_WHITE = [0.95, 0.96, 0.97];
export function buildCrane(
  i: GameContext,
  e: any,
  t: { into?: any; dz?: any; mat?: any } = {},
) {
  let n = !!t.into,
    s = t.dz || 0,
    o = t.into || new GeoBucket(),
    r = n
      ? {
          add(R: any, I: any, se: any, ae: any, k: any) {
            R.translate(0, 0, s);
            e.add(R, I, se, ae, k);
          },
        }
      : e,
    a = backdropMaterial(i, "paint_grey"),
    l = backdropMaterial(i, "paint_yellow"),
    c = backdropMaterial(i, "paint_white"),
    u = backdropMaterial(i, "paint_red"),
    h = i.mats.get("steel_galv"),
    f = i.mats.get("steel_dark"),
    p = i.mats.get("hazard_stripes"),
    d = i.mats.get("glass"),
    v = i.mats.emissive(16769716, 6),
    g = (
      R: any,
      I:
        | BoxGeometry
        | CylinderGeometry
        | PlaneGeometry
        | BoxGeometry[]
        | CylinderGeometry[]
        | null
        | undefined,
      se?: number[],
    ) => o.add(R, I, se),
    x: (
      | { min: number[]; max: number[] }
      | { min: number[]; max: number[]; bulletOnly: boolean }
    )[] = [];
  if (n) {
    let R = new Map([
        [a.uuid, [0.2, 0.25, 0.31]],
        [l.uuid, [0.72, 0.52, 0.12]],
        [c.uuid, [0.78, 0.78, 0.76]],
        [u.uuid, [0.5, 0.14, 0.1]],
        [h.uuid, [0.5, 0.52, 0.54]],
        [f.uuid, [0.1, 0.1, 0.11]],
        [p.uuid, [0.7, 0.5, 0.1]],
      ]),
      I = t.mat;
    o.remap = (se: any, ae: number[]) => {
      let k = R.get(se.uuid);
      return k
        ? [I, ae ? [k[0] * ae[0], k[1] * ae[1], k[2] * ae[2]] : k]
        : null;
    };
    o.dz = s;
    o.minSize = 2.6;
  }
  function y(R: number, I: number) {
    let se = R < 23.5 ? 1 : -1;
    for (let ae of [-1.12, 1.12]) {
      let k = I + ae;
      g(
        l,
        boxBetween(R - 0.3, 0.36, k - 0.98, R + 0.3, 0.84, k + 0.98, 0.04),
        CRANE_TINT_WARM,
      );
      for (let ce of [-0.56, 0.56]) {
        g(f, axisCylinder(0.33, 0.33, 0.14, "x", R, 0.33, k + ce, 16));
        g(f, axisCylinder(0.37, 0.37, 0.025, "x", R - 0.085, 0.33, k + ce, 16));
        g(f, axisCylinder(0.37, 0.37, 0.025, "x", R + 0.085, 0.33, k + ce, 16));
        g(h, axisCylinder(0.11, 0.11, 0.7, "x", R, 0.33, k + ce, 8));
      }
      g(f, axisCylinder(0.16, 0.16, 0.5, "z", R + se * 0.5, 0.6, k, 10));
      g(
        l,
        boxBetween(
          R + se * 0.3,
          0.42,
          k - 0.56 - 0.16,
          R + se * 0.62,
          0.8,
          k - 0.3,
          0.03,
        ),
        CRANE_TINT_WARM,
      );
    }
    g(f, boxBetween(R - 0.2, 0.1, I - 0.22, R + 0.2, 0.9, I + 0.22, 0.03));
    g(
      a,
      boxBetween(R - 0.34, 0.9, I - 1.8, R + 0.34, 1.42, I + 1.8, 0.05),
      CRANE_TINT_MAIN,
    );
    for (let ae of [-1.12, 0, 1.12])
      g(h, axisCylinder(0.14, 0.14, 0.8, "x", R, ae ? 1.08 : 1.22, I + ae, 10));
    g(
      a,
      boxBetween(R - 0.54, 1.42, I - 0.54, R + 0.54, 1.6, I + 0.54, 0.03),
      CRANE_TINT_SHADE,
    );
    for (let ae of [-1, 1]) {
      let k = I + ae * 2.1;
      g(
        l,
        boxBetween(R - 0.16, 0.44, k - 0.12, R + 0.16, 0.8, k + 0.12, 0.02),
        CRANE_TINT_WARM,
      );
      g(h, axisCylinder(0.08, 0.08, 0.34, "z", R, 0.62, k + ae * 0.28, 8));
      g(f, axisCylinder(0.17, 0.15, 0.12, "z", R, 0.62, k + ae * 0.5, 12));
      g(
        p,
        boxBetween(R - 0.28, 0.04, k + ae * 0.13, R + 0.28, 0.4, k + ae * 0.16),
      );
    }
    x.push({
      min: [R - 0.5, 0, I - 2.7],
      max: [R + 0.5, 1.5, I + 2.7],
    });
    x.push({
      min: [R - 0.62, 0, I - 0.62],
      max: [R + 0.62, 24, I + 0.62],
    });
  }
  let b = [3.6, 7.6, 11.2, 12.5, 13.5, 17.2, 20.6, 23.8];
  for (let R of [CRANE_LEG_X_LAND, CRANE_LEG_X_SEA])
    for (let I of [-CRANE_LEG_HALF_SPAN_Z, CRANE_LEG_HALF_SPAN_Z]) {
      y(R, I);
      g(p, boxBetween(R - 0.6, 1.6, I - 0.6, R + 0.6, 3.6, I + 0.6, 0.04));
      for (let se = 0; se < b.length - 1; se++) {
        g(
          a,
          boxBetween(
            R - 0.6,
            b[se],
            I - 0.6,
            R + 0.6,
            b[se + 1],
            I + 0.6,
            0.05,
          ),
          CRANE_TINT_MAIN,
        );
        if (se === 0 || se === 1 || se === 5) {
          g(
            a,
            boxBetween(
              R - 0.64,
              b[se] - 0.05,
              I - 0.64,
              R + 0.64,
              b[se] + 0.05,
              I + 0.64,
            ),
            CRANE_TINT_SHADE,
          );
        }
      }
    }
  let m = i.mats.decal("hazard_voltage");
  for (let R of [-CRANE_LEG_HALF_SPAN_Z, CRANE_LEG_HALF_SPAN_Z]) {
    let I = CRANE_LEG_X_LAND - 0.6;
    g(
      c,
      boxBetween(I - 0.035, 1.72, R - 0.36, I, 3.48, R + 0.36, 0.012),
      [0.62, 0.66, 0.7],
    );
    g(f, boxBetween(I - 0.05, 1.66, R - 0.42, I - 0.005, 1.72, R + 0.42));
    g(f, boxBetween(I - 0.05, 3.48, R - 0.42, I - 0.005, 3.54, R + 0.42));
    g(f, boxBetween(I - 0.05, 1.66, R - 0.42, I - 0.005, 3.54, R - 0.36));
    g(f, boxBetween(I - 0.05, 1.66, R + 0.36, I - 0.005, 3.54, R + 0.42));
    g(
      h,
      strut([I - 0.08, 2.45, R + 0.26], [I - 0.08, 2.75, R + 0.26], 0.014, 5),
    );
    for (let se of [2, 3.2])
      g(
        f,
        boxBetween(
          I - 0.06,
          se - 0.07,
          R - 0.37,
          I - 0.03,
          se + 0.07,
          R - 0.33,
        ),
      );
    g(h, boxBetween(I - 0.3, 1.5, R - 0.4, I, 1.56, R + 0.4));
    g(h, boxBetween(I - 0.3, 1, R - 0.4, I - 0.02, 1.05, R + 0.4));
    g(m.material, panelGeo(0.3, 0.3, I - 0.04, 3.1, R, -Math.PI / 2));
  }
  for (let R of [CRANE_LEG_X_LAND, CRANE_LEG_X_SEA]) {
    g(
      a,
      boxBetween(
        R - 0.45,
        3.6,
        -CRANE_LEG_HALF_SPAN_Z + 0.6,
        R + 0.45,
        4.6,
        CRANE_LEG_HALF_SPAN_Z - 0.6,
        0.05,
      ),
      CRANE_TINT_MAIN,
    );
    for (let I of [-2.4, 0, 2.4])
      g(
        a,
        boxBetween(R - 0.48, 3.58, I - 0.03, R + 0.48, 4.62, I + 0.03),
        CRANE_TINT_SHADE,
      );
  }
  g(
    l,
    axisCylinder(
      1.15,
      1.15,
      0.06,
      "x",
      CRANE_LEG_X_LAND - 0.62,
      5.85,
      -2.2,
      24,
    ),
    CRANE_TINT_WARM,
  );
  g(
    l,
    axisCylinder(
      1.15,
      1.15,
      0.06,
      "x",
      CRANE_LEG_X_LAND - 1.02,
      5.85,
      -2.2,
      24,
    ),
    CRANE_TINT_WARM,
  );
  g(
    f,
    axisCylinder(0.7, 0.7, 0.36, "x", CRANE_LEG_X_LAND - 0.82, 5.85, -2.2, 20),
  );
  g(
    h,
    axisCylinder(0.12, 0.12, 0.9, "x", CRANE_LEG_X_LAND - 0.6, 5.85, -2.2, 8),
  );
  g(
    a,
    boxBetween(
      CRANE_LEG_X_LAND - 0.5,
      4.6,
      -2.5,
      CRANE_LEG_X_LAND + 0.3,
      5.9,
      -1.9,
      0.03,
    ),
    CRANE_TINT_SHADE,
  );
  g(
    f,
    strut(
      [CRANE_LEG_X_LAND - 0.82, 4.75, -2.2 + 1],
      [CRANE_LEG_X_LAND - 0.82, 0.02, -1.2 + 0.3],
      0.035,
      6,
    ),
  );
  g(
    h,
    boxBetween(
      CRANE_LEG_X_LAND - 1,
      0,
      -1.15,
      CRANE_LEG_X_LAND - 0.64,
      0.5,
      -0.65,
      0.02,
    ),
  );
  x.push({
    min: [CRANE_LEG_X_LAND - 1, 0, -1.15],
    max: [CRANE_LEG_X_LAND - 0.64, 0.5, -0.65],
  });
  g(
    c,
    boxBetween(
      CRANE_LEG_X_LAND - 0.42,
      4.6,
      1,
      CRANE_LEG_X_LAND + 0.42,
      6.3,
      3.6,
      0.03,
    ),
    CRANE_TINT_WHITE,
  );
  for (let R of [1.65, 2.3, 2.95])
    g(
      f,
      boxBetween(
        CRANE_LEG_X_LAND - 0.44,
        4.7,
        R - 0.01,
        CRANE_LEG_X_LAND - 0.42,
        6.2,
        R + 0.01,
      ),
    );
  g(
    h,
    boxBetween(
      CRANE_LEG_X_LAND - 0.47,
      5.6,
      1.2,
      CRANE_LEG_X_LAND - 0.42,
      6.1,
      1.55,
    ),
  );
  for (let R of [-CRANE_LEG_HALF_SPAN_Z, CRANE_LEG_HALF_SPAN_Z]) {
    g(
      a,
      boxBetween(
        CRANE_LEG_X_LAND + 0.6,
        12.5,
        R - 0.45,
        CRANE_LEG_X_SEA - 0.6,
        13.5,
        R + 0.45,
        0.05,
      ),
      CRANE_TINT_MAIN,
    );
    for (let se of [21, 23.5, 26])
      g(
        a,
        boxBetween(se - 0.03, 12.48, R - 0.48, se + 0.03, 13.52, R + 0.48),
        CRANE_TINT_SHADE,
      );
    let I = Math.sign(R);
    g(
      a,
      girder(
        [CRANE_LEG_X_LAND + 0.5, 9.6, R],
        [CRANE_LEG_X_LAND + 3.4, 12.6, R],
        0.4,
        0.4,
        0.03,
      ),
      CRANE_TINT_MAIN,
    );
    g(
      a,
      girder(
        [CRANE_LEG_X_SEA - 0.5, 9.6, R],
        [CRANE_LEG_X_SEA - 3.4, 12.6, R],
        0.4,
        0.4,
        0.03,
      ),
      CRANE_TINT_MAIN,
    );
    for (let se of [CRANE_LEG_X_LAND, CRANE_LEG_X_SEA])
      g(
        a,
        girder([se, 9.6, R - I * 0.5], [se, 12.6, R - I * 3.4], 0.4, 0.4, 0.03),
        CRANE_TINT_MAIN,
      );
    g(
      a,
      strut(
        [CRANE_LEG_X_SEA - 0.4, 13.7, R],
        [CRANE_LEG_X_LAND + 0.4, 22.7, R],
        0.2,
        10,
      ),
      CRANE_TINT_MAIN,
    );
    g(
      a,
      strut(
        [CRANE_LEG_X_LAND + 0.4, 13.7, R],
        [CRANE_LEG_X_SEA - 0.4, 22.7, R],
        0.2,
        10,
      ),
      CRANE_TINT_MAIN,
    );
    g(
      a,
      boxBetween(23.5 - 0.5, 17.7, R - 0.24, 23.5 + 0.5, 18.7, R + 0.24, 0.03),
      CRANE_TINT_SHADE,
    );
    g(
      a,
      boxBetween(
        CRANE_LEG_X_LAND + 0.6,
        22.95,
        R - 0.35,
        CRANE_LEG_X_SEA - 0.6,
        23.7,
        R + 0.35,
        0.04,
      ),
      CRANE_TINT_MAIN,
    );
  }
  for (let R of [CRANE_LEG_X_LAND, CRANE_LEG_X_SEA]) {
    g(
      a,
      boxBetween(
        R - 0.45,
        12.5,
        -CRANE_LEG_HALF_SPAN_Z + 0.6,
        R + 0.45,
        13.5,
        CRANE_LEG_HALF_SPAN_Z - 0.6,
        0.05,
      ),
      CRANE_TINT_MAIN,
    );
    g(
      a,
      boxBetween(
        R - 0.45,
        22.8,
        -CRANE_LEG_HALF_SPAN_Z + 0.6,
        R + 0.45,
        23.8,
        CRANE_LEG_HALF_SPAN_Z - 0.6,
        0.05,
      ),
      CRANE_TINT_MAIN,
    );
    for (let I of [-1, 1])
      g(
        a,
        girder(
          [R, 20.2, I * (CRANE_LEG_HALF_SPAN_Z - 0.5)],
          [R, 22.8, I * (CRANE_BOOM_HALF_WIDTH + 1.2)],
          0.36,
          0.36,
          0.03,
        ),
        CRANE_TINT_MAIN,
      );
  }
  g(
    h,
    boxBetween(
      CRANE_LEG_X_LAND + 0.9,
      13.5,
      4.05,
      CRANE_LEG_X_SEA - 0.9,
      13.55,
      4.95,
    ),
  );
  railLine(
    o,
    l,
    [
      [CRANE_LEG_X_LAND + 0.9, 13.55, 4.08],
      [CRANE_LEG_X_SEA - 0.9, 13.55, 4.08],
    ],
    {
      tint: CRANE_TINT_WARM,
    },
  );
  g(
    h,
    boxBetween(
      CRANE_LEG_X_LAND + 0.45,
      13.45,
      -4.6,
      CRANE_LEG_X_LAND + 1.25,
      13.5,
      4.05,
    ),
  );
  railLine(
    o,
    l,
    [
      [CRANE_LEG_X_LAND + 1.22, 13.5, -4.6],
      [CRANE_LEG_X_LAND + 1.22, 13.5, 4.05],
    ],
    {
      tint: CRANE_TINT_WARM,
    },
  );
  let A = CRANE_LEG_X_SEA + 1.3;
  for (let R of [-1, 1]) {
    let I = R * CRANE_BOOM_HALF_WIDTH,
      se = [
        CRANE_BOOM_X_BACK,
        15.4,
        CRANE_LEG_X_LAND,
        22,
        25.2,
        CRANE_LEG_X_SEA,
        A - 0.15,
        A + 0.15,
        34.6,
        39.2,
        43.8,
        48.4,
        53,
        57.6,
        CRANE_BOOM_X_TIP,
      ];
    for (let ce = 0; ce < se.length - 1; ce++) {
      if (ce !== 6) {
        g(
          a,
          boxBetween(
            se[ce],
            CRANE_BOOM_BOTTOM_Y,
            I - 0.45,
            se[ce + 1],
            CRANE_BOOM_TOP_Y,
            I + 0.45,
            0.05,
          ),
          CRANE_TINT_MAIN,
        );
        if (ce > 0 && ce !== 7) {
          g(
            a,
            boxBetween(
              se[ce] - 0.035,
              CRANE_BOOM_BOTTOM_Y - 0.05,
              I - 0.5,
              se[ce] + 0.035,
              CRANE_BOOM_TOP_Y + 0.05,
              I + 0.5,
            ),
            CRANE_TINT_SHADE,
          );
        }
      }
    }
    g(
      a,
      boxBetween(
        A - 0.7,
        CRANE_BOOM_TOP_Y - 0.1,
        I - 0.52,
        A + 0.7,
        CRANE_BOOM_TOP_Y + 0.55,
        I - 0.4,
        0.03,
      ),
      CRANE_TINT_SHADE,
    );
    g(
      a,
      boxBetween(
        A - 0.7,
        CRANE_BOOM_TOP_Y - 0.1,
        I + 0.4,
        A + 0.7,
        CRANE_BOOM_TOP_Y + 0.55,
        I + 0.52,
        0.03,
      ),
      CRANE_TINT_SHADE,
    );
    g(h, axisCylinder(0.16, 0.16, 1.2, "z", A, CRANE_BOOM_TOP_Y + 0.22, I, 12));
    g(
      f,
      boxBetween(
        CRANE_BOOM_X_BACK + 0.3,
        CRANE_BOOM_TOP_Y,
        I - R * 0.32 - 0.05,
        CRANE_BOOM_X_TIP - 0.3,
        CRANE_BOOM_TOP_Y + 0.09,
        I - R * 0.32 + 0.05,
      ),
    );
    let ae = I + R * 0.45,
      k = I + R * 1.35;
    g(
      h,
      boxBetween(
        CRANE_BOOM_X_BACK + 0.2,
        21.86,
        Math.min(ae, k),
        CRANE_BOOM_X_TIP - 0.2,
        21.9,
        Math.max(ae, k),
      ),
    );
    for (let ce = CRANE_BOOM_X_BACK + 0.6; ce < CRANE_BOOM_X_TIP; ce += 2.45) {
      g(
        a,
        girder([ce, 21.84, ae], [ce, 21.3, ae], 0.07, 0.07),
        CRANE_TINT_SHADE,
      );
      g(
        a,
        girder([ce, 21.82, k], [ce, 21.36, ae], 0.06, 0.08),
        CRANE_TINT_SHADE,
      );
    }
    railLine(
      o,
      l,
      [
        [CRANE_BOOM_X_BACK + 0.2, 21.9, k - R * 0.03],
        [CRANE_BOOM_X_TIP - 0.2, 21.9, k - R * 0.03],
      ],
      {
        post: 2.45,
        tint: CRANE_TINT_WARM,
      },
    );
    g(
      l,
      boxBetween(
        CRANE_BOOM_X_BACK + 0.2,
        21.9,
        k - R * 0.03 - 0.008,
        CRANE_BOOM_X_TIP - 0.2,
        22.02,
        k - R * 0.03 + 0.008,
      ),
      CRANE_TINT_WARM,
    );
    for (let ce of [44, 58])
      g(
        a,
        boxBetween(
          ce - 0.18,
          CRANE_BOOM_TOP_Y,
          I - 0.2,
          ce + 0.18,
          CRANE_BOOM_TOP_Y + 1.5,
          I + 0.2,
          0.03,
        ),
        CRANE_TINT_MAIN,
      );
  }
  for (let R of [44, 58])
    g(
      a,
      boxBetween(
        R - 0.2,
        CRANE_BOOM_TOP_Y + 1.2,
        -CRANE_BOOM_HALF_WIDTH - 0.3,
        R + 0.2,
        CRANE_BOOM_TOP_Y + 1.6,
        CRANE_BOOM_HALF_WIDTH + 0.3,
        0.04,
      ),
      CRANE_TINT_MAIN,
    );
  for (let R of [CRANE_BOOM_X_BACK + 0.25, CRANE_BOOM_X_TIP - 0.25]) {
    g(
      a,
      boxBetween(
        R - 0.25,
        CRANE_BOOM_BOTTOM_Y + 0.1,
        -CRANE_BOOM_HALF_WIDTH + 0.45,
        R + 0.25,
        CRANE_BOOM_TOP_Y - 0.1,
        CRANE_BOOM_HALF_WIDTH - 0.45,
        0.05,
      ),
      CRANE_TINT_MAIN,
    );
    let I = R < 30 ? 1 : -1;
    for (let se of [-0.8, 0.8])
      g(f, axisCylinder(0.14, 0.14, 0.4, "x", R + I * 0.45, 22, se, 10));
  }
  g(
    h,
    boxBetween(
      CRANE_BOOM_X_TIP - 0.1,
      21.86,
      -CRANE_BOOM_HALF_WIDTH - 1.35,
      CRANE_BOOM_X_TIP + 0.9,
      21.9,
      CRANE_BOOM_HALF_WIDTH + 1.35,
    ),
  );
  railLine(
    o,
    l,
    [
      [CRANE_BOOM_X_TIP - 0.1, 21.9, -CRANE_BOOM_HALF_WIDTH - 1.32],
      [CRANE_BOOM_X_TIP + 0.87, 21.9, -CRANE_BOOM_HALF_WIDTH - 1.32],
      [CRANE_BOOM_X_TIP + 0.87, 21.9, CRANE_BOOM_HALF_WIDTH + 1.32],
      [CRANE_BOOM_X_TIP - 0.1, 21.9, CRANE_BOOM_HALF_WIDTH + 1.32],
    ],
    {
      post: 1.4,
      tint: CRANE_TINT_WARM,
    },
  );
  g(
    h,
    strut(
      [CRANE_BOOM_X_TIP + 0.6, 21.9, 0],
      [CRANE_BOOM_X_TIP + 0.6, 25.2, 0],
      0.035,
      6,
    ),
  );
  g(
    h,
    strut(
      [CRANE_BOOM_X_TIP + 0.6, 24.8, -0.45],
      [CRANE_BOOM_X_TIP + 0.6, 24.8, 0.45],
      0.015,
      4,
    ),
  );
  r.add(
    lampGeo(CRANE_BOOM_X_TIP + 0.6, 25.32, 0, 0.13),
    [9, 0.5, 0.25],
    2.6,
    0.5,
    0.45,
  );
  g(f, axisCylinder(0.1, 0.12, 0.1, "y", CRANE_BOOM_X_TIP + 0.6, 25.2, 0, 8));
  let _ = 27.6,
    M = 30,
    E = 1.5;
  for (let R of [-1, 1]) {
    g(
      a,
      girder(
        [CRANE_LEG_X_SEA, 23.8, R * CRANE_LEG_HALF_SPAN_Z],
        [_, M, R * E],
        0.55,
        0.55,
        0.04,
      ),
      CRANE_TINT_MAIN,
    );
    g(
      a,
      girder(
        [CRANE_LEG_X_LAND, 23.8, R * CRANE_LEG_HALF_SPAN_Z],
        [_, M, R * E],
        0.5,
        0.5,
        0.04,
      ),
      CRANE_TINT_MAIN,
    );
    for (let [I, se] of [
      [44, 0.1],
      [58, 0.1],
    ]) {
      let ae = vec3(_ + 0.3, M, R * E),
        k = vec3(I, CRANE_BOOM_TOP_Y + 1.45, R * CRANE_BOOM_HALF_WIDTH);
      g(a, strut(ae, k, se, 8), CRANE_TINT_MAIN);
      let ce = ae.clone().lerp(k, 0.5);
      g(
        a,
        boxBetween(
          ce.x - 0.3,
          ce.y - 0.16,
          ce.z - 0.14,
          ce.x + 0.3,
          ce.y + 0.16,
          ce.z + 0.14,
          0.03,
        ),
        CRANE_TINT_SHADE,
      );
    }
    g(
      f,
      strut(
        [_ + 0.2, M + 0.35, R * 0.9],
        [50, CRANE_BOOM_TOP_Y + 0.2, R * 1],
        0.022,
        5,
      ),
    );
    g(f, axisCylinder(0.5, 0.5, 0.18, "z", _, M + 0.25, R * 0.9, 16));
  }
  g(
    a,
    boxBetween(_ - 0.45, M - 0.35, -E - 0.5, _ + 0.45, M + 0.3, E + 0.5, 0.05),
    CRANE_TINT_MAIN,
  );
  {
    let R = (k: number, ce: number) =>
        vec3(
          CRANE_LEG_X_SEA + (_ - CRANE_LEG_X_SEA) * k,
          23.8 + (M - 23.8) * k,
          ce * (CRANE_LEG_HALF_SPAN_Z + (E - CRANE_LEG_HALF_SPAN_Z) * k),
        ),
      I = (k: number, ce: number) =>
        vec3(
          CRANE_LEG_X_LAND + (_ - CRANE_LEG_X_LAND) * k,
          23.8 + (M - 23.8) * k,
          ce * (CRANE_LEG_HALF_SPAN_Z + (E - CRANE_LEG_HALF_SPAN_Z) * k),
        );
    g(a, girder(R(0.5, -1), R(0.5, 1), 0.3, 0.3, 0.02), CRANE_TINT_MAIN);
    g(a, girder(I(0.55, -1), I(0.55, 1), 0.3, 0.3, 0.02), CRANE_TINT_MAIN);
    g(a, strut(I(0.55, -1), R(0.5, -1), 0.09, 6), CRANE_TINT_MAIN);
    g(a, strut(I(0.55, 1), R(0.5, 1), 0.09, 6), CRANE_TINT_MAIN);
    let se = R(0.02, 1),
      ae = R(0.97, 1);
    for (let k of [-0.22, 0.22])
      g(
        h,
        strut(
          [se.x - 0.42, se.y, se.z + k],
          [ae.x - 0.42, ae.y, ae.z + k],
          0.02,
          4,
        ),
      );
    for (let k = 0.03; k < 1; k += 0.045) {
      let ce = se.clone().lerp(ae, k);
      g(
        h,
        strut(
          [ce.x - 0.42, ce.y, ce.z - 0.22],
          [ce.x - 0.42, ce.y, ce.z + 0.22],
          0.012,
          4,
        ),
      );
    }
  }
  g(
    a,
    boxBetween(
      CRANE_BOOM_X_BACK + 0.05,
      CRANE_BOOM_TOP_Y,
      -3.6,
      CRANE_BOOM_X_BACK + 0.55,
      CRANE_BOOM_TOP_Y + 0.4,
      3.6,
      0.04,
    ),
    CRANE_TINT_MAIN,
  );
  for (let R of [-1, 1]) {
    g(
      a,
      boxBetween(
        CRANE_BOOM_X_BACK + 0.08,
        CRANE_BOOM_TOP_Y + 0.4,
        R * 3.3 - 0.2,
        CRANE_BOOM_X_BACK + 0.52,
        CRANE_BOOM_TOP_Y + 1,
        R * 3.3 + 0.2,
        0.03,
      ),
      CRANE_TINT_SHADE,
    );
    g(
      a,
      strut(
        [_ - 0.3, M, R * E],
        [CRANE_BOOM_X_BACK + 0.3, CRANE_BOOM_TOP_Y + 0.8, R * 3.3],
        0.1,
        8,
      ),
      CRANE_TINT_MAIN,
    );
    g(
      h,
      axisCylinder(
        0.12,
        0.12,
        0.6,
        "z",
        CRANE_BOOM_X_BACK + 0.3,
        CRANE_BOOM_TOP_Y + 0.8,
        R * 3.3,
        10,
      ),
    );
  }
  g(h, boxBetween(_ - 1, M + 0.3, -E - 0.6, _ + 1, M + 0.34, E + 0.6));
  railLine(
    o,
    l,
    [
      [_ - 0.98, M + 0.34, -E - 0.58],
      [_ + 0.98, M + 0.34, -E - 0.58],
      [_ + 0.98, M + 0.34, E + 0.58],
      [_ - 0.98, M + 0.34, E + 0.58],
      [_ - 0.98, M + 0.34, -E - 0.58],
    ],
    {
      post: 1.2,
      tint: CRANE_TINT_WARM,
    },
  );
  g(h, strut([_, M + 0.34, 0], [_, M + 2, 0], 0.045, 6));
  g(h, strut([_, M + 2, 0], [_, M + 3.6, 0], 0.016, 4));
  g(h, strut([_ - 0.5, M + 1.5, 0], [_ + 0.5, M + 1.5, 0], 0.018, 4));
  for (let R of [-0.5, 0.5]) {
    g(f, axisCylinder(0.1, 0.12, 0.1, "y", _ + R, M + 1.56, 0, 8));
    r.add(lampGeo(_ + R, M + 1.72, 0, 0.15), [10, 0.5, 0.25], 2.6, 0, 0.45);
  }
  let w = 20.4,
    S = 27.9,
    z = CRANE_BOOM_TOP_Y,
    H = 26,
    O = 2.9;
  g(c, boxBetween(w, z, -O, S, H, O, 0.06), CRANE_TINT_WHITE);
  g(
    a,
    boxBetween(
      w - 0.15,
      z - 0.12,
      -O - 0.15,
      S + 0.15,
      z + 0.1,
      O + 0.15,
      0.03,
    ),
    CRANE_TINT_SHADE,
  );
  g(h, boxBetween(w - 0.2, H, -O - 0.2, S + 0.2, H + 0.12, O + 0.2, 0.03));
  for (let R = w + 1.3; R < S; R += 1.3)
    for (let I of [-1, 1])
      g(
        c,
        boxBetween(
          R - 0.02,
          z + 0.1,
          I * O - 0.015,
          R + 0.02,
          H,
          I * O + 0.015,
        ),
        [0.7, 0.72, 0.74],
      );
  function q(
    R: number,
    I: number,
    se: number,
    ae: number,
    k: number,
    ce: number,
  ) {
    let ve = [boxBetween(-ae / 2, -k / 2, 0, ae / 2, k / 2, 0.02)],
      _e = Math.round(k / 0.12);
    for (let Te = 0; Te < _e; Te++) {
      let Pe = boxBetween(
        -ae / 2 + 0.03,
        -0.012,
        0,
        ae / 2 - 0.03,
        0.012,
        0.11,
      );
      Pe.rotateX(0.7);
      Pe.translate(0, -k / 2 + (Te + 0.5) * (k / _e), 0.03);
      ve.push(Pe);
    }
    for (let Te of ve) {
      Te.rotateY(ce);
      Te.translate(R, I, se);
    }
    g(f, ve.shift());
    g(h, ve);
  }
  for (let R of [-1, 1])
    for (let I of [w + 1.4, w + 3.9, w + 6.1])
      q(I, 24.5, R * (O + 0.005), 1.5, 1.3, R > 0 ? 0 : Math.PI);
  q(w - 0.005, 23.75, -1.9, 1.4, 1.1, -Math.PI / 2);
  g(
    c,
    boxBetween(w - 0.03, z + 0.15, 0.8, w, z + 2.15, 1.7, 0.01),
    [0.6, 0.64, 0.68],
  );
  g(h, strut([w - 0.06, z + 1, 1.55], [w - 0.06, z + 1.3, 1.55], 0.014, 5));
  g(h, boxBetween(w - 0.9, z + 0.05, 0.3, w, z + 0.1, 2.2));
  railLine(
    o,
    l,
    [
      [w, z + 0.1, 0.32],
      [w - 0.88, z + 0.1, 0.32],
      [w - 0.88, z + 0.1, 2.18],
      [w, z + 0.1, 2.18],
    ],
    {
      post: 1,
      tint: CRANE_TINT_WARM,
    },
  );
  let U = i.mats.decal("logo_a");
  g(
    U.material,
    panelGeo(
      1.1 * Math.min(3, U.aspect || 1),
      1.1,
      w - 0.012,
      25.2,
      0,
      -Math.PI / 2,
    ),
  );
  railLine(
    o,
    l,
    [
      [w, H + 0.12, -O],
      [S, H + 0.12, -O],
      [S, H + 0.12, O],
      [w, H + 0.12, O],
      [w, H + 0.12, -O],
    ],
    {
      post: 1.95,
      tint: CRANE_TINT_WARM,
    },
  );
  for (let R of [w + 1.9, w + 5.6]) {
    g(h, axisCylinder(0.28, 0.28, 0.5, "y", R, H + 0.37, -1.2, 10));
    g(h, axisCylinder(0.1, 0.5, 0.22, "y", R, H + 0.72, -1.2, 10));
  }
  g(f, axisCylinder(0.13, 0.13, 1.6, "y", w + 3.7, H + 0.9, 1.9, 8));
  g(f, axisCylinder(0.2, 0.14, 0.2, "y", w + 3.7, H + 1.75, 1.9, 8));
  g(
    c,
    boxBetween(w + 5.4, H + 0.12, 0.4, w + 6.7, H + 0.85, 1.8, 0.03),
    [0.7, 0.72, 0.75],
  );
  g(h, strut([w + 0.3, H + 0.12, 2.5], [w + 0.3, H + 1.9, 2.5], 0.03, 5));
  r.add(lampGeo(w + 0.3, H + 2.02, 2.5, 0.13), [9, 0.5, 0.25], 2.6, 0.25, 0.45);
  let T = 6.15,
    D = 6.97,
    C = 7.8,
    G = [19.4, 20.6],
    j = [26.4, 27.6];
  function N(
    R: number,
    I: number,
    se: number,
    ae: number,
    k: number,
    ce: number,
  ) {
    let ve = ae - I,
      _e = Math.max(2, Math.round(ve / 0.21));
    for (let Te of [k + 0.03, ce - 0.03]) {
      g(h, girder([R, I - 0.12, Te], [se, ae - 0.12, Te], 0.05, 0.24));
      g(l, strut([R, I + 1, Te], [se, ae + 1, Te], 0.024, 5), CRANE_TINT_WARM);
      g(
        l,
        strut([R, I + 0.5, Te], [se, ae + 0.5, Te], 0.018, 4),
        CRANE_TINT_WARM,
      );
      for (let Pe = 0; Pe <= 4; Pe++) {
        let Re = Pe / 4,
          Fe = R + (se - R) * Re,
          ze = I + ve * Re;
        g(
          l,
          strut([Fe, ze - 0.05, Te], [Fe, ze + 1, Te], 0.02, 4),
          CRANE_TINT_WARM,
        );
      }
    }
    for (let Te = 1; Te <= _e; Te++) {
      let Pe = (Te - 0.5) / _e,
        Re = R + (se - R) * Pe,
        Fe = I + ve * (Te / _e);
      g(
        h,
        boxBetween(Re - 0.13, Fe - 0.03, k + 0.06, Re + 0.13, Fe, ce - 0.06),
      );
    }
  }
  function Q(R: number, I: number, se: number, ae: number) {
    g(h, boxBetween(R, se - 0.05, T, I, se, C));
    g(h, boxBetween(R, se - 0.2, T, I, se - 0.05, T + 0.06));
    g(h, boxBetween(R, se - 0.2, C - 0.06, I, se - 0.05, C));
    let k = ae > 0 ? I - 0.03 : R + 0.03,
      ce = ae > 0 ? R : I;
    railLine(
      o,
      l,
      [
        [ce, se, C - 0.03],
        [k, se, C - 0.03],
        [k, se, T + 0.03],
      ],
      {
        post: 0.9,
        tint: CRANE_TINT_WARM,
      },
    );
  }
  let K = [3.6, 6.9, 10.2, 13.5, 16.8, 20.1];
  for (let R = 0; R < 5; R++) {
    if (R % 2 === 0) {
      Q(G[0], G[1], K[R], -1);
      N(G[1], K[R], j[0], K[R + 1], T, D);
    } else {
      Q(j[0], j[1], K[R], 1);
      N(j[0], K[R], G[1], K[R + 1], D, C);
    }
  }
  Q(j[0], j[1], K[5], 1);
  N(j[0], K[5], 23.4, 21.9, D, C);
  g(h, boxBetween(22.5, 21.85, CRANE_BOOM_HALF_WIDTH + 1.35, 23.4, 21.9, C));
  railLine(
    o,
    l,
    [
      [22.53, 21.9, CRANE_BOOM_HALF_WIDTH + 1.4],
      [22.53, 21.9, C - 0.03],
      [23.37, 21.9, C - 0.03],
    ],
    {
      post: 1.3,
      tint: CRANE_TINT_WARM,
    },
  );
  railLine(
    o,
    l,
    [
      [23.37, 21.9, CRANE_BOOM_HALF_WIDTH + 1.4],
      [23.37, 21.9, D],
    ],
    {
      post: 1.3,
      tint: CRANE_TINT_WARM,
    },
  );
  g(h, boxBetween(j[0], 13.45, 4.95, j[1], 13.5, T));
  for (let R of [G[0], j[1]])
    for (let I of [T - 0.05, C + 0.05])
      g(
        a,
        boxBetween(R - 0.07, 3.3, I - 0.07, R + 0.07, 21.4, I + 0.07),
        CRANE_TINT_MAIN,
      );
  for (let R = 0; R < K.length; R++) {
    let I = K[R] - 0.25;
    g(
      a,
      boxBetween(G[0], I - 0.06, C + 0, j[1], I + 0.06, C + 0.1),
      CRANE_TINT_SHADE,
    );
    for (let se of [G[0], j[1]])
      g(
        a,
        boxBetween(se - 0.05, I - 0.06, 5.9, se + 0.05, I + 0.06, C + 0.1),
        CRANE_TINT_SHADE,
      );
    if (R < K.length - 1) {
      let se = K[R + 1] - 0.25;
      g(
        a,
        strut([G[0], I, C + 0.05], [j[1], se, C + 0.05], 0.03, 5),
        CRANE_TINT_MAIN,
      );
      g(
        a,
        strut([j[1], I, C + 0.05], [G[0], se, C + 0.05], 0.03, 5),
        CRANE_TINT_MAIN,
      );
    }
  }
  {
    let R = G[0] - 0.05,
      I = 7.35;
    for (let ae of [-0.22, 0.22])
      g(h, strut([R, 0.05, I + ae], [R, 4.75, I + ae], 0.022, 5));
    for (let ae = 0.3; ae < 4.7; ae += 0.3)
      g(h, strut([R, ae, I - 0.22], [R, ae, I + 0.22], 0.012, 4));
    let se = (ae: number) => {
      let k: Vector3[] = [];
      for (let ce = 0; ce <= 8; ce++) {
        let ve = (Math.PI * ce) / 8;
        k.push(vec3(R - Math.sin(ve) * 0.7, ae, I - Math.cos(ve) * 0.36));
      }
      return k;
    };
    for (let ae = 2.3; ae <= 4.75; ae += 0.6) g(h, polyStrut(se(ae), 0.012, 4));
    for (let ae = 1; ae < 8; ae += 1.5) {
      let k = (Math.PI * ae) / 8;
      g(
        h,
        strut(
          [R - Math.sin(k) * 0.7, 2.3, I - Math.cos(k) * 0.36],
          [R - Math.sin(k) * 0.7, 4.75, I - Math.cos(k) * 0.36],
          0.01,
          4,
        ),
      );
    }
    x.push({
      min: [R - 0.72, 0, I - 0.4],
      max: [R + 0.05, 4.7, I + 0.4],
      bulletOnly: false,
    });
  }
  g(
    f,
    boxBetween(
      13,
      21.02,
      -CRANE_BOOM_HALF_WIDTH - 0.95,
      CRANE_TROLLEY_X - 1.2,
      21.12,
      -CRANE_BOOM_HALF_WIDTH - 0.85,
    ),
  );
  for (let R = 13.5; R < CRANE_TROLLEY_X - 1.2; R += 3.3)
    g(
      f,
      boxBetween(
        R - 0.03,
        21.1,
        -CRANE_BOOM_HALF_WIDTH - 0.93,
        R + 0.03,
        21.86,
        -CRANE_BOOM_HALF_WIDTH - 0.87,
      ),
    );
  {
    let se = (CRANE_TROLLEY_X - 1.6 - 13.6) / 15;
    for (let ae = 0; ae < 15; ae++) {
      let k = 13.6 + ae * se,
        ce = 1.1 + 0.25 * Math.sin(ae * 2.1);
      g(
        f,
        boxBetween(
          k - 0.1,
          20.9,
          -CRANE_BOOM_HALF_WIDTH - 0.98,
          k + 0.1,
          21.02,
          -CRANE_BOOM_HALF_WIDTH - 0.82,
        ),
      );
      for (let ve of [-0.05, 0.05]) {
        let _e: Vector3[] = [];
        for (let Te = 0; Te <= 7; Te++) {
          let Pe = Te / 7;
          _e.push(
            vec3(
              k + se * Pe,
              20.92 - ce * (1 - (2 * Pe - 1) ** 2),
              -CRANE_BOOM_HALF_WIDTH - 0.9 + ve,
            ),
          );
        }
        g(f, polyStrut(_e, 0.03, 4));
      }
    }
  }
  function ie(R: number, I: number, se: number, ae: number, k = "z") {
    let ce = ae * 0.46;
    if (k === "z") {
      g(
        f,
        boxBetween(R - 0.03, I, se - ce / 2, R + 0.03, I + 0.06, se + ce / 2),
      );
    } else {
      g(
        f,
        boxBetween(R - ce / 2, I, se - 0.03, R + ce / 2, I + 0.06, se + 0.03),
      );
    }
    for (let ve = 0; ve < ae; ve++) {
      let _e = (ve - (ae - 1) / 2) * 0.46,
        Te = k === "z" ? R : R + _e,
        Pe = k === "z" ? se + _e : se;
      g(
        f,
        boxBetween(
          Te - 0.17,
          I - 0.2,
          Pe - 0.17,
          Te + 0.17,
          I,
          Pe + 0.17,
          0.02,
        ),
      );
      g(
        v,
        boxBetween(
          Te - 0.14,
          I - 0.215,
          Pe - 0.14,
          Te + 0.14,
          I - 0.2,
          Pe + 0.14,
        ),
      );
    }
  }
  for (let R of [33, 47.5, 59.5])
    for (let I of [-1, 1])
      ie(R, 21.3, I * (CRANE_BOOM_HALF_WIDTH + 1.3), 3, "x");
  for (let R of [-1, 1]) {
    ie(23.5, 12.28, R * (CRANE_LEG_HALF_SPAN_Z - 0.2), 4, "x");
    ie(15, 21.3, R * (CRANE_BOOM_HALF_WIDTH + 1.3), 2, "x");
  }
  ie(CRANE_LEG_X_SEA + 0.1, 12.28, 0, 3, "z");
  ie(CRANE_LEG_X_LAND - 0.1, 12.28, 0, 3, "z");
  ie(_ + 0.6, M - 0.55, 0, 3, "z");
  g(
    l,
    boxBetween(
      CRANE_TROLLEY_X - 2.3,
      21.35,
      -1.25,
      CRANE_TROLLEY_X + 2.3,
      22.2,
      1.25,
      0.06,
    ),
    CRANE_TINT_WARM,
  );
  g(
    l,
    boxBetween(
      CRANE_TROLLEY_X - 1.6,
      20.7,
      -1.1,
      CRANE_TROLLEY_X + 1.6,
      21.35,
      1.1,
      0.05,
    ),
    CRANE_TINT_WARM,
  );
  for (let R of [-1.8, 1.8])
    for (let I of [-1, 1]) {
      g(
        f,
        axisCylinder(
          0.24,
          0.24,
          0.16,
          "z",
          CRANE_TROLLEY_X + R,
          22.42,
          I * 1.3,
          12,
        ),
      );
      g(
        l,
        boxBetween(
          CRANE_TROLLEY_X + R - 0.35,
          22.1,
          I * 1.3 - 0.14,
          CRANE_TROLLEY_X + R + 0.35,
          22.5,
          I * 1.3 + 0.14,
          0.03,
        ),
        CRANE_TINT_WARM,
      );
    }
  g(f, axisCylinder(0.42, 0.42, 1.5, "z", CRANE_TROLLEY_X - 0.9, 22.35, 0, 14));
  g(f, axisCylinder(0.42, 0.42, 1.5, "z", CRANE_TROLLEY_X + 0.9, 22.35, 0, 14));
  let F = CRANE_TROLLEY_X + 0.25,
    X = CRANE_TROLLEY_X + 2.65,
    ne = 2.35,
    re = 4.4,
    $ = 18.3,
    ue = 20.7;
  for (let R of [F + 0.12, X - 0.3]) {
    g(
      l,
      boxBetween(R - 0.12, 20.88, -1, R + 0.12, 21.16, re, 0.03),
      CRANE_TINT_WARM,
    );
    for (let I of [ne + 0.1, re - 0.1])
      g(
        l,
        boxBetween(R - 0.06, ue, I - 0.06, R + 0.06, 20.9, I + 0.06),
        CRANE_TINT_WARM,
      );
  }
  g(c, boxBetween(F, $, ne, X, $ + 0.14, re, 0.03), CRANE_TINT_WHITE);
  g(
    c,
    boxBetween(
      F - 0.08,
      ue - 0.02,
      ne - 0.08,
      X + 0.12,
      ue + 0.12,
      re + 0.08,
      0.03,
    ),
    CRANE_TINT_WHITE,
  );
  g(c, boxBetween(F, $ + 0.14, ne, F + 0.08, ue, re), CRANE_TINT_WHITE);
  for (let R of [ne, re - 0.06]) {
    g(
      c,
      boxBetween(F, $ + 0.14, R, X - 0.5, $ + 0.95, R + 0.06),
      CRANE_TINT_WHITE,
    );
    g(d, boxBetween(F + 0.08, $ + 0.95, R + 0.02, X - 0.06, ue, R + 0.04));
    g(d, boxBetween(X - 0.5, $ + 0.14, R + 0.02, X - 0.06, $ + 0.95, R + 0.04));
  }
  for (let R of [X - 0.06])
    for (let I of [ne, re - 0.06, (ne + re) / 2 - 0.03])
      g(
        c,
        boxBetween(R, $ + 0.14, I, R + 0.06, ue, I + 0.06),
        CRANE_TINT_WHITE,
      );
  g(d, boxBetween(X - 0.04, $ + 0.14, ne + 0.06, X - 0.02, ue, re - 0.06));
  g(d, boxBetween(X - 0.9, $ + 0.02, ne + 0.3, X - 0.1, $ + 0.04, re - 0.3));
  g(f, boxBetween(F + 0.9, $ + 0.14, 3.1, F + 1.45, $ + 0.6, 3.65, 0.04));
  g(f, boxBetween(F + 0.82, $ + 0.6, 3.1, F + 0.96, $ + 1.35, 3.65, 0.04));
  for (let R of [2.75, 4]) {
    g(
      f,
      boxBetween(
        F + 1.2,
        $ + 0.14,
        R - 0.16,
        F + 1.75,
        $ + 0.85,
        R + 0.16,
        0.03,
      ),
    );
    r.add(
      boxBetween(F + 1.3, $ + 0.855, R - 0.1, F + 1.6, $ + 0.865, R + 0.1),
      [0.75, 0.5, 0.26],
      0,
    );
  }
  r.add(
    boxBetween(F + 0.5, ue - 0.045, 3, F + 1.5, ue - 0.03, 3.2),
    [0.75, 0.5, 0.26],
    0,
  );
  ie(X + 0.15, $ + 0.1, 3.37, 2, "z");
  g(h, boxBetween(F - 0.9, $ + 0.1, ne, F, $ + 0.14, re));
  railLine(
    o,
    l,
    [
      [F, $ + 0.14, ne + 0.03],
      [F - 0.87, $ + 0.14, ne + 0.03],
      [F - 0.87, $ + 0.14, re - 0.03],
      [F, $ + 0.14, re - 0.03],
    ],
    {
      post: 1,
      tint: CRANE_TINT_WARM,
    },
  );
  let me = i.mats.label("几猫04号", {
      color: "white",
      font: "stencil",
      distress: 0.35,
    }),
    ee = Math.max(1, me.aspect || 6);
  {
    let R = Math.min(1.15, 8.6 / ee);
    for (let I of [-1, 1])
      g(
        me.material,
        panelGeo(
          R * ee,
          R,
          36.9,
          22,
          I * (CRANE_BOOM_HALF_WIDTH + 0.453),
          I > 0 ? 0 : Math.PI,
        ),
      );
  }
  {
    let R = Math.min(0.86, 9.4 / ee);
    g(
      me.material,
      panelGeo(R * ee, R, CRANE_LEG_X_LAND - 0.453, 13, 0, -Math.PI / 2),
    );
  }
  if (n) {
    o.remap = null;
    o.dz = 0;
    o.minSize = 0;
    return null;
  }
  let B = o.build({
    cast: true,
    recv: true,
  });
  B.name = "crane";
  let P = new GeoBucket(),
    V = (R: any, I: CylinderGeometry | null | BoxGeometry, se?: number[]) =>
      P.add(R, I, se),
    Y = 8.3;
  for (let R of [-0.9, 0.9])
    for (let I of [-0.8, 0.8])
      V(f, strut([R, 0, I], [R * 0.8, -Y, I * 0.7], 0.022, 5));
  V(
    l,
    boxBetween(-0.95, -Y - 0.55, -0.75, 0.95, -Y, 0.75, 0.05),
    CRANE_TINT_WARM,
  );
  for (let R of [-0.45, 0.45])
    V(f, axisCylinder(0.3, 0.3, 0.12, "z", 0, -Y + 0.12, R, 12));
  let L = -Y - 0.55,
    Z = L - 0.34;
  for (let R of [-0.6, 0.6])
    V(
      l,
      boxBetween(R - 0.16, Z, -6.02, R + 0.16, L, 6.02, 0.03),
      CRANE_TINT_WARM,
    );
  for (let R of [-5.92, 5.92])
    V(
      l,
      boxBetween(-1.22, Z, R - 0.14, 1.22, L, R + 0.14, 0.03),
      CRANE_TINT_WARM,
    );
  V(
    l,
    boxBetween(-0.9, Z - 0.02, -1.3, 0.9, L + 0.1, 1.3, 0.04),
    CRANE_TINT_WARM,
  );
  for (let R of [-1.2, 1.2])
    for (let I of [-6, 6]) {
      V(f, boxBetween(R - 0.1, Z - 0.1, I - 0.1, R + 0.1, Z + 0.05, I + 0.1));
      V(
        l,
        girder(
          [R * 1.02, Z, I * 1.01],
          [R * 1.22, Z - 0.55, I * 1.04],
          0.28,
          0.03,
        ),
        CRANE_TINT_WARM,
      );
    }
  let J = Z - 0.08,
    oe = J - 2.59,
    fe = [0.9, 0.82, 0.8];
  V(u, boxBetween(-1.2, oe, -6.08, 1.2, J, 6.08, 0.03), fe);
  for (let R of [-1.22, 1.22])
    for (let I = -5.7; I <= 5.71; I += 0.57)
      V(
        u,
        boxBetween(R - 0.02, oe + 0.16, I - 0.1, R + 0.02, J - 0.12, I + 0.1),
        fe,
      );
  for (let R of [-6.095, 6.095])
    for (let I of [-1.22, 1.22])
      V(
        u,
        boxBetween(I - 0.08, oe, R - 0.08, I + 0.08, J, R + 0.08),
        [0.7, 0.62, 0.6],
      );
  for (let R of [-0.8, -0.3, 0.3, 0.8])
    V(f, strut([R, oe + 0.08, 6.1], [R, J - 0.08, 6.1], 0.02, 5));
  let le = P.build({
    cast: true,
    recv: true,
  });
  le.position.set(CRANE_TROLLEY_X, 20.7, 0);
  le.userData.noMerge = true;
  le.name = "crane-spreader";
  B.add(le);
  return {
    root: B,
    spreader: le,
    colliders: x,
    tris: o.tris + P.tris,
  };
}
export function buildCraneLights(
  i: any,
  e: any,
  t: number,
  n: number,
  {
    s = 1,
    up: o = false,
    tint: r = [0.3, 0.36, 0.44],
  }: { s?: number; up?: boolean; tint?: number[] } = {},
): number[] {
  let a: BoxGeometry[] = [],
    l = (c: number, u: number, h: number, f: number, p: number, d: number) =>
      a.push(boxBetween(c, u, h, f, p, d));
  for (let c of [-5, 5])
    for (let u of [-5.4, 5.4]) l(c - 0.6, 0, u - 0.6, c + 0.6, 24, u + 0.6);
  for (let c of [-5.4, 5.4]) {
    l(-5, 12.5, c - 0.45, 5, 13.5, c + 0.45);
    l(-5, 23, c - 0.4, 5, 23.8, c + 0.4);
    a.push(girder([-5, 13.5, c], [5, 23, c], 0.4, 0.4));
  }
  for (let c of [-5, 5]) {
    l(c - 0.45, 12.5, -5.4, c + 0.45, 13.5, 5.4);
    l(c - 0.45, 22.8, -5.4, c + 0.45, 23.8, 5.4);
    l(c - 0.45, 3.6, -5.4, c + 0.45, 4.6, 5.4);
  }
  l(-11.5, 21.2, -2.3, 6.3, 22.8, 2.3);
  l(-10.9, 22.8, -2.9, -3.1, 26, 2.9);
  for (let c of [-1, 1]) {
    a.push(girder([5, 23.8, c * 5.4], [4.1, 30, c * 1.5], 0.6, 0.6));
    a.push(girder([-5, 23.8, c * 5.4], [4.1, 30, c * 1.5], 0.5, 0.5));
  }
  l(3.6, 29.6, -2, 4.6, 30.4, 2);
  if (o) {
    a.push(girder([6.6, 22, 0], [10.5, 52, 0], 4.6, 1.6));
    a.push(girder([4.1, 30, 0], [9.4, 44, 0], 0.3, 0.3));
  } else {
    l(6.6, 21.2, -2.3, 38.5, 22.8, 2.3);
    a.push(girder([4.1, 30, 0], [20.5, 24.3, 0], 0.3, 0.3));
    a.push(girder([4.1, 30, 0], [34.5, 24.3, 0], 0.3, 0.3));
    l(15, 18.3, 2.4, 19.5, 22.2, 4.4);
  }
  for (let c of a) {
    c.scale(s, s, s);
    c.translate(t, 0, n);
    i.add(e, c, r);
  }
  return o ? [t + 10.5 * s, 52.6 * s, n] : [t + 4.1 * s, 31 * s, n];
}
export const SHIP_CENTER_X = 41;
const SHIP_HALF_BEAM = 8;
export const SHIP_BOW_Z = -9;
export const SHIP_LENGTH = 63;
export const SHIP_KEEL_Y = -4.4;
export const SHIP_DECK_Y = 13;
export const SHIP_BILGE_Y = -1.6;
const shipSmoothstep = (i: number, e: number, t: number) => {
  let n = Math.min(1, Math.max(0, (t - i) / (e - i)));
  return n * n * (3 - 2 * n);
};
const shipSheerAt = (i: number) =>
  1.7 * Math.pow(Math.max(0, 1 - i / 20), 2) +
  0.5 * Math.pow(Math.max(0, (i - (SHIP_LENGTH - 12)) / 12), 2);
export const shipDeckYAt = (i: number) => SHIP_DECK_Y + shipSheerAt(i);
export const shipBulwarkHeightAt = (i: number) =>
  1.15 *
  (1 -
    shipSmoothstep(14.5, 18, i) +
    shipSmoothstep(SHIP_LENGTH - 10.5, SHIP_LENGTH - 8, i));
export const shipBulwarkTopAt = (i: number) =>
  shipDeckYAt(i) + shipBulwarkHeightAt(i);
const SHIP_BOW_BULWARK_TOP = shipBulwarkTopAt(0);
export function hullPoint(i: number, e: number, t: number) {
  let n = (SHIP_BOW_BULWARK_TOP - e) * 0.22,
    s = Math.max(0, 1 - i / 22),
    o = SHIP_BOW_Z - i - n * s,
    r = Math.min(
      1,
      Math.max(0, (e - SHIP_BILGE_Y) / (SHIP_DECK_Y - SHIP_BILGE_Y)),
    ),
    a = 17 - 8.5 * Math.pow(r, 1.3),
    l = i / a,
    c = l >= 1 ? 1 : Math.pow(Math.sin((l * Math.PI) / 2), 0.72),
    u = 0.2 + (SHIP_HALF_BEAM - 0.2) * c,
    h = (i - (SHIP_LENGTH - 10)) / 10;
  if (h > 0) {
    u *= 1 - 0.24 * h * h * (1 - 0.6 * r);
  }
  return new Vector3(SHIP_CENTER_X + t * u, e, o);
}
export function hullNormal(i: number, e: number, t: number) {
  let s = hullPoint(i + 0.05, e, t).sub(hullPoint(Math.max(0, i - 0.05), e, t)),
    o = hullPoint(i, e + 0.05, t).sub(hullPoint(i, e - 0.05, t)),
    r = s.cross(o).normalize();
  if (r.x * t + r.z * 0.25 < 0) {
    r.negate();
  }
  return r;
}
export function hullStrip(
  i: number,
  e: number,
  t: number,
  n: number,
  s: number,
  o = 0.012,
  r = 6,
  a = 1,
) {
  let l: number[] = [],
    c: number[] = [],
    u: number[] = [],
    h: number[] = [];
  for (let d = 0; d <= a; d++)
    for (let v = 0; v <= r; v++) {
      let g = i + ((e - i) * v) / r,
        x = t + ((n - t) * d) / a,
        y = hullNormal(g, x, s),
        b = hullPoint(g, x, s).addScaledVector(y, o);
      l.push(b.x, b.y, b.z);
      u.push(y.x, y.y, y.z);
      c.push(s < 0 ? 1 - v / r : v / r, d / a);
    }
  let f = r + 1;
  for (let d = 0; d < a; d++)
    for (let v = 0; v < r; v++) {
      let g = d * f + v,
        x = g + 1,
        y = g + f + 1,
        b = g + f;
      if (s > 0) {
        h.push(g, x, y, g, y, b);
      } else {
        h.push(g, y, x, g, b, y);
      }
    }
  let p = new BufferGeometry();
  p.setAttribute("position", new Float32BufferAttribute(l, 3));
  p.setAttribute("normal", new Float32BufferAttribute(u, 3));
  p.setAttribute("uv", new Float32BufferAttribute(c, 2));
  p.setIndex(h);
  return p;
}
