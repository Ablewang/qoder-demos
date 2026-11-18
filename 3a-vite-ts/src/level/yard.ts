import { Vector3 } from "three";
import {
  WAREHOUSE,
  buildCableRun,
  buildHandCart,
  buildHydrantBox,
  buildPipeBundle,
  buildPoleSign,
  buildWheelChock,
  buildWorkbench,
} from "./warehouse";

export const QUARTER_TURN = Math.PI / 2;
const FORKLIFT_FORK_Y = 0.535;
export const makeVec3 = (i: number, e: number, t: number) =>
  new Vector3(i, e, t);
export function layoutContainerYard(i: any) {
  let e = i.place,
    t = i.stack;
  t(-19.45, -5.12, [
    [20, "green"],
    [20, "grey"],
    [20, "orange"],
  ]);
  t(-13.3, -5.12, [
    [
      20,
      "white",
      {
        reefer: true,
        flip: true,
      },
    ],
  ]);
  t(3.7, -5.12, [
    [
      20,
      "blue",
      {
        doors: 0.8,
        flip: true,
      },
    ],
    [20, "white"],
  ]);
  t(13.53, -5.12, [
    [20, "teal"],
    [20, "grey"],
  ]);
  t(-19.45, 2.08, [[20, "blue"]]);
  t(-13.35, 2.08, [[20, "red"]]);
  t(0.8, 2.08, [
    [40, "orange"],
    [40, "teal"],
    [
      20,
      "blue",
      {
        dx: 3,
      },
    ],
  ]);
  t(12.3, 2.08, [
    [20, "red"],
    [20, "yellow"],
  ]);
  t(-21.1, 9.92, [[20, "yellow"]], 0, 0.3);
  t(
    -13.6,
    9.92,
    [
      [20, "green"],
      [20, "blue"],
      [20, "orange"],
    ],
    0,
    0.3,
  );
  t(
    -21.6,
    12.42,
    [
      [20, "red"],
      [20, "white"],
      [20, "teal"],
    ],
    0,
    0.3,
  );
  t(
    -15.4,
    12.42,
    [
      [
        20,
        "grey",
        {
          doors: 0.6,
        },
      ],
    ],
    0,
    0.3,
  );
  t(4.43, 12.42, [[20, "blue"]], 0, 0);
  t(13.53, 12.42, [[20, "green"]], 0, 0);
  i.stairs(-0.1, 12.42, 0, 0, {
    seed: 9,
  });
  i.catwalk(8.98, 12.42, 0, 2.54, {
    seed: 10,
  });
  for (let s of [7.6, 10.36])
    for (let o of [11.86, 12.98])
      i.rod("steel_galv", [s, 0, o], [s, 2.5, o], 0.035);
  e(
    "sandbags",
    15.95,
    12.42,
    QUARTER_TURN,
    {
      seed: 61,
    },
    2.59,
  );
  e(
    "crate_wood",
    14.3,
    11.75,
    0.1,
    {
      seed: 62,
    },
    2.59,
  );
  e(
    "sandbags",
    2.3,
    11.75,
    0,
    {
      seed: 63,
    },
    2.59,
  );
  t(-16.4, 20.12, [
    [40, "grey"],
    [40, "green"],
  ]);
  t(-2.25, 20.12, [[20, "red"]]);
  t(3.85, 20.12, [
    [20, "white"],
    [20, "blue"],
  ]);
  t(13.53, 20.12, [
    [20, "orange"],
    [20, "teal"],
    [20, "red"],
  ]);
  t(-16.4, 22.62, [
    ["hc", "teal"],
    [40, "yellow"],
    [40, "blue"],
  ]);
  t(0.8, 22.62, [
    [40, "green"],
    ["hc", "orange"],
  ]);
  t(13.53, 22.62, [
    [
      20,
      "grey",
      {
        doors: 0.4,
      },
    ],
  ]);
  t(
    -22.6,
    -19.2,
    [
      [40, "red"],
      [40, "white"],
    ],
    QUARTER_TURN,
  );
  t(
    -30.2,
    -18.4,
    [
      [
        20,
        "yellow",
        {
          doors: 0.5,
        },
      ],
    ],
    0.35,
    0,
  );
  t(-31.2, 24.7, [
    [40, "teal"],
    [40, "orange"],
  ]);
  for (let [s, o] of [
    [-23.4, 0.5],
    [-23.4, 21.4],
    [17, -8.7],
    [17, 18.6],
    [-20.6, -11.6],
  ])
    e("light_mast", s, o, 0, {
      seed: Math.round(s * 3 + o),
    });
  let n = (s: number[], o: number[], r: number, a = 0.018) => {
    let l: number[][] = [];
    for (let c = 0; c <= 8; c++) {
      let u = c / 8;
      l.push([
        s[0] + (o[0] - s[0]) * u,
        s[1] + (o[1] - s[1]) * u - r * 4 * u * (1 - u),
        s[2] + (o[2] - s[2]) * u,
      ]);
    }
    i.tube("rubber", l, a, {
      radial: 5,
      tension: 0.5,
    });
  };
  n([-23.4, 12.4, 0.5], [-20.6, 12.4, -11.6], 1.3);
  n([-20.6, 11.8, -11.6], [-16.2, 7.25, -11.4], 0.9);
  n([-23.4, 12, 0.5], [-27.6, 12.2, -0.9], 0.5);
  n([17, 12.4, -8.7], [12.3, 7.3, -11.3], 1);
  buildPipeBundle(i, -20.9, 8.3, 0.02);
  buildWheelChock(i, -18.6, 3.75, 1.7);
  buildWheelChock(i, 0.4, 13.3, 0.3);
  e("barrel", -19.6, 3.85, 0, {
    seed: 1,
    color: "blue",
  });
  e("barrel", -18.9, 3.95, 0.7, {
    seed: 2,
    color: "blue",
  });
  e("pallet_stack", -17.4, 4, 0.08, {
    seed: 3,
  });
  e("crate_stack", -14.3, 8.05, 0.04, {
    seed: 4,
  });
  e("ibc_tote", -12.95, 7.95, -0.05, {
    seed: 5,
  });
  {
    let a = Math.cos(-0.22),
      l = -Math.sin(-0.22);
    e("forklift", -8.6, 4.5, -0.22, {
      seed: 6,
      forksUp: 0.3,
    });
    let c = -8.6 + a * 1.42,
      u = 4.5 + l * 1.42;
    e(
      "pallet",
      c,
      u,
      -0.22,
      {
        seed: 7,
      },
      FORKLIFT_FORK_Y,
      {
        noCol: true,
      },
    );
    e(
      "crate_wood",
      c,
      u,
      -0.22 + 0.05,
      {
        seed: 8,
      },
      FORKLIFT_FORK_Y + 0.144,
      {
        noCol: true,
      },
    );
    i.col(
      c - 0.62,
      FORKLIFT_FORK_Y - 0.1,
      u - 0.62,
      c + 0.62,
      FORKLIFT_FORK_Y + 1.15,
      u + 0.62,
      "wood",
    );
    buildWheelChock(i, -8.6 - 1, 4.5 + 0.78, 0.2);
    buildWheelChock(i, -11.9, 3.6, 2.4);
  }
  e("jersey_barrier", -2.9, 5.3, 0.12, {
    seed: 11,
  });
  e("jersey_barrier", 5.6, 5, -0.1, {
    seed: 12,
  });
  e("sandbags", -1.7, 9.7, 0.5, {
    seed: 13,
  });
  e("ibc_tote", 5.9, 8.9, 0.1, {
    seed: 14,
  });
  e("ibc_tote", 5.95, 10.05, -0.05, {
    seed: 15,
  });
  e("barrel", 4.9, 9.7, 0, {
    seed: 16,
    color: "red",
  });
  e("crate_stack", -3.9, 10.5, 0.1, {
    seed: 17,
  });
  e("crate_wood", -3.8, 9.35, -0.2, {
    seed: 18,
  });
  e("pallet_stack", -4.4, 11.8, 0.02, {
    seed: 19,
  });
  e("cable_reel", 4.2, 10.5, 0.3, {
    seed: 20,
  });
  e("tarp_cargo", 12.9, 10, 0.04, {
    seed: 21,
  });
  e("jersey_barrier", 11.6, 3.95, 0.03, {
    seed: 81,
  });
  e("ibc_tote", 15.2, 10.2, 0.1, {
    seed: 82,
  });
  for (let [s, o] of [
    [0.2, 6.3],
    [2.9, 6.4],
    [2.9, 8.8],
    [0.1, 8.7],
  ])
    e("traffic_cone", s, o, 0, {
      seed: Math.round(s * 9 + o * 5),
    });
  buildHandCart(i, -9.55, 9.3, 0.04);
  buildPipeBundle(i, -7.6, 11.9, QUARTER_TURN + 0.06);
  buildHandCart(i, 9.9, 12.9, QUARTER_TURN, "paint_blue");
  e("sign_post", -4.8, 3.72, QUARTER_TURN, {
    seed: 22,
    sign: "hazard_voltage",
  });
  buildHydrantBox(i, 0.9, 3.62, 0);
  buildCableRun(
    i,
    [
      [0.9, 3.9],
      [1.2, 5.2],
      [0.8, 6.2],
      [1.5, 7.1],
    ],
    0.03,
  );
  e("tarp_cargo", -13.5, -3.1, 0.05, {
    seed: 23,
  });
  e("pallet_stack", -20.6, -0.1, 0.2, {
    seed: 24,
  });
  e("tire_stack", -9.6, 0.2, 0, {
    seed: 25,
  });
  e("barrel", 4.5, 0.35, 0, {
    seed: 26,
    color: "yellow",
  });
  e("barrel", 5.2, 0.3, 0.4, {
    seed: 27,
  });
  e("jersey_barrier", 12.2, 0.4, 0.03, {
    seed: 28,
  });
  e("crate_wood", 11.2, -3.3, 0.3, {
    seed: 29,
  });
  e("cardboard_boxes", -2, 0.3, 0.2, {
    seed: 30,
  });
  buildWorkbench(i, -4.2, -3.2, 0.03, "paint_orange", 3);
  e("jersey_barrier", -0.9, -7.5, 0.1, {
    seed: 31,
  });
  e("sandbags", -6.7, -7.8, -0.1, {
    seed: 32,
  });
  e("dumpster", -12.3, -7.05, 0, {
    seed: 33,
  });
  e("gas_cylinders", 9.6, -10.45, 0, {
    seed: 34,
  });
  e("pallet_stack", 1.2, -9.9, 0.1, {
    seed: 35,
  });
  e("barrel", 2.2, -10.3, 0, {
    seed: 36,
    color: "green",
  });
  e("cable_reel", -18.2, -8, 0.2, {
    seed: 37,
  });
  e("traffic_cone", -6.5, -9.9, 0, {
    seed: 38,
  });
  e("traffic_cone", -0.5, -9.9, 0, {
    seed: 39,
  });
  buildCableRun(
    i,
    [
      [4.6, -10.9, 0.5],
      [4.7, -10.6, 0.05],
      [4.2, -9.2],
      [1, -8.4],
      [-2.6, -9.1],
      [-4.6, -6.4],
      [-5.9, -5.9],
    ],
    0.024,
  );
  e("pipe_stack", -16, 14.4, 0, {
    seed: 41,
  });
  e("crate_stack", -10.95, 18.25, 0.06, {
    seed: 42,
  });
  e("barrel", -3, 18.35, 0, {
    seed: 43,
    color: "blue",
  });
  e("dumpster", 4.2, 14.55, 0.02, {
    seed: 44,
  });
  e("tire_stack", 10.95, 18.3, 0, {
    seed: 45,
  });
  e("ibc_tote", 12, 18.25, 0, {
    seed: 46,
  });
  e("pallet_stack", -12.3, 18.2, 0.1, {
    seed: 47,
  });
  e("tarp_cargo", -20.5, 18.05, 0.03, {
    seed: 48,
  });
  e("jersey_barrier", 0.6, 15.5, 0.12, {
    seed: 49,
  });
  e("tire_stack", -8, 26.9, 0, {
    seed: 51,
  });
  e("pallet_stack", 8.7, 27, 0.3, {
    seed: 52,
  });
  e("crate_wood", -2, 27, 0.2, {
    seed: 53,
  });
  e("barrel", 11.2, 27.1, 0, {
    seed: 54,
  });
  e("cardboard_boxes", -21, 26.9, 0.4, {
    seed: 55,
  });
  buildHandCart(i, 16, 26.9, 0.1);
  e("pipe_stack", -30.5, -27, 0.03, {
    seed: 56,
  });
  e("pipe_stack", -30.2, -25.4, -0.02, {
    seed: 57,
  });
  e("dumpster", -17, -14, QUARTER_TURN, {
    seed: 58,
  });
  e("tarp_cargo", -27.5, -11.6, 0.3, {
    seed: 59,
  });
  e("tarp_cargo", -29.9, -11, -0.2, {
    seed: 60,
  });
  e("cable_reel", -34.6, -22.5, 1, {
    seed: 64,
  });
  e("tire_stack", -25.4, -26.9, 0, {
    seed: 65,
  });
  e("gas_cylinders", -16.9, -20.4, QUARTER_TURN, {
    seed: 66,
  });
  e("crate_stack", -34.8, -13.5, 0.2, {
    seed: 67,
  });
  e("barrel", -33.6, -13, 0, {
    seed: 68,
  });
  buildWorkbench(i, -36.6, -26, QUARTER_TURN, "paint_blue", 4);
  e("generator", -34.2, 14.2, 0.15, {
    seed: 71,
  });
  e("floodlight_stand", -31.4, 12.7, 0.55, {
    seed: 72,
  });
  buildCableRun(
    i,
    [
      [-33.2, 14],
      [-32.4, 13.2],
      [-31.6, 12.9],
    ],
    0.02,
  );
  e("tire_stack", -36.6, 17.2, 0, {
    seed: 73,
  });
  e("tire_stack", -36.5, 18.3, 0.6, {
    seed: 74,
  });
  e("dumpster", -36.4, 21, QUARTER_TURN, {
    seed: 75,
  });
  e("pallet_stack", -27.8, 16.6, 0.4, {
    seed: 76,
  });
  e("jerry_can", -33, 15.2, 0.4, {
    seed: 77,
  });
  e("jerry_can", -33.3, 15.35, 1.9, {
    seed: 78,
  });
  e("crate_wood", -28.6, 20.6, 0.1, {
    seed: 79,
  });
  e("ibc_tote", -26.6, 21.2, 0, {
    seed: 80,
  });
  buildPoleSign(i, -22.9, -3.62, "一号通道", "x-");
  buildPoleSign(i, -22.95, 3.62, "二号通道", "x-");
  buildPoleSign(i, -25, 14, "三号通道", "x-");
  buildPoleSign(i, 16.9, 9.5, "二号通道", "x+");
  i.label("四号泊位维修车间", 0.55, 4.2, 4.3, WAREHOUSE.Z1 + 0.064, "z+", {
    color: "white",
    font: "stencil",
    distress: 0.45,
  });
  i.decal("berth4", 3.2, -12, 3.4, WAREHOUSE.Z1 + 0.064, "z+");
  i.decal("rust_run", 1, 9, 3.2, WAREHOUSE.Z1 + 0.064, "z+");
  i.decal("grime_streak", 1.2, -14, 3.9, WAREHOUSE.Z1 + 0.064, "z+");
}
export function layoutPerimeter(i: any) {
  let e = i.place,
    t = -38,
    n = 30,
    s = -30,
    o = 28,
    r = 2,
    a = 8;
  function l(c: number, u: number, h: number, f: number, p: number) {
    let d = Math.hypot(h - c, f - u),
      v = Math.max(1, Math.round(d / 3.35)),
      g = d / (v * 3),
      x = Math.abs(h - c) > Math.abs(f - u);
    for (let y = 0; y < v; y++) {
      let b = (y + 0.5) / v,
        m = e(
          "fence_panel",
          c + (h - c) * b,
          u + (f - u) * b,
          x ? 0 : QUARTER_TURN,
          {
            seed: p + y,
            posts: y === v - 1 ? "both" : "left",
          },
          0,
          {
            noCol: true,
          },
        );
      m.scale.x = g;
    }
    i.col(
      Math.min(c, h) - 0.05,
      0,
      Math.min(u, f) - 0.05,
      Math.max(c, h) + 0.05,
      2.4,
      Math.max(u, f) + 0.05,
      "metal",
    );
    i.col(
      Math.min(c, h) - 0.3,
      0,
      Math.min(u, f) - 0.3,
      Math.max(c, h) + 0.3,
      7,
      Math.max(u, f) + 0.3,
      "metal",
      {
        playerOnly: true,
      },
    );
  }
  l(t, s, n, s, 100);
  l(t, o, n, o, 200);
  l(t, s, t, r, 300);
  l(t, a, t, o, 400);
  for (let c of [r - 0.1, a + 0.1]) {
    i.box("steel_dark", 0.22, 3.4, 0.22, t, 1.7, c, {
      bevel: 0.02,
    });
    i.box("hazard_stripes", 0.26, 1.2, 0.26, t, 0.6, c, {
      bevel: 0.02,
    });
    i.col(t - 0.13, 0, c - 0.13, t + 0.13, 3.4, c + 0.13, "metal");
  }
  {
    let c = a + 3.3,
      u = t + 0.28;
    i.box("chainlink", 0.012, 2.1, 6, u, 1.25, c);
    for (let h of [c - 3, c, c + 3])
      i.box("steel_galv", 0.06, 2.2, 0.06, u, 1.25, h);
    for (let h of [0.18, 2.32, 1.25])
      i.box("steel_galv", 0.06, 0.06, 6.06, u, h, c);
    i.rod("steel_galv", [u, 0.2, c - 3], [u, 2.3, c], 0.018);
    i.rod("steel_galv", [u, 0.2, c + 3], [u, 2.3, c], 0.018);
    i.slab("steel_dark", u - 0.05, 0, r - 0.3, u + 0.05, 0.03, c + 3.2, {
      cast: false,
    });
    for (let h of [c - 2.4, c + 2.4])
      i.cyl("rubber", 0.09, 0.05, u, 0.1, h, {
        axis: "x",
        seg: 10,
      });
  }
  i.col(t - 0.4, 0, r, t - 0.1, 7, a, "metal", {
    playerOnly: true,
  });
  e("guard_booth", -35.2, 0.35, 0, {
    seed: 1,
  });
  e("gate_arm", -36.3, 5, QUARTER_TURN, {
    seed: 2,
  });
  for (let [c, u] of [
    [-37, 1.75],
    [-34.4, 2.3],
    [-37, 8.3],
    [-35.6, 8.9],
    [-34.4, 9.9],
    [-33.5, -1.1],
  ])
    e("bollard_post", c, u, 0, {
      seed: Math.round(c * 11 + u * 7),
    });
  e("jersey_barrier", -34.7, 3.75, QUARTER_TURN + 0.08, {
    seed: 3,
  });
  e("jersey_barrier", -33.3, 8.3, QUARTER_TURN - 0.06, {
    seed: 4,
  });
  e("jersey_barrier", -30.6, 10.4, 0.03, {
    seed: 5,
  });
  e("jersey_barrier", -27.3, 1.45, 0.05, {
    seed: 6,
  });
  e("jersey_barrier", -32.2, 1.45, -0.04, {
    seed: 7,
  });
  e("sign_post", -33.2, 9.6, QUARTER_TURN, {
    seed: 8,
    sign: "no_entry",
  });
  e("sign_post", -25.3, 1.1, QUARTER_TURN, {
    seed: 9,
    sign: "berth4",
  });
  e("sign_post", -36.6, -1.6, QUARTER_TURN, {
    seed: 10,
    sign: "hazard_general",
  });
  for (let [c, u] of [
    [-34.6, 5.6],
    [-28.3, 2],
    [-33.2, 6.5],
    [-26.6, 9.8],
    [-31.8, 9.9],
  ])
    e("traffic_cone", c, u, 0, {
      seed: Math.round(c * 5 + u * 3),
    });
  e("light_mast", -27.6, -0.9, 0, {
    seed: 11,
  });
  e("light_mast", -36.3, 12.4, 0, {
    seed: 12,
  });
  e("barrel", -33.9, 2, 0, {
    seed: 13,
    color: "yellow",
  });
  e("pallet_stack", -36.4, 10.3, 0.2, {
    seed: 14,
  });
  i.decal("no_entry", 0.7, t + 0.34, 1.5, a + 3.3, "x+");
  i.decal("arrow", 2.2, -30.5, 0.006, 6, "y+", 0);
}
