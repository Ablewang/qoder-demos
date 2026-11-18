import { TorusGeometry, Vector3 } from "three";
import {
  buildCableRun,
  buildHandCart,
  buildPipeBundle,
  buildRackedDrums,
  buildWheelChock,
  buildWorkbench,
} from "./warehouse";

const QUAY = {
  X: 30,
  LADDER_Z: 20,
  RAILS: [18.5, 28.5],
  Z0: -30,
  Z1: 28,
};
export function buildQuay(i: any) {
  let {
      M: e,
      box: t,
      slab: n,
      cyl: s,
      rod: o,
      tube: r,
      col: a,
      add: l,
      place: c,
    } = i,
    { X: u, LADDER_Z: h, Z0: f, Z1: p } = QUAY,
    d = e("concrete"),
    v = e("concrete_dirty"),
    g = e("steel_worn"),
    x = e("steel_dark"),
    y = e("steel_galv"),
    b = e("paint_yellow"),
    m = h - 0.42,
    A = h + 0.42;
  for (let [E, w] of [
    [f - 1, m],
    [A, p + 1],
  ]) {
    n(d, u - 0.65, -0.7, E, u, 0.028, w, {
      bevel: 0.03,
    });
    n(g, u - 0.07, -0.16, E, u + 0.022, 0.036, w, {
      bevel: 0.012,
    });
    n(b, u - 0.66, 0, E, u - 0.5, 0.032, w);
    n(v, u - 0.55, -4.2, E, u - 0.02, -0.7, w);
  }
  n(d, u - 0.65, -0.7, m, u - 0.38, 0.028, A);
  n(v, u - 0.55, -4.2, m, u - 0.38, -0.7, A);
  for (let E of [m, A])
    n(g, u - 0.38, -0.16, E - 0.02, u + 0.02, 0.034, E + 0.02);
  for (let E = f + 4; E < p; E += 6) {
    if (!(Math.abs(E - h) < 1)) {
      n(x, u - 0.03, -4.2, E - 0.02, u - 0.012, -0.2, E + 0.02, {
        cast: false,
      });
      i.decal("rust_run", 0.7, u - 0.015, -1.3, E + 1.4, "x+");
    }
  }
  a(u - 0.65, -4.2, f - 1, u, 0.028, p + 1, "concrete", {
    noNav: true,
  });
  a(u + 0.03, -5, f - 2, u + 0.7, 8, p + 2, "concrete", {
    playerOnly: true,
  });
  {
    let E = u - 0.12;
    for (let S of [-1, 1]) {
      let z = h + S * 0.26;
      r(
        e("paint_yellow"),
        [
          [E, -3.9, z],
          [E, 0.2, z],
          [E, 0.95, z],
          [E - 0.12, 1.12, z],
          [E - 0.5, 1.12, z],
          [E - 0.62, 0.95, z],
          [E - 0.62, 0.03, z],
        ],
        0.024,
        {
          radial: 7,
          tension: 0.2,
        },
      );
      t(x, 0.12, 0.012, 0.12, E - 0.62, 0.034, z);
    }
    for (let S = -3.7; S < 0; S += 0.3)
      o(y, [E, S, h - 0.26], [E, S, h + 0.26], 0.014, {
        seg: 6,
      });
    for (let S of [-3, -1.6, -0.3])
      for (let z of [-1, 1])
        o(y, [E, S, h + z * 0.26], [u - 0.38, S, h + z * 0.26], 0.012);
    let w = [[h - 2.6], [h - 0.9], [h + 0.9], [h + 2.6]];
    for (let [S] of w) {
      s(b, 0.032, 1.05, u - 0.82, 0.525, S, {
        seg: 8,
      });
      s(x, 0.09, 0.02, u - 0.82, 0.01, S, {
        seg: 10,
      });
      s(x, 0.045, 0.03, u - 0.82, 1.06, S, {
        seg: 8,
      });
    }
    for (let [S, z] of [
      [h - 2.6, h - 0.9],
      [h + 0.9, h + 2.6],
    ])
      for (let H of [0.98, 0.55])
        r(
          y,
          [
            [u - 0.82, H, S],
            [u - 0.82, H - 0.1, (S + z) / 2 - 0.3],
            [u - 0.82, H - 0.12, (S + z) / 2 + 0.3],
            [u - 0.82, H, z],
          ],
          0.012,
          {
            radial: 5,
          },
        );
    i.label("四号登船点", 0.2, u - 1.3, 0.006, h - 1.4, "y+", {
      color: "yellow",
      font: "stencil",
      distress: 0.4,
    });
  }
  let _ = new TorusGeometry(0.4, 0.16, 8, 16);
  _.rotateY(Math.PI / 2);
  for (let E = f + 2.5, w = 0; E < p; E += 5, w++) {
    if (Math.abs(E - h) < 2) {
      continue;
    }
    n(e("wood_dark"), u + 0, -3.9, E - 0.16, u + 0.2, -0.25, E + 0.16, {
      bevel: 0.02,
    });
    n(x, u - 0.01, -0.5, E - 0.2, u + 0.215, -0.42, E + 0.2);
    n(x, u - 0.01, -2.4, E - 0.2, u + 0.215, -2.32, E + 0.2);
    let S = E + 2.4;
    if (Math.abs(S - h) < 1.6 || S > p - 0.5) {
      continue;
    }
    let z = -0.85 - (w % 3) * 0.18;
    l(_.clone(), e("tire"), {
      p: [u + 0.17, z, S],
    });
    if (w % 2) {
      l(_.clone(), e("tire"), {
        p: [u + 0.17, z - 0.86, S + 0.05],
      });
    }
    for (let H of [-1, 1])
      o(
        y,
        [u - 0.02, 0.02, S + H * 0.3],
        [u + 0.17, z + 0.36, S + H * 0.16],
        0.011,
        {
          seg: 5,
        },
      );
    t(x, 0.1, 0.03, 0.8, u - 0.06, 0.04, S);
  }
  let M = [-22, -12, -2, 9, 16.4, 25.6];
  for (let E of M)
    c("bollard_mooring", 29.2, E, 0, {
      seed: Math.round(E + 40),
    });
  {
    let E = [...M.map((S) => [S - 1.1, S + 1.1]), [h - 3, h + 3]].sort(
        (S, z) => S[0] - z[0],
      ),
      w = f + 0.3;
    for (let [S, z] of [...E, [p - 0.3, p]]) {
      if (S - w > 1) {
        n(b, u - 0.4, 0.12, w, u - 0.2, 0.3, S, {
          bevel: 0.02,
        });
        for (let H = w + 0.3; H < S; H += 1.6)
          n(x, u - 0.42, 0.028, H - 0.12, u - 0.18, 0.12, H + 0.12);
      }
      w = Math.max(w, z);
    }
  }
  for (let E of QUAY.RAILS) {
    n(x, E - 0.19, 0, f + 0.4, E + 0.19, 0.007, p - 0.4, {
      cast: false,
    });
    n(e("steel_rust"), E - 0.075, 0, f + 0.4, E + 0.075, 0.018, p - 0.4, {
      cast: false,
    });
    n(g, E - 0.037, 0, f + 0.4, E + 0.037, 0.034, p - 0.4, {
      bevel: 0.008,
      cast: false,
    });
    for (let w = f + 0.8; w < p - 0.5; w += 0.9)
      for (let S of [-1, 1])
        t(x, 0.07, 0.022, 0.1, E + S * 0.115, 0.012, w, {
          cast: false,
        });
    for (let [w, S] of [
      [f + 0.75, 1],
      [p - 0.75, -1],
    ]) {
      n(b, E - 0.28, 0, w - 0.3, E + 0.28, 0.75, w + 0.3, {
        bevel: 0.03,
      });
      n(e("rubber"), E - 0.16, 0.3, w + S * 0.3, E + 0.16, 0.62, w + S * 0.42, {
        bevel: 0.03,
      });
      n(x, E - 0.34, 0, w - 0.38, E + 0.34, 0.04, w + 0.38);
      a(E - 0.28, 0, w - 0.36, E + 0.28, 0.75, w + 0.36, "metal");
    }
  }
  buildRackedDrums(i, 23.3, -15.4, 2, true, 0.02);
  buildRackedDrums(i, 23.7, 14.4, 2, true, -0.025);
  c("jersey_barrier", 20.5, -4.7, Math.PI / 2 + 0.12, {
    seed: 31,
  });
  c("jersey_barrier", 25.3, 3.1, -0.2, {
    seed: 32,
  });
  buildWorkbench(i, 25.7, -3.3, 0.08, "paint_blue", 2);
  c("sandbags", 20.6, 3, 1.25, {
    seed: 33,
  });
  c("barrel", 26.5, -1.7, 0, {
    seed: 34,
    color: "red",
  });
  c("barrel", 26.9, -1.05, 0.5, {
    seed: 35,
  });
  buildHandCart(i, 20.55, 1.35, 0.12);
  c("traffic_cone", 22, -1.9, 0, {
    seed: 36,
  });
  c("traffic_cone", 24.2, 1.7, 0, {
    seed: 37,
  });
  i.stack(23.2, -28.6, [
    [
      20,
      "white",
      {
        reefer: true,
      },
    ],
    [
      20,
      "white",
      {
        reefer: true,
      },
    ],
  ]);
  i.stack(23, -25.95, [
    [
      20,
      "grey",
      {
        reefer: true,
      },
    ],
  ]);
  c("generator", 15, -26.6, 0.06, {
    seed: 41,
  });
  c("floodlight_stand", 16.4, -23.6, 0.3, {
    seed: 42,
  });
  buildCableRun(
    i,
    [
      [16.1, -26.6],
      [18, -27.6],
      [19.2, -27.2],
      [19.6, -26.4],
    ],
    0.028,
  );
  buildCableRun(
    i,
    [
      [15.6, -26],
      [16.2, -24.6],
      [16.4, -23.9],
    ],
    0.018,
  );
  buildWorkbench(i, 27, -18.1, Math.PI / 2 + 0.05, "paint_orange", 5);
  c("tire_stack", 24.1, -9.5, 0, {
    seed: 43,
  });
  c("tire_stack", 25.05, -9.6, 0.5, {
    seed: 44,
  });
  c("cable_reel", 14.3, -12.9, 0.4, {
    seed: 45,
  });
  c("cable_reel", 15.6, -14.3, 1.9, {
    seed: 46,
  });
  c("pallet_stack", 20.3, -9.3, 0.1, {
    seed: 47,
  });
  c("crate_wood", 19.9, -22.6, 0.3, {
    seed: 48,
  });
  c("barrel", 12.75, -23.3, 0, {
    seed: 49,
    color: "blue",
  });
  c("barrel", 12.9, -24.1, 0, {
    seed: 50,
    color: "blue",
  });
  c("light_mast", 26.6, -28.7, 0, {
    seed: 51,
  });
  c("light_mast", 26.6, 26.7, 0, {
    seed: 52,
  });
  buildWorkbench(i, 20.6, 22.4, 0.04, "paint_blue", 7);
  buildWorkbench(i, 20.7, 24.2, -0.06, "paint_orange", 9);
  buildHandCart(i, 26.6, 5.5, 0.1);
  buildHandCart(i, 26.7, 6.45, -0.15, "paint_blue");
  c("crate_stack", 26.4, 23.6, 0.2, {
    seed: 53,
  });
  c("ibc_tote", 22.6, 26.3, 0.05, {
    seed: 54,
  });
  c("pallet_stack", 24, 26.2, 0.2, {
    seed: 55,
  });
  c("barrel", 22.6, 20.3, 0, {
    seed: 56,
    color: "yellow",
  });
  c("barrel", 23.4, 20.4, 0, {
    seed: 57,
  });
  c("tarp_cargo", 20.3, 12.6, Math.PI / 2, {
    seed: 59,
  });
  buildPipeBundle(i, 19.6, 17.5, Math.PI / 2 + 0.05);
  buildWheelChock(i, 19.6, 10.4, 0.4);
  buildWheelChock(i, 20.5, 16.1, -2.6);
  c("traffic_cone", 28.2, 18.2, 0, {
    seed: 60,
  });
  c("traffic_cone", 28.3, 21.8, 0, {
    seed: 61,
  });
  buildCableRun(
    i,
    [
      [28.9, 6.2],
      [28.6, 9.5],
      [28.95, 13],
      [28.7, 16.6],
      [28.3, 17.4],
      [28.6, 17.9],
      [28.9, 17.3],
    ],
    0.022,
  );
  return {
    relayPos: new Vector3(23, 0, 0),
    extraction: new Vector3(29, 0, h),
  };
}
