import type { BoxGeometry, CylinderGeometry, TubeGeometry } from "three";
import {
  ConeGeometry,
  LatheGeometry,
  Matrix4,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from "three";
import {
  cylinderGeo,
  roundedBoxGeo,
  transformGeo,
  tubeGeo,
} from "../utils/geometry";
import { Rig } from "./rig";

const ENEMY_TINT_WHITE = [1.15, 1.15, 1.15];
const ENEMY_TINT_PALE = [0.95, 0.96, 0.97];
const ENEMY_TINT_ORANGE = [1, 0.34, 0.08];
const ENEMY_TINT_CHARCOAL = [0.1, 0.11, 0.12];
const ENEMY_TINT_BLACK = [0.035, 0.035, 0.038];
const ENEMY_TINT_YELLOW = [1, 0.7, 0.07];
const ENEMY_TINT_NEUTRAL = [1, 1, 1];
const ENEMY_TINT_BRIGHT_METAL = [2.4, 2.5, 2.6];
const ENEMY_TINT_DARK_METAL = [0.45, 0.46, 0.48];
const ENEMY_TINT_CHROME = [9, 9, 9.6];
const ENEMY_TINT_BRASS = [5.5, 4, 1.6];
const ENEMY_HALF_PI = Math.PI / 2;
const enemyRoundBox = (i: number, e: number, t: number, n = 0.008) =>
  roundedBoxGeo(i, e, t, n);
const placePart = (
  i:
    | BoxGeometry
    | CylinderGeometry
    | TorusGeometry
    | SphereGeometry
    | LatheGeometry
    | RingGeometry,
  e: number,
  t: number,
  n: number,
  s = 0,
  o = 0,
  r = 0,
  a: any = 1,
) =>
  transformGeo(i, {
    p: [e, t, n],
    r: [s, o, r],
    s: a,
  });
const enemyCylY = (i: number, e: number, t: number, n = 12) =>
  cylinderGeo(i, e, t, n);
const enemyCylX = (i: number, e: number, t: number, n = 12) =>
  transformGeo(cylinderGeo(i, e, t, n), {
    r: [0, 0, -ENEMY_HALF_PI],
  });
const enemyCylZ = (i: number, e: number, t: number, n = 12) =>
  transformGeo(cylinderGeo(i, e, t, n), {
    r: [ENEMY_HALF_PI, 0, 0],
  });
const _strutStart = new Vector3();
const _strutEnd = new Vector3();
const _strutQuat = new Quaternion();
const STRUT_UP_AXIS = new Vector3(0, 1, 0);
const _strutMatrix = new Matrix4();
const STRUT_UNIT_SCALE = new Vector3(1, 1, 1);
function cylinderBetween(i: number[], e: number[], t: number, n = t, s = 8) {
  _strutStart.set(i[0], i[1], i[2]);
  _strutEnd.set(e[0], e[1], e[2]);
  let o = _strutStart.distanceTo(_strutEnd),
    r = cylinderGeo(n, t, o, s);
  _strutQuat.setFromUnitVectors(
    STRUT_UP_AXIS,
    _strutEnd.clone().sub(_strutStart).normalize(),
  );
  _strutMatrix.compose(
    _strutStart.clone().add(_strutEnd).multiplyScalar(0.5),
    _strutQuat,
    STRUT_UNIT_SCALE,
  );
  r.applyMatrix4(_strutMatrix);
  return r;
}
const ellipsoidGeo = (i: number, e = 14, t = 10, n = 1, s = 1, o = 1) => {
  let r = new SphereGeometry(i, e, t);
  r.scale(n, s, o);
  return r;
};
const boltHeadX = (i: number, e: number, t: number) =>
  placePart(enemyCylX(0.0075, 0.0075, 0.006, 6), i, e, t);
const boltHeadY = (i: number, e: number, t: number) =>
  placePart(enemyCylY(0.0075, 0.0075, 0.006, 6), i, e, t);
const boltHeadZ = (i: number, e: number, t: number) =>
  placePart(enemyCylZ(0.0075, 0.0075, 0.006, 6), i, e, t);
export const HOUND_LEGS = {
  stand: 0.72,
  L1: 0.4,
  L2: 0.42,
  l0: 0.075,
  hipX: 0.165,
  hipY: -0.01,
  hipZ: 0.4,
  footX: 0.275,
  footZ: [0.37, 0.37, -0.42, -0.42],
  legs: ["FL", "FR", "RL", "RR"],
  side: [1, -1, 1, -1],
  fore: [1, 1, -1, -1],
  muzzle: [0, 0, 0.43],
  eye: [0, 0, 0.14],
  footR: 0.046,
};
export function buildHoundRig() {
  let i = HOUND_LEGS,
    e = new Rig();
  e.bone("root", null, 0, 0, 0);
  e.bone("body", "root", 0, i.stand, 0);
  e.bone("neck", "body", 0, 0.06, 0.49);
  e.bone("head", "neck", 0, 0.13, 0.12);
  e.bone("turret", "body", 0, 0.152, -0.03);
  e.bone("gun", "turret", 0, 0.095, 0.02);
  e.bone("antenna", "body", -0.105, 0.15, -0.46);
  e.bone("beacon", "body", 0.105, 0.2, -0.455);
  for (let n = 0; n < 4; n++) {
    let s = i.legs[n],
      o = i.side[n];
    e.bone("abd" + s, "body", o * i.hipX, i.hipY, i.fore[n] * i.hipZ);
    e.bone("thigh" + s, "abd" + s, o * i.l0, 0, 0);
    e.bone("shin" + s, "thigh" + s, 0, -i.L1, 0);
  }
  let t = (
    n: string,
    s: string,
    o: CylinderGeometry | TubeGeometry,
    r: number[],
    a?: boolean,
  ) => e.add(n, s, o, r, a);
  t(
    "metal",
    "body",
    placePart(enemyRoundBox(0.27, 0.2, 0.98, 0.02), 0, -0.01, 0),
    ENEMY_TINT_DARK_METAL,
  );
  t(
    "shell",
    "body",
    placePart(enemyRoundBox(0.35, 0.05, 0.3, 0.014), 0, 0.125, 0.33),
    ENEMY_TINT_WHITE,
  );
  t(
    "shell",
    "body",
    placePart(enemyRoundBox(0.35, 0.05, 0.36, 0.014), 0, 0.125, -0.012),
    ENEMY_TINT_WHITE,
  );
  t(
    "shell",
    "body",
    placePart(enemyRoundBox(0.1, 0.052, 0.36, 0.01), 0, 0.126, -0.012 + 0),
    ENEMY_TINT_PALE,
  );
  for (let n of [-0.15, 0.15])
    for (let s of [0.21, 0.45, -0.17, 0.145])
      t("metal", "body", boltHeadY(n, 0.152, s), ENEMY_TINT_BRIGHT_METAL);
  t(
    "metal",
    "body",
    placePart(enemyRoundBox(0.31, 0.03, 0.25, 0.006), 0, 0.112, -0.335),
    ENEMY_TINT_NEUTRAL,
  );
  for (let n = 0; n < 10; n++)
    t(
      "metal",
      "body",
      placePart(
        enemyRoundBox(0.007, 0.062, 0.225, 0.002),
        -0.126 + n * 0.028,
        0.155,
        -0.335,
      ),
      ENEMY_TINT_BRIGHT_METAL,
    );
  t(
    "metal",
    "body",
    placePart(enemyRoundBox(0.3, 0.012, 0.02, 0.003), 0, 0.186, -0.24),
    ENEMY_TINT_DARK_METAL,
  );
  t(
    "metal",
    "body",
    placePart(enemyRoundBox(0.3, 0.012, 0.02, 0.003), 0, 0.186, -0.43),
    ENEMY_TINT_DARK_METAL,
  );
  for (let n of [1, -1]) {
    t(
      "shell",
      "body",
      placePart(
        enemyRoundBox(0.032, 0.15, 0.31, 0.012),
        n * 0.15,
        0.022,
        -0.075,
      ),
      ENEMY_TINT_WHITE,
    );
    t(
      "shell",
      "body",
      placePart(
        enemyRoundBox(0.032, 0.15, 0.135, 0.012),
        n * 0.15,
        0.022,
        0.1625,
      ),
      ENEMY_TINT_PALE,
    );
    t(
      "metal",
      "body",
      tubeGeo(
        [
          [n * 0.168, 0.06, 0.125],
          [n * 0.182, 0.06, 0.135],
          [n * 0.182, 0.06, 0.19],
          [n * 0.168, 0.06, 0.2],
        ],
        0.005,
        5,
      ),
      ENEMY_TINT_BRIGHT_METAL,
    );
    t(
      "shell",
      "body",
      placePart(
        enemyRoundBox(0.034, 0.016, 0.135, 0.004),
        n * 0.151,
        -0.035,
        0.1625,
      ),
      ENEMY_TINT_YELLOW,
    );
    t(
      "shell",
      "body",
      placePart(enemyRoundBox(0.034, 0.042, 0.46, 0.008), n * 0.151, -0.078, 0),
      ENEMY_TINT_ORANGE,
    );
    t(
      "shell",
      "body",
      placePart(enemyRoundBox(0.028, 0.1, 0.11, 0.008), n * 0.146, 0.01, 0.305),
      ENEMY_TINT_CHARCOAL,
    );
    for (let s = 0; s < 4; s++)
      t(
        "metal",
        "body",
        placePart(
          enemyRoundBox(0.004, 0.012, 0.085, 0.001),
          n * 0.161,
          -0.02 + s * 0.022,
          0.305,
        ),
        ENEMY_TINT_DARK_METAL,
      );
    for (let s of [-0.035, 0.08])
      for (let o of [-0.21, 0.06, 0.115, 0.21])
        t("metal", "body", boltHeadX(n * 0.167, s, o), ENEMY_TINT_BRIGHT_METAL);
    t(
      "metal",
      "body",
      tubeGeo(
        [
          [n * 0.135, 0.148, -0.19],
          [n * 0.135, 0.205, -0.16],
          [n * 0.135, 0.212, 0],
          [n * 0.135, 0.205, 0.43],
          [n * 0.135, 0.148, 0.465],
        ],
        0.0105,
        6,
      ),
      ENEMY_TINT_BRIGHT_METAL,
    );
    for (let s of [0, 0.26])
      t(
        "metal",
        "body",
        placePart(enemyCylY(0.008, 0.008, 0.06, 6), n * 0.135, 0.178, s),
        ENEMY_TINT_BRIGHT_METAL,
      );
    t(
      "shell",
      "body",
      tubeGeo(
        [
          [n * 0.118, -0.105, -0.36],
          [n * 0.132, -0.118, -0.2],
          [n * 0.13, -0.112, 0.1],
          [n * 0.118, -0.1, 0.36],
        ],
        0.009,
        5,
      ),
      ENEMY_TINT_BLACK,
    );
    t(
      "metal",
      "body",
      placePart(
        new TorusGeometry(0.02, 0.005, 5, 10),
        n * 0.17,
        0.085,
        -0.335,
        0,
        ENEMY_HALF_PI,
        0,
      ),
      ENEMY_TINT_BRIGHT_METAL,
    );
  }
  t(
    "shell",
    "body",
    placePart(enemyRoundBox(0.3, 0.15, 0.075, 0.018), 0, -0.005, 0.505),
    ENEMY_TINT_ORANGE,
  );
  t(
    "shell",
    "body",
    placePart(enemyRoundBox(0.2, 0.07, 0.02, 0.006), 0, 0.012, 0.545),
    ENEMY_TINT_CHARCOAL,
  );
  for (let n = 0; n < 6; n++)
    t(
      "shell",
      "body",
      placePart(
        enemyRoundBox(0.05, 0.034, 0.014, 0.003),
        -0.125 + n * 0.05,
        -0.098,
        0.538,
        0,
        0,
        0,
      ),
      n % 2 ? ENEMY_TINT_CHARCOAL : ENEMY_TINT_YELLOW,
    );
  for (let n of [-0.115, 0.115]) {
    t(
      "metal",
      "body",
      placePart(enemyCylZ(0.021, 0.021, 0.014, 10), n, 0.012, 0.547),
      ENEMY_TINT_DARK_METAL,
    );
    t(
      "glow",
      "body",
      placePart(enemyCylZ(0.015, 0.015, 0.004, 10), n, 0.012, 0.556),
      [6.5, 4.6, 2.2],
      false,
    );
  }
  t(
    "metal",
    "body",
    placePart(enemyRoundBox(0.24, 0.095, 0.56, 0.02), 0, -0.145, 0),
    ENEMY_TINT_NEUTRAL,
  );
  t(
    "shell",
    "body",
    placePart(enemyRoundBox(0.246, 0.03, 0.09, 0.006), 0, -0.14, 0.12),
    ENEMY_TINT_ORANGE,
  );
  t(
    "shell",
    "body",
    placePart(enemyRoundBox(0.246, 0.03, 0.09, 0.006), 0, -0.14, -0.12),
    ENEMY_TINT_ORANGE,
  );
  t(
    "shell",
    "body",
    placePart(enemyRoundBox(0.29, 0.15, 0.05, 0.014), 0, 0, -0.495),
    ENEMY_TINT_WHITE,
  );
  t(
    "shell",
    "body",
    placePart(enemyRoundBox(0.17, 0.05, 0.012, 0.004), 0, 0.03, -0.523),
    ENEMY_TINT_CHARCOAL,
  );
  t(
    "glow",
    "body",
    placePart(enemyRoundBox(0.13, 0.012, 0.004, 0.001), 0, 0.03, -0.531),
    [5, 0.3, 0.1],
    false,
  );
  t(
    "metal",
    "body",
    placePart(enemyCylZ(0.022, 0.022, 0.02, 10), 0.085, -0.035, -0.525),
    ENEMY_TINT_BRIGHT_METAL,
  );
  t(
    "metal",
    "body",
    placePart(
      new TorusGeometry(0.024, 0.006, 5, 10),
      -0.07,
      -0.05,
      -0.528,
      ENEMY_HALF_PI,
      0,
      0,
    ),
    ENEMY_TINT_BRIGHT_METAL,
  );
  for (let n of [-0.125, 0.125])
    for (let s of [-0.055, 0.055])
      t("metal", "body", boltHeadZ(n, s, -0.523), ENEMY_TINT_BRIGHT_METAL);
  t(
    "shell",
    "body",
    tubeGeo(
      [
        [0.09, 0.15, -0.2],
        [0.13, 0.2, -0.16],
        [0.12, 0.2, -0.08],
        [0.09, 0.165, -0.05],
      ],
      0.009,
      5,
    ),
    ENEMY_TINT_BLACK,
  );
  t(
    "metal",
    "neck",
    cylinderBetween([0, -0.02, -0.02], [0, 0.11, 0.1], 0.045, 0.036, 10),
    ENEMY_TINT_DARK_METAL,
  );
  for (let n = 0; n < 3; n++) {
    let s = 0.2 + n * 0.28;
    t(
      "shell",
      "neck",
      cylinderBetween(
        [0, -0.02 + 0.13 * s - 0.008, -0.02 + 0.12 * s - 0.0075],
        [0, -0.02 + 0.13 * s + 0.008, -0.02 + 0.12 * s + 0.0075],
        0.052,
        0.052,
        10,
      ),
      ENEMY_TINT_BLACK,
    );
  }
  t(
    "shell",
    "neck",
    placePart(enemyRoundBox(0.13, 0.05, 0.1, 0.012), 0, -0.01, -0.03),
    ENEMY_TINT_WHITE,
  );
  t(
    "shell",
    "neck",
    tubeGeo(
      [
        [0.05, -0.02, -0.04],
        [0.07, 0.05, 0.02],
        [0.06, 0.11, 0.07],
        [0.045, 0.12, 0.1],
      ],
      0.007,
      5,
    ),
    ENEMY_TINT_BLACK,
  );
  t(
    "shell",
    "head",
    placePart(enemyRoundBox(0.19, 0.118, 0.25, 0.03), 0, 0, 0),
    ENEMY_TINT_WHITE,
  );
  t(
    "shell",
    "head",
    placePart(enemyRoundBox(0.168, 0.074, 0.03, 0.012), 0, -0.004, 0.118),
    ENEMY_TINT_CHARCOAL,
  );
  t(
    "lens",
    "head",
    placePart(enemyRoundBox(0.128, 0.024, 0.006, 0.002), 0, 0.006, 0.1345),
    [1, 1, 1],
    false,
  );
  for (let n of [-0.056, 0.056]) {
    t(
      "metal",
      "head",
      placePart(enemyCylZ(0.015, 0.015, 0.012, 10), n, -0.022, 0.132),
      ENEMY_TINT_DARK_METAL,
    );
    t(
      "metal",
      "head",
      placePart(enemyCylZ(0.009, 0.009, 0.004, 8), n, -0.022, 0.139),
      [0.1, 0.12, 0.2],
    );
  }
  t(
    "shell",
    "head",
    placePart(enemyRoundBox(0.062, 0.008, 0.2, 0.003), 0, 0.06, -0.005),
    ENEMY_TINT_ORANGE,
  );
  t(
    "metal",
    "head",
    placePart(enemyCylX(0.032, 0.032, 0.214, 12), 0, 0, -0.055),
    ENEMY_TINT_DARK_METAL,
  );
  for (let n of [1, -1])
    t(
      "shell",
      "head",
      placePart(enemyCylX(0.022, 0.022, 0.006, 10), n * 0.108, 0, -0.055),
      ENEMY_TINT_ORANGE,
    );
  t(
    "metal",
    "head",
    placePart(enemyCylY(0.036, 0.036, 0.026, 14), 0, 0.072, -0.05),
    ENEMY_TINT_DARK_METAL,
  );
  t(
    "metal",
    "head",
    placePart(enemyCylY(0.037, 0.037, 0.006, 14), 0, 0.074, -0.05),
    [0.2, 0.3, 0.5],
  );
  t(
    "metal",
    "head",
    placePart(enemyRoundBox(0.12, 0.03, 0.13, 0.008), 0, -0.068, 0.02),
    ENEMY_TINT_NEUTRAL,
  );
  for (let n of [-0.08, 0.08])
    for (let s of [-0.09, 0.07])
      t("metal", "head", boltHeadY(n, 0.061, s), ENEMY_TINT_BRIGHT_METAL);
  t(
    "metal",
    "turret",
    placePart(enemyCylY(0.105, 0.118, 0.034, 18), 0, 0, 0),
    ENEMY_TINT_DARK_METAL,
  );
  t(
    "metal",
    "turret",
    placePart(enemyRoundBox(0.18, 0.02, 0.16, 0.005), 0, 0.026, 0),
    ENEMY_TINT_NEUTRAL,
  );
  for (let n of [1, -1]) {
    t(
      "shell",
      "turret",
      placePart(
        enemyRoundBox(0.028, 0.115, 0.15, 0.012),
        n * 0.078,
        0.085,
        0.005,
      ),
      ENEMY_TINT_WHITE,
    );
    t(
      "metal",
      "turret",
      placePart(enemyCylX(0.022, 0.022, 0.008, 10), n * 0.094, 0.095, 0.02),
      ENEMY_TINT_BRIGHT_METAL,
    );
  }
  t(
    "shell",
    "gun",
    placePart(enemyRoundBox(0.108, 0.086, 0.21, 0.016), 0, 0, -0.012),
    ENEMY_TINT_WHITE,
  );
  t(
    "shell",
    "gun",
    placePart(enemyRoundBox(0.11, 0.02, 0.212, 0.006), 0, -0.022, -0.012),
    ENEMY_TINT_ORANGE,
  );
  t(
    "metal",
    "gun",
    placePart(enemyCylZ(0.035, 0.035, 0.11, 12), 0, 0, 0.145),
    ENEMY_TINT_DARK_METAL,
  );
  for (let n = 0; n < 4; n++)
    t(
      "metal",
      "gun",
      placePart(enemyCylZ(0.039, 0.039, 0.008, 12), 0, 0, 0.105 + n * 0.026),
      ENEMY_TINT_NEUTRAL,
    );
  t(
    "metal",
    "gun",
    placePart(enemyCylZ(0.022, 0.024, 0.3, 12), 0, 0, 0.25),
    ENEMY_TINT_NEUTRAL,
  );
  t(
    "metal",
    "gun",
    placePart(enemyCylZ(0.036, 0.036, 0.06, 10), 0, 0, 0.395),
    ENEMY_TINT_DARK_METAL,
  );
  t(
    "metal",
    "gun",
    placePart(enemyRoundBox(0.08, 0.012, 0.025, 0.003), 0, 0, 0.395),
    [0.15, 0.15, 0.15],
  );
  t(
    "metal",
    "gun",
    placePart(enemyCylX(0.056, 0.056, 0.06, 14), 0.084, -0.004, -0.045),
    ENEMY_TINT_DARK_METAL,
  );
  t(
    "metal",
    "gun",
    placePart(enemyCylX(0.02, 0.02, 0.066, 8), 0.084, -0.004, -0.045),
    ENEMY_TINT_BRASS,
  );
  t(
    "metal",
    "gun",
    placePart(enemyRoundBox(0.036, 0.036, 0.095, 0.008), -0.03, 0.06, 0),
    ENEMY_TINT_DARK_METAL,
  );
  t(
    "glow",
    "gun",
    placePart(enemyCylZ(0.011, 0.011, 0.003, 8), -0.03, 0.06, 0.049),
    [1.6, 0.12, 0.05],
    false,
  );
  t(
    "shell",
    "gun",
    tubeGeo(
      [
        [0.05, -0.03, -0.11],
        [0.06, -0.07, -0.13],
        [0.04, -0.09, -0.1],
      ],
      0.008,
      5,
    ),
    ENEMY_TINT_BLACK,
  );
  t(
    "metal",
    "body",
    placePart(enemyCylY(0.022, 0.026, 0.05, 10), 0.105, 0.175, -0.455),
    ENEMY_TINT_DARK_METAL,
  );
  t(
    "glow",
    "beacon",
    placePart(ellipsoidGeo(0.02, 10, 6, 1, 1.25, 1), 0, 0.012, 0),
    [14, 5.5, 0.5],
    false,
  );
  t(
    "metal",
    "antenna",
    placePart(enemyCylY(0.011, 0.014, 0.05, 8), 0, 0.025, 0),
    ENEMY_TINT_DARK_METAL,
  );
  t(
    "metal",
    "antenna",
    placePart(enemyCylY(0.0028, 0.005, 0.62, 5), 0, 0.36, 0),
    ENEMY_TINT_DARK_METAL,
  );
  t(
    "shell",
    "antenna",
    placePart(ellipsoidGeo(0.009, 6, 4), 0, 0.67, 0),
    ENEMY_TINT_ORANGE,
  );
  for (let n = 0; n < 4; n++) {
    let s = i.legs[n],
      o = i.side[n],
      r = "abd" + s,
      a = "thigh" + s,
      l = "shin" + s;
    t(
      "metal",
      r,
      placePart(enemyCylZ(0.06, 0.06, 0.17, 14), -o * 0.02, 0, 0),
      ENEMY_TINT_DARK_METAL,
    );
    t(
      "shell",
      r,
      placePart(enemyRoundBox(0.11, 0.05, 0.155, 0.014), o * 0, 0.058, 0),
      ENEMY_TINT_WHITE,
    );
    t(
      "metal",
      r,
      placePart(enemyCylZ(0.03, 0.03, 0.18, 8), -o * 0.02, 0, 0),
      ENEMY_TINT_BRIGHT_METAL,
    );
    t(
      "shell",
      a,
      placePart(enemyCylX(0.078, 0.078, 0.07, 18), 0, 0, 0),
      ENEMY_TINT_WHITE,
    );
    t(
      "shell",
      a,
      placePart(enemyCylX(0.081, 0.081, 0.016, 18), o * 0.012, 0, 0),
      ENEMY_TINT_ORANGE,
    );
    t(
      "metal",
      a,
      placePart(enemyCylX(0.048, 0.048, 0.082, 12), 0, 0, 0),
      ENEMY_TINT_DARK_METAL,
    );
    for (let c = 0; c < 5; c++) {
      let u = c * 1.2566;
      t(
        "metal",
        a,
        boltHeadX(o * 0.039, Math.cos(u) * 0.062, Math.sin(u) * 0.062),
        ENEMY_TINT_BRIGHT_METAL,
      );
    }
    t(
      "shell",
      a,
      placePart(
        enemyRoundBox(0.062, i.L1 - 0.07, 0.1, 0.022),
        0,
        -i.L1 * 0.5 - 0.005,
        0.004,
      ),
      ENEMY_TINT_WHITE,
    );
    t(
      "metal",
      a,
      placePart(
        enemyRoundBox(0.044, i.L1 - 0.04, 0.06, 0.012),
        0,
        -i.L1 * 0.5,
        -0.035,
      ),
      ENEMY_TINT_DARK_METAL,
    );
    t(
      "shell",
      a,
      placePart(enemyRoundBox(0.065, 0.045, 0.103, 0.01), 0, -0.145, 0.004),
      ENEMY_TINT_ORANGE,
    );
    t(
      "shell",
      a,
      placePart(enemyRoundBox(0.064, 0.012, 0.102, 0.004), 0, -0.26, 0.004),
      ENEMY_TINT_CHARCOAL,
    );
    t(
      "metal",
      a,
      cylinderBetween(
        [0, -0.06, -0.082],
        [0, -i.L1 * 0.62, -0.078],
        0.021,
        0.021,
        10,
      ),
      ENEMY_TINT_BRIGHT_METAL,
    );
    t(
      "metal",
      a,
      cylinderBetween(
        [0, -i.L1 * 0.62, -0.078],
        [0, -i.L1 + 0.025, -0.058],
        0.009,
        0.009,
        6,
      ),
      ENEMY_TINT_CHROME,
    );
    t(
      "metal",
      a,
      placePart(enemyRoundBox(0.05, 0.03, 0.035, 0.006), 0, -0.055, -0.07),
      ENEMY_TINT_NEUTRAL,
    );
    t(
      "shell",
      a,
      tubeGeo(
        [
          [o * 0.036, -0.02, 0.05],
          [o * 0.044, -0.13, 0.062],
          [o * 0.042, -0.28, 0.058],
          [o * 0.034, -i.L1 + 0.03, 0.035],
        ],
        0.0065,
        5,
      ),
      ENEMY_TINT_BLACK,
    );
    t(
      "metal",
      a,
      placePart(enemyCylX(0.05, 0.05, 0.086, 14), 0, -i.L1, 0),
      ENEMY_TINT_DARK_METAL,
    );
    t(
      "shell",
      a,
      placePart(enemyCylX(0.036, 0.036, 0.092, 12), 0, -i.L1, 0),
      ENEMY_TINT_PALE,
    );
    t(
      "metal",
      l,
      placePart(
        enemyCylY(0.03, 0.021, i.L2 - 0.08, 10),
        0,
        -(i.L2 - 0.08) / 2 - 0.01,
        0,
      ),
      ENEMY_TINT_DARK_METAL,
    );
    t(
      "shell",
      l,
      placePart(enemyRoundBox(0.052, 0.21, 0.04, 0.014), 0, -0.14, 0.02),
      ENEMY_TINT_WHITE,
    );
    t(
      "shell",
      l,
      placePart(enemyRoundBox(0.054, 0.02, 0.042, 0.006), 0, -0.215, 0.02),
      ENEMY_TINT_ORANGE,
    );
    t(
      "metal",
      l,
      placePart(enemyRoundBox(0.03, 0.06, 0.05, 0.008), 0, -0.02, -0.03),
      ENEMY_TINT_NEUTRAL,
    );
    t(
      "metal",
      l,
      placePart(enemyCylY(0.024, 0.03, 0.03, 10), 0, -i.L2 + 0.085, 0),
      ENEMY_TINT_BRIGHT_METAL,
    );
    t(
      "shell",
      l,
      placePart(
        ellipsoidGeo(i.footR + 0.002, 12, 8, 1, 0.86, 1.08),
        0,
        -i.L2 + i.footR * 0.86,
        0.004,
      ),
      ENEMY_TINT_BLACK,
    );
  }
  return e.build(["shell", "metal", "glow", "lens"]);
}
export const GULL_ROTORS = {
  rotors: [
    [0.33, 0.035, 0.3],
    [-0.33, 0.035, 0.3],
    [0.33, 0.035, -0.3],
    [-0.33, 0.035, -0.3],
  ],
  gimbal: [0, -0.095, 0.275],
  ball: [0, -0.072, 0],
  gun: [0, -0.085, -0.1],
  muzzle: [0, -0.032, 0.27],
  lamp: [0, -0.066, 0.025],
};
function rotorGuardProfile() {
  let i = [
    [0.176, -0.036],
    [0.196, -0.032],
    [0.206, 0],
    [0.202, 0.03],
    [0.19, 0.04],
    [0.178, 0.032],
    [0.173, 0],
    [0.176, -0.036],
  ].map((e) => new Vector2(e[0], e[1]));
  return new LatheGeometry(i, 28);
}
export function buildGullRig() {
  let i = GULL_ROTORS,
    e = new Rig(),
    t = new Rig(),
    n = (l: string, c: null | string, u: number, h: number, f: number) => {
      e.bone(l, c, u, h, f);
      t.bone(l, c, u, h, f);
    };
  n("root", null, 0, 0, 0);
  n("body", "root", 0, 0, 0);
  for (let l = 0; l < 4; l++)
    n("rotor" + l, "body", i.rotors[l][0], i.rotors[l][1], i.rotors[l][2]);
  n("gimbalYaw", "body", i.gimbal[0], i.gimbal[1], i.gimbal[2]);
  n("ball", "gimbalYaw", i.ball[0], i.ball[1], i.ball[2]);
  n("lamp", "ball", i.lamp[0], i.lamp[1], i.lamp[2]);
  n("gun", "body", i.gun[0], i.gun[1], i.gun[2]);
  n("strobeG", "body", 0, 0, 0);
  n("strobeR", "body", 0, 0, 0);
  n("strobeW", "body", 0, 0, 0);
  let s = (
    l: string,
    c: string,
    u: CylinderGeometry | TubeGeometry,
    h: number[],
    f?: boolean,
  ) => e.add(l, c, u, h, f);
  s(
    "shell",
    "body",
    placePart(ellipsoidGeo(1, 20, 12, 0.118, 0.074, 0.27), 0, 0.02, 0),
    ENEMY_TINT_WHITE,
  );
  s(
    "shell",
    "body",
    placePart(
      cylinderGeo(1, 0.9, 1, 20),
      0,
      0.02,
      0.165,
      ENEMY_HALF_PI,
      0,
      0,
      [0.094, 0.05, 0.06],
    ),
    ENEMY_TINT_ORANGE,
  );
  s(
    "shell",
    "body",
    placePart(
      cylinderGeo(1, 1, 1, 20),
      0,
      0.02,
      -0.02,
      ENEMY_HALF_PI,
      0,
      0,
      [0.121, 0.012, 0.0765],
    ),
    ENEMY_TINT_CHARCOAL,
  );
  s(
    "shell",
    "body",
    placePart(enemyRoundBox(0.118, 0.014, 0.2, 0.005), 0, 0.089, -0.03),
    ENEMY_TINT_PALE,
  );
  s(
    "shell",
    "body",
    placePart(enemyRoundBox(0.03, 0.006, 0.2, 0.002), 0, 0.0975, -0.03),
    ENEMY_TINT_ORANGE,
  );
  for (let l of [-0.05, 0.05])
    for (let c of [-0.12, 0.06])
      s("metal", "body", boltHeadY(l, 0.097, c), ENEMY_TINT_BRIGHT_METAL);
  s(
    "metal",
    "body",
    placePart(enemyRoundBox(0.175, 0.06, 0.37, 0.016), 0, -0.035, -0.005),
    ENEMY_TINT_DARK_METAL,
  );
  s(
    "metal",
    "body",
    placePart(enemyRoundBox(0.12, 0.075, 0.11, 0.014), 0, 0.005, -0.265),
    ENEMY_TINT_NEUTRAL,
  );
  s(
    "shell",
    "body",
    placePart(enemyRoundBox(0.124, 0.02, 0.03, 0.005), 0, 0.03, -0.3),
    ENEMY_TINT_ORANGE,
  );
  s(
    "glow",
    "body",
    placePart(enemyRoundBox(0.05, 0.006, 0.003, 0.001), 0, 0, -0.321),
    [0.3, 1.6, 0.4],
    false,
  );
  for (let l of [1, -1]) {
    for (let c = 0; c < 4; c++)
      s(
        "metal",
        "body",
        placePart(
          enemyRoundBox(0.004, 0.01, 0.06, 0.001),
          l * 0.0885,
          -0.045 + c * 0.016,
          -0.06,
        ),
        [0.2, 0.2, 0.2],
      );
    s(
      "metal",
      "body",
      tubeGeo(
        [
          [l * 0.075, -0.055, 0.13],
          [l * 0.135, -0.175, 0.16],
          [l * 0.135, -0.192, 0.11],
          [l * 0.135, -0.192, -0.14],
          [l * 0.135, -0.175, -0.19],
          [l * 0.075, -0.055, -0.15],
        ],
        0.0085,
        6,
        false,
        0.5,
      ),
      ENEMY_TINT_BRIGHT_METAL,
    );
    for (let c of [0.07, -0.1])
      s(
        "shell",
        "body",
        placePart(enemyCylZ(0.0135, 0.0135, 0.07, 8), l * 0.135, -0.192, c),
        ENEMY_TINT_BLACK,
      );
    s(
      "metal",
      "body",
      cylinderBetween(
        [l * 0.04, 0.07, -0.17],
        [l * 0.085, 0.37, -0.27],
        0.004,
        0.002,
        5,
      ),
      ENEMY_TINT_DARK_METAL,
    );
    s(
      "metal",
      "body",
      placePart(enemyCylY(0.008, 0.01, 0.025, 6), l * 0.04, 0.078, -0.17),
      ENEMY_TINT_BRIGHT_METAL,
    );
  }
  s(
    "metal",
    "body",
    placePart(enemyCylY(0.007, 0.007, 0.04, 6), 0, 0.105, 0.1),
    ENEMY_TINT_BRIGHT_METAL,
  );
  s(
    "shell",
    "body",
    placePart(enemyCylY(0.034, 0.036, 0.018, 14), 0, 0.132, 0.1),
    ENEMY_TINT_WHITE,
  );
  s(
    "metal",
    "body",
    placePart(enemyRoundBox(0.07, 0.03, 0.09, 0.008), 0, -0.075, 0.235),
    ENEMY_TINT_NEUTRAL,
  );
  let o = rotorGuardProfile();
  for (let l = 0; l < 4; l++) {
    let [c, u, h] = i.rotors[l],
      f = Math.sign(c),
      p = Math.sign(h);
    s(
      "metal",
      "body",
      cylinderBetween(
        [f * 0.07, 0, p * 0.09],
        [c, u - 0.05, h],
        0.017,
        0.015,
        8,
      ),
      ENEMY_TINT_DARK_METAL,
    );
    s(
      "shell",
      "body",
      placePart(
        enemyRoundBox(0.07, 0.045, 0.07, 0.014),
        f * 0.085,
        0,
        p * 0.1,
        0,
        f * p * 0.74,
        0,
      ),
      ENEMY_TINT_WHITE,
    );
    s(
      "shell",
      "body",
      tubeGeo(
        [
          [f * 0.09, 0.02, p * 0.12],
          [f * 0.18, 0.012, p * 0.19],
          [c - f * 0.05, u - 0.03, h - p * 0.04],
        ],
        0.005,
        5,
      ),
      ENEMY_TINT_BLACK,
    );
    s(
      "metal",
      "body",
      placePart(enemyCylY(0.04, 0.03, 0.075, 12), c, u - 0.05, h),
      ENEMY_TINT_DARK_METAL,
    );
    s(
      "metal",
      "body",
      placePart(enemyCylY(0.042, 0.042, 0.012, 12), c, u - 0.02, h),
      ENEMY_TINT_BRIGHT_METAL,
    );
    s("shell", "body", placePart(o.clone(), c, u, h), ENEMY_TINT_WHITE);
    s(
      "shell",
      "body",
      placePart(
        new TorusGeometry(0.196, 0.0085, 6, 28),
        c,
        u + 0.036,
        h,
        ENEMY_HALF_PI,
        0,
        0,
      ),
      ENEMY_TINT_ORANGE,
    );
    for (let v = 0; v < 3; v++) {
      let g = v * 2.094 + 0.5 + l;
      s(
        "metal",
        "body",
        placePart(
          enemyRoundBox(0.145, 0.007, 0.016, 0.002),
          c + Math.cos(g) * 0.105,
          u - 0.022,
          h - Math.sin(g) * 0.105,
          0,
          g,
          0,
        ),
        ENEMY_TINT_DARK_METAL,
      );
    }
    for (let v = -1; v <= 1; v++) {
      let g = Math.atan2(p, f) + v * 0.2;
      s(
        "shell",
        "body",
        placePart(
          enemyRoundBox(0.012, 0.05, 0.036, 0.003),
          c + Math.cos(g) * 0.205,
          u,
          h + Math.sin(g) * 0.205,
          0,
          -g,
          0,
        ),
        v === 0 ? ENEMY_TINT_CHARCOAL : ENEMY_TINT_YELLOW,
      );
    }
    s(
      "metal",
      "rotor" + l,
      placePart(enemyCylY(0.017, 0.02, 0.03, 8), 0, -0.002, 0),
      ENEMY_TINT_BRIGHT_METAL,
    );
    s(
      "metal",
      "rotor" + l,
      placePart(
        enemyRoundBox(0.158, 0.0035, 0.03, 0.001),
        0.088,
        0.008,
        0,
        0.22,
        0,
        0,
      ),
      ENEMY_TINT_DARK_METAL,
    );
    s(
      "metal",
      "rotor" + l,
      placePart(
        enemyRoundBox(0.158, 0.0035, 0.03, 0.001),
        -0.088,
        0.008,
        0,
        -0.22,
        0,
        0,
      ),
      ENEMY_TINT_DARK_METAL,
    );
    s(
      "shell",
      "rotor" + l,
      placePart(
        enemyRoundBox(0.02, 0.004, 0.031, 0.001),
        0.158,
        0.008,
        0,
        0.22,
        0,
        0,
      ),
      ENEMY_TINT_YELLOW,
    );
    s(
      "shell",
      "rotor" + l,
      placePart(
        enemyRoundBox(0.02, 0.004, 0.031, 0.001),
        -0.158,
        0.008,
        0,
        -0.22,
        0,
        0,
      ),
      ENEMY_TINT_YELLOW,
    );
    let d = new RingGeometry(0.03, 0.168, 24, 1);
    d.rotateX(-ENEMY_HALF_PI);
    t.add("disc", "body", placePart(d, c, u + 0.008, h), [1, 1, 1], false);
  }
  s(
    "glow",
    "strobeR",
    placePart(ellipsoidGeo(0.012, 8, 6), 0.33 + 0.215, 0.035, 0.3),
    [10, 0.4, 0.2],
    false,
  );
  s(
    "glow",
    "strobeR",
    placePart(ellipsoidGeo(0.012, 8, 6), 0.33 + 0.215, 0.035, -0.3),
    [10, 0.4, 0.2],
    false,
  );
  s(
    "glow",
    "strobeG",
    placePart(ellipsoidGeo(0.012, 8, 6), -0.33 - 0.215, 0.035, 0.3),
    [0.3, 9, 1],
    false,
  );
  s(
    "glow",
    "strobeG",
    placePart(ellipsoidGeo(0.012, 8, 6), -0.33 - 0.215, 0.035, -0.3),
    [0.3, 9, 1],
    false,
  );
  s(
    "glow",
    "strobeW",
    placePart(ellipsoidGeo(0.011, 8, 6), 0, 0.05, -0.325),
    [9, 9, 9],
    false,
  );
  s(
    "metal",
    "gimbalYaw",
    placePart(enemyCylY(0.036, 0.036, 0.014, 12), 0, -0.004, 0),
    ENEMY_TINT_DARK_METAL,
  );
  s(
    "metal",
    "gimbalYaw",
    placePart(enemyRoundBox(0.156, 0.01, 0.03, 0.003), 0, -0.014, 0),
    ENEMY_TINT_NEUTRAL,
  );
  for (let l of [1, -1])
    s(
      "metal",
      "gimbalYaw",
      placePart(enemyRoundBox(0.009, 0.075, 0.03, 0.003), l * 0.0735, -0.05, 0),
      ENEMY_TINT_NEUTRAL,
    );
  s(
    "metal",
    "ball",
    placePart(ellipsoidGeo(0.06, 18, 12), 0, 0, 0),
    ENEMY_TINT_DARK_METAL,
  );
  s(
    "metal",
    "ball",
    placePart(enemyCylX(0.013, 0.013, 0.142, 8), 0, 0, 0),
    ENEMY_TINT_BRIGHT_METAL,
  );
  s(
    "metal",
    "ball",
    placePart(enemyCylZ(0.031, 0.036, 0.03, 14), 0, 0.004, 0.048),
    ENEMY_TINT_NEUTRAL,
  );
  s(
    "lens",
    "ball",
    placePart(enemyCylZ(0.025, 0.025, 0.004, 14), 0, 0.004, 0.0645),
    [1, 1, 1],
    false,
  );
  s(
    "metal",
    "ball",
    placePart(enemyCylZ(0.012, 0.012, 0.01, 8), 0.03, 0.036, 0.04),
    [0.1, 0.12, 0.2],
  );
  s(
    "metal",
    "ball",
    placePart(
      enemyCylZ(0.019, 0.023, 0.045, 10),
      i.lamp[0],
      i.lamp[1],
      i.lamp[2] - 0.022,
    ),
    ENEMY_TINT_DARK_METAL,
  );
  s(
    "glow",
    "lamp",
    placePart(enemyCylZ(0.016, 0.016, 0.003, 10), 0, 0, 0.001),
    [11, 9.8, 7.6],
    false,
  );
  {
    let u = new ConeGeometry(1.25, 9, 20, 6, true);
    u.translate(0, -9 / 2, 0);
    u.rotateX(-ENEMY_HALF_PI);
    t.add("cone", "lamp", u, [1, 1, 1], false);
  }
  s(
    "metal",
    "gun",
    placePart(enemyRoundBox(0.05, 0.03, 0.05, 0.006), 0, 0.012, 0),
    ENEMY_TINT_NEUTRAL,
  );
  s(
    "metal",
    "gun",
    placePart(enemyCylX(0.012, 0.012, 0.07, 8), 0, -0.005, 0),
    ENEMY_TINT_BRIGHT_METAL,
  );
  s(
    "metal",
    "gun",
    placePart(enemyRoundBox(0.052, 0.046, 0.13, 0.008), 0, -0.032, 0),
    ENEMY_TINT_NEUTRAL,
  );
  s(
    "shell",
    "gun",
    placePart(enemyRoundBox(0.054, 0.012, 0.05, 0.003), 0, -0.02, -0.03),
    ENEMY_TINT_ORANGE,
  );
  for (let l of [-0.014, 0.014]) {
    s(
      "metal",
      "gun",
      placePart(enemyCylZ(0.0085, 0.0085, 0.2, 8), l, -0.032, 0.16),
      ENEMY_TINT_DARK_METAL,
    );
    s(
      "metal",
      "gun",
      placePart(enemyCylZ(0.012, 0.012, 0.03, 8), l, -0.032, 0.255),
      ENEMY_TINT_NEUTRAL,
    );
  }
  s(
    "metal",
    "gun",
    placePart(enemyRoundBox(0.045, 0.012, 0.012, 0.002), 0, -0.032, 0.2),
    ENEMY_TINT_BRIGHT_METAL,
  );
  s(
    "metal",
    "gun",
    placePart(enemyRoundBox(0.03, 0.05, 0.05, 0.006), 0.04, -0.035, -0.02),
    ENEMY_TINT_DARK_METAL,
  );
  let r = e.build(["shell", "metal", "glow", "lens"]),
    a = t.build(["disc", "cone"]);
  return Object.assign(r, { extra: a });
}
