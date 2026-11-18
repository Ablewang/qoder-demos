import {
  TAU,
  applyEnvelope,
  audioRng,
  biquad,
  buffer,
  chirp,
  crackles,
  expEnvelope,
  expSweep,
  gain,
  loopCrossfade,
  loopedNoise,
  mixInto,
  mixWrap,
  modalRing,
  noiseBuffer,
  noiseBurst,
  pitchDropTone,
  randRange,
  saturateTanh,
  sumBuffers,
  sweepFilter,
} from "./dsp";

export function genRifleShot(
  i: number,
  e: (() => number) | undefined,
  t: number,
) {
  let n = [1, 0.955, 1.045, 0.985][t & 3],
    s = [1, 1.12, 0.9, 1.05][t & 3],
    o = buffer(i, 0.32);
  mixInto(
    o,
    noiseBurst(i, e, 0.012, 0.0011, {
      hp: 2600 * s,
    }),
    0,
    2.6,
    i,
  );
  mixInto(
    o,
    noiseBurst(i, e, 0.02, 0.003, {
      hp: 1200,
      lp: 8e3,
    }),
    2e-4,
    1.2,
    i,
  );
  mixInto(
    o,
    pitchDropTone(i, 0.11, 160 * n, 45 * n, 0.024, 0.03, 0.003),
    0,
    0.62,
    i,
  );
  mixInto(
    o,
    noiseBurst(i, e, 0.22, 0.03, {
      hp: 300 * n,
      lp: 2500 * n * s,
      att: 0.0012,
    }),
    0,
    1.5,
    i,
  );
  mixInto(
    o,
    noiseBurst(i, e, 0.09, 0.016, {
      bp: 760 * n,
      q: 2.2,
      att: 0.001,
    }),
    0,
    0.9,
    i,
  );
  mixInto(
    o,
    noiseBurst(i, e, 0.16, 0.04, {
      hp: 4800,
    }),
    0.001,
    0.34,
    i,
  );
  let r = 0.035 + (t - 1.5) * 0.0015;
  mixInto(
    o,
    modalRing(
      i,
      0.05,
      [
        [2150 * n, 0.007, 1],
        [3420 * n, 0.006, 0.7],
        [5230, 0.004, 0.5],
        [880 * n, 0.012, 0.5],
      ],
      e,
    ),
    r,
    0.26,
    i,
  );
  mixInto(
    o,
    noiseBurst(i, e, 0.012, 0.002, {
      bp: 3100,
      q: 1.2,
    }),
    r,
    0.3,
    i,
  );
  mixInto(
    o,
    modalRing(
      i,
      0.05,
      [
        [1780 * n, 0.008, 1],
        [2890 * n, 0.006, 0.6],
        [640 * n, 0.02, 0.5],
      ],
      e,
    ),
    r + 0.027,
    0.17,
    i,
  );
  mixInto(
    o,
    noiseBurst(i, e, 0.01, 0.002, {
      bp: 2400,
      q: 1.2,
    }),
    r + 0.027,
    0.16,
    i,
  );
  mixInto(
    o,
    modalRing(
      i,
      0.2,
      [
        [712 * n, 0.05, 1],
        [1466 * n, 0.03, 0.4],
      ],
      e,
    ),
    r + 0.03,
    0.035,
    i,
  );
  return saturateTanh(gain(o, 0.46), 1.5);
}
export function genRifleTailOut(i: number, e: () => number, t: any) {
  let n = (o: number) => {
      let r = audioRng(o),
        a = buffer(i, 1.55),
        l = t
          ? [
              [0.058, 0.5, 4200],
              [0.097, 0.4, 3300],
              [0.139, 0.28, 2500],
              [0.176, 0.2, 1900],
              [0.262, 0.1, 1300],
            ]
          : [
              [0.066, 0.52, 4600],
              [0.088, 0.34, 3600],
              [0.124, 0.3, 2700],
              [0.169, 0.22, 2e3],
              [0.231, 0.12, 1400],
            ];
      for (let [h, f, p] of l)
        mixInto(
          a,
          noiseBurst(i, r, 0.09, 0.016, {
            hp: 420,
            lp: p,
          }),
          h + randRange(r, -0.004, 0.004),
          f * randRange(r, 0.8, 1.1),
          i,
        );
      let c = noiseBuffer(i, 1.5, r);
      sweepFilter(c, "lp", expSweep(3400, 380, 0.6), 0.6, i);
      biquad(c, "hp", 130, 0.7, i);
      mixInto(a, applyEnvelope(c, i, expEnvelope(0.3, 0.05)), 0.03, 0.55, i);
      let u = noiseBuffer(i, 1.2, r);
      biquad(u, "lp", 150, 0.7, i);
      mixInto(a, applyEnvelope(u, i, expEnvelope(0.26, 0.03)), 0.02, 0.9, i);
      return a;
    },
    s = Math.floor(e() * 1e9);
  return [n(s), n(s + 77)];
}
export function* genRifleTailIn(i: number, e: () => number, t: any) {
  let n = function* (o: number) {
      let r = audioRng(o),
        a = buffer(i, 2.3),
        l = noiseBuffer(i, 2.25, r);
      sweepFilter(l, "lp", expSweep(2400, 260, 0.5), 0.7, i);
      mixInto(a, applyEnvelope(l, i, expEnvelope(0.42, 0.012)), 0.008, 0.6, i);
      for (let [u, h] of [
        [54, 1],
        [81, 0.8],
        [117, 0.6],
        [163, 0.45],
        [228, 0.3],
      ]) {
        let f = noiseBuffer(i, 2.2, r);
        biquad(f, "bp", u * (t ? 1.06 : 1), 9, i);
        mixInto(
          a,
          applyEnvelope(f, i, expEnvelope(0.5, 0.02)),
          0.01,
          h * 2.4,
          i,
        );
        yield;
      }
      let c = t ? 0.051 : 0.044;
      for (let u = 1; u < 9; u++)
        mixInto(
          a,
          noiseBurst(i, r, 0.05, 0.009, {
            hp: 500,
            lp: 3800 / (1 + u * 0.35),
          }),
          c * u + randRange(r, -0.003, 0.003),
          0.42 * Math.pow(0.74, u),
          i,
        );
      return a;
    },
    s = Math.floor(e() * 1e9);
  return [yield* n(s), yield* n(s + 131)];
}
export function genRifleDry(i: number, e: (() => number) | undefined) {
  let t = buffer(i, 0.13);
  mixInto(
    t,
    modalRing(
      i,
      0.05,
      [
        [2840, 0.004, 1],
        [4130, 0.004, 0.7],
        [6320, 0.003, 0.5],
        [1210, 0.008, 0.4],
      ],
      e,
    ),
    0,
    0.7,
    i,
  );
  mixInto(
    t,
    noiseBurst(i, e, 0.006, 0.0012, {
      hp: 2e3,
    }),
    0,
    0.6,
    i,
  );
  mixInto(
    t,
    modalRing(
      i,
      0.08,
      [
        [930, 0.018, 1],
        [1870, 0.012, 0.5],
      ],
      e,
    ),
    0.016,
    0.16,
    i,
  );
  mixInto(
    t,
    noiseBurst(i, e, 0.004, 0.001, {
      hp: 3e3,
    }),
    0.018,
    0.2,
    i,
  );
  return t;
}
function metalClank(
  i: number,
  e: any,
  t: number,
  n: number,
  s: number,
  o: number,
) {
  let r = noiseBuffer(i, t, e);
  sweepFilter(r, "bp", expSweep(n, s), 1.6, i);
  let a = 0.5,
    l = 0.5;
  for (let c = 0; c < r.length; c++) {
    if (c % Math.round(i / o) === 0) {
      l = 0.25 + e() * 0.75;
    }
    a += (l - a) * 0.02;
    let u = c / r.length;
    r[c] *= a * Math.sin(Math.PI * Math.pow(u, 0.7));
  }
  return r;
}
export function genReloadMagOut(i: number, e: (() => number) | undefined) {
  let t = buffer(i, 0.46);
  mixInto(
    t,
    modalRing(
      i,
      0.03,
      [
        [3300, 0.004, 1],
        [5100, 0.003, 0.6],
      ],
      e,
    ),
    0.004,
    0.45,
    i,
  );
  mixInto(
    t,
    noiseBurst(i, e, 0.005, 0.001, {
      hp: 2500,
    }),
    0.004,
    0.35,
    i,
  );
  mixInto(t, metalClank(i, e, 0.17, 1700, 3400, 190), 0.03, 0.5, i);
  mixInto(
    t,
    noiseBurst(i, e, 0.06, 0.012, {
      lp: 950,
    }),
    0.2,
    0.8,
    i,
  );
  mixInto(
    t,
    modalRing(
      i,
      0.12,
      [
        [415, 0.03, 1],
        [1140, 0.018, 0.6],
        [2290, 0.01, 0.4],
        [3470, 0.006, 0.25],
      ],
      e,
    ),
    0.2,
    0.42,
    i,
  );
  mixInto(
    t,
    noiseBurst(i, e, 0.08, 0.02, {
      bp: 2600,
      q: 0.8,
    }),
    0.215,
    0.14,
    i,
  );
  return t;
}
export function genReloadMagIn(i: number, e: (() => number) | undefined) {
  let t = buffer(i, 0.5);
  mixInto(t, metalClank(i, e, 0.14, 1250, 2900, 240), 0, 0.55, i);
  mixInto(
    t,
    modalRing(
      i,
      0.03,
      [
        [2600, 0.004, 1],
        [4300, 0.003, 0.5],
      ],
      e,
    ),
    0.05,
    0.2,
    i,
  );
  mixInto(t, pitchDropTone(i, 0.07, 190, 88, 0.02, 0.022), 0.15, 0.8, i);
  mixInto(
    t,
    noiseBurst(i, e, 0.05, 0.008, {
      lp: 1600,
    }),
    0.15,
    0.8,
    i,
  );
  mixInto(
    t,
    modalRing(
      i,
      0.1,
      [
        [655, 0.024, 1],
        [1710, 0.014, 0.6],
        [3120, 0.008, 0.4],
      ],
      e,
    ),
    0.15,
    0.4,
    i,
  );
  mixInto(
    t,
    modalRing(
      i,
      0.04,
      [
        [3650, 0.005, 1],
        [5600, 0.004, 0.6],
        [2100, 0.007, 0.5],
      ],
      e,
    ),
    0.187,
    0.42,
    i,
  );
  mixInto(
    t,
    noiseBurst(i, e, 0.005, 0.001, {
      hp: 3e3,
    }),
    0.187,
    0.36,
    i,
  );
  return t;
}
export function genReloadBolt(i: number, e: (() => number) | undefined) {
  let t = buffer(i, 0.38);
  mixInto(
    t,
    modalRing(
      i,
      0.03,
      [
        [2900, 0.005, 1],
        [4600, 0.004, 0.6],
      ],
      e,
    ),
    0,
    0.3,
    i,
  );
  mixInto(
    t,
    noiseBurst(i, e, 0.03, 0.01, {
      bp: 2200,
      q: 0.8,
    }),
    0.004,
    0.25,
    i,
  );
  let n = 0.03;
  mixInto(
    t,
    noiseBurst(i, e, 0.02, 0.004, {
      hp: 1200,
    }),
    n,
    1,
    i,
  );
  mixInto(t, pitchDropTone(i, 0.06, 230, 105, 0.012, 0.018), n, 0.8, i);
  mixInto(
    t,
    modalRing(
      i,
      0.15,
      [
        [1310, 0.03, 1],
        [2460, 0.024, 0.8],
        [3920, 0.016, 0.6],
        [5640, 0.01, 0.45],
        [7900, 0.006, 0.3],
      ],
      e,
    ),
    n,
    0.36,
    i,
  );
  mixInto(
    t,
    modalRing(
      i,
      0.3,
      [
        [722, 0.075, 1],
        [1451, 0.05, 0.35],
      ],
      e,
    ),
    n + 0.002,
    0.1,
    i,
  );
  return saturateTanh(t, 1.3);
}
export function genShellBounce(
  i: number,
  e: (() => number) | undefined,
  t: number,
) {
  let n = buffer(i, 0.55),
    s = [1, 1.09, 0.93][t % 3],
    o = 0,
    r = 1,
    a = 2 + (t !== 1 ? 1 : 0);
  for (let l = 0; l < a; l++) {
    let c = s * randRange(e, 0.96, 1.05);
    mixInto(
      n,
      modalRing(
        i,
        0.22,
        [
          [4180 * c, randRange(e, 0.03, 0.055), 1],
          [6830 * c, 0.03, 0.7],
          [9760 * c, 0.02, 0.5],
          [11900 * c, 0.012, 0.3],
          [2470 * c, 0.012, 0.3],
        ],
        e,
      ),
      o,
      r * 0.5,
      i,
    );
    mixInto(
      n,
      noiseBurst(i, e, 0.004, 8e-4, {
        hp: 3500,
      }),
      o,
      r * 0.5,
      i,
    );
    o += randRange(e, 0.085, 0.15) * (l ? 0.75 : 1);
    r *= randRange(e, 0.45, 0.62);
  }
  return n;
}
export function genStepConcrete(i: number, e: () => number, t: number) {
  let n = buffer(i, 0.3),
    s = [1, 1.07, 0.94, 1.03][t & 3];
  mixInto(
    n,
    pitchDropTone(i, 0.06, 112 * s, 58 * s, 0.018, 0.02, 0.002),
    0,
    0.75,
    i,
  );
  mixInto(
    n,
    noiseBurst(i, e, 0.06, 0.016, {
      lp: 720 * s,
    }),
    0,
    0.9,
    i,
  );
  mixInto(
    n,
    noiseBurst(i, e, 0.1, 0.028, {
      bp: 2500 * s,
      q: 0.7,
      att: 0.004,
    }),
    0.012,
    0.22,
    i,
  );
  let o = noiseBurst(i, e, 0.2, 0.05, {
      hp: 3800,
      att: 0.01,
    }),
    r = 1;
  for (let a = 0; a < o.length; a++) {
    if (a % 70 === 0) {
      r = 0.3 + e() * 0.7;
    }
    o[a] *= r;
  }
  mixInto(n, o, 0.02, 0.16, i);
  return n;
}
function splashNoise(i: number, e: () => number, t: number, n: number) {
  let s = buffer(i, t),
    o = noiseBuffer(i, t * 0.9, e);
  sweepFilter(o, "bp", expSweep(1500, 520), 0.8, i);
  mixInto(s, applyEnvelope(o, i, expEnvelope(0.085 * n, 0.007)), 0, 0.9, i);
  mixInto(
    s,
    noiseBurst(i, e, t * 0.8, 0.07 * n, {
      hp: 3e3,
      att: 0.012,
    }),
    0.01,
    0.25,
    i,
  );
  let r = Math.round(5 * n);
  for (let a = 0; a < r; a++) {
    let l = randRange(e, 500, 1700);
    mixInto(
      s,
      chirp(i, randRange(e, 0.008, 0.02), l, l * randRange(e, 1.3, 1.9)),
      randRange(e, 0.03, t * 0.6),
      randRange(e, 0.1, 0.3),
      i,
    );
  }
  return s;
}
export function genStepWater(i: number, e: () => number, t: number) {
  let n = splashNoise(i, e, 0.46, 1 + t * 0.08);
  mixInto(n, pitchDropTone(i, 0.06, 100, 55, 0.02, 0.02, 0.002), 0, 0.5, i);
  return n;
}
export function genStepMetal(
  i: number,
  e: (() => number) | undefined,
  t: number,
) {
  let n = buffer(i, 0.38),
    s = [1, 1.08, 0.92][t % 3];
  mixInto(n, pitchDropTone(i, 0.06, 120, 62, 0.018, 0.02, 0.002), 0, 0.6, i);
  mixInto(
    n,
    noiseBurst(i, e, 0.04, 0.008, {
      lp: 2400,
    }),
    0,
    0.6,
    i,
  );
  mixInto(
    n,
    modalRing(
      i,
      0.36,
      [
        [178 * s, 0.09, 1],
        [412 * s, 0.075, 0.8],
        [733 * s, 0.06, 0.55],
        [1214 * s, 0.045, 0.4],
        [1958 * s, 0.03, 0.3],
        [3130 * s, 0.016, 0.18],
      ],
      e,
    ),
    0.001,
    0.3,
    i,
  );
  mixInto(
    n,
    noiseBurst(i, e, 0.08, 0.02, {
      bp: 3e3,
      q: 0.8,
      att: 0.003,
    }),
    0.01,
    0.1,
    i,
  );
  return n;
}
export function genLand(i: number, e: () => number) {
  let t = buffer(i, 0.45);
  mixInto(t, pitchDropTone(i, 0.14, 124, 44, 0.03, 0.045, 0.002), 0, 1, i);
  mixInto(
    t,
    noiseBurst(i, e, 0.14, 0.035, {
      lp: 520,
    }),
    0,
    1,
    i,
  );
  mixInto(
    t,
    noiseBurst(i, e, 0.2, 0.06, {
      bp: 1500,
      q: 0.7,
      att: 0.01,
    }),
    0.01,
    0.16,
    i,
  );
  for (let n of [0.022, 0.05, 0.088])
    mixInto(
      t,
      noiseBurst(i, e, 0.012, 0.003, {
        bp: randRange(e, 2200, 4200),
        q: 2,
      }),
      n,
      randRange(e, 0.1, 0.22),
      i,
    );
  mixInto(
    t,
    noiseBurst(i, e, 0.2, 0.05, {
      hp: 3500,
      att: 0.01,
    }),
    0.015,
    0.1,
    i,
  );
  return saturateTanh(t, 1.2);
}
export function genJump(i: number, e: () => number) {
  let t = buffer(i, 0.26);
  mixInto(
    t,
    noiseBurst(i, e, 0.2, 0.05, {
      bp: 900,
      q: 0.7,
      att: 0.02,
    }),
    0,
    0.6,
    i,
  );
  mixInto(
    t,
    noiseBurst(i, e, 0.1, 0.025, {
      bp: 2600,
      q: 0.8,
      att: 0.004,
    }),
    0.005,
    0.35,
    i,
  );
  mixInto(t, pitchDropTone(i, 0.05, 95, 60, 0.02, 0.018, 0.003), 0, 0.4, i);
  return t;
}
export function genHurt(i: number, e: () => number) {
  let t = buffer(i, 0.5);
  mixInto(t, pitchDropTone(i, 0.25, 92, 38, 0.04, 0.06, 0.0015), 0, 1.1, i);
  mixInto(
    t,
    noiseBurst(i, e, 0.2, 0.04, {
      lp: 320,
    }),
    0,
    1.2,
    i,
  );
  mixInto(
    t,
    noiseBurst(i, e, 0.06, 0.01, {
      bp: 820,
      q: 1,
    }),
    0,
    0.55,
    i,
  );
  mixInto(
    t,
    noiseBurst(i, e, 0.03, 0.004, {
      hp: 1800,
      lp: 5e3,
    }),
    0,
    0.2,
    i,
  );
  return saturateTanh(t, 1.6);
}
export function genEarRing(i: number) {
  let e = buffer(i, 2.4);
  for (let t = 0; t < e.length; t++) {
    let n = t / i;
    e[t] =
      (Math.sin(TAU * 3150 * n) +
        0.7 * Math.sin(TAU * 4013 * n + 1) +
        0.35 * Math.sin(TAU * 5310 * n + 2)) *
      (1 - Math.exp(-n / 0.12)) *
      Math.exp(-n / 0.55);
  }
  return e;
}
export function genImpactMetal(
  i: number,
  e: (() => number) | undefined,
  t: number,
) {
  let n = buffer(i, 0.5),
    s = [640, 880, 745][t % 3] * randRange(e, 0.97, 1.03);
  mixInto(
    n,
    noiseBurst(i, e, 0.015, 0.003, {
      hp: 1500,
    }),
    0,
    1,
    i,
  );
  mixInto(
    n,
    noiseBurst(i, e, 0.04, 0.008, {
      lp: 1800,
    }),
    0,
    0.6,
    i,
  );
  mixInto(
    n,
    modalRing(
      i,
      0.48,
      [1, 1.58, 2.24, 2.92, 3.71, 4.93, 6.31, 8.1].map((r, a) => [
        s * r,
        0.13 / (1 + a * 0.55),
        1 / (1 + a * 0.5),
      ]),
      e,
    ),
    5e-4,
    0.42,
    i,
  );
  return n;
}
export function genImpactConcrete(i: number, e: () => number, t: number) {
  let n = buffer(i, 0.36),
    s = [1, 1.1, 0.9][t % 3];
  mixInto(
    n,
    noiseBurst(i, e, 0.06, 0.013, {
      lp: 950 * s,
    }),
    0,
    1.1,
    i,
  );
  mixInto(n, pitchDropTone(i, 0.05, 150 * s, 70, 0.012, 0.016), 0, 0.6, i);
  mixInto(
    n,
    noiseBurst(i, e, 0.012, 0.002, {
      hp: 2e3,
    }),
    0,
    0.6,
    i,
  );
  mixInto(
    n,
    noiseBurst(i, e, 0.12, 0.024, {
      bp: 3500 * s,
      q: 0.7,
    }),
    0.003,
    0.3,
    i,
  );
  mixInto(
    n,
    crackles(i, e, 0.34, 16, {
      from: 0.03,
      fall: 1.8,
      hp: 1800,
      ampFall: 0.1,
    }),
    0,
    0.35,
    i,
  );
  return n;
}
export function genImpactWood(
  i: number,
  e: (() => number) | undefined,
  t: any,
) {
  let n = buffer(i, 0.26),
    s = t ? 1.14 : 1;
  mixInto(
    n,
    modalRing(
      i,
      0.2,
      [
        [238 * s, 0.03, 1],
        [512 * s, 0.022, 0.8],
        [893 * s, 0.016, 0.6],
        [1410 * s, 0.01, 0.4],
      ],
      e,
    ),
    0,
    0.6,
    i,
  );
  mixInto(
    n,
    noiseBurst(i, e, 0.03, 0.006, {
      lp: 2100,
    }),
    0,
    0.8,
    i,
  );
  mixInto(
    n,
    noiseBurst(i, e, 0.01, 0.002, {
      hp: 3e3,
    }),
    0,
    0.5,
    i,
  );
  mixInto(
    n,
    crackles(i, e, 0.2, 6, {
      from: 0.01,
      fall: 2,
      bp: 2600,
      q: 1.5,
    }),
    0,
    0.3,
    i,
  );
  return n;
}
export function genImpactWater(i: number, e: () => number, t: number) {
  let n = splashNoise(i, e, 0.5, 0.8 + t * 0.2);
  mixInto(n, chirp(i, 0.035, 420, 1150), 0, 0.5, i);
  return n;
}
export function genImpactEnemy(
  i: number,
  e: (() => number) | undefined,
  t: number,
) {
  let n = buffer(i, 0.3),
    s = [1, 1.12, 0.9][t % 3];
  mixInto(
    n,
    noiseBurst(i, e, 0.03, 0.007, {
      hp: 4e3,
    }),
    0,
    0.9,
    i,
  );
  mixInto(
    n,
    modalRing(
      i,
      0.12,
      [
        [2920 * s, 0.022, 1],
        [4730 * s, 0.018, 0.8],
        [7310 * s, 0.012, 0.6],
        [1180 * s, 0.03, 0.5],
      ],
      e,
    ),
    0,
    0.4,
    i,
  );
  mixInto(
    n,
    noiseBurst(i, e, 0.05, 0.012, {
      bp: 320 * s,
      q: 1.5,
    }),
    0,
    0.9,
    i,
  );
  let o = noiseBuffer(i, 0.06, e);
  biquad(o, "bp", 2400, 1, i);
  for (let r = 0; r < o.length; r++) {
    let a = r / i;
    o[r] *= (Math.sin(TAU * 118 * a) > 0.2 ? 1 : 0.1) * Math.exp(-a / 0.02);
  }
  mixInto(n, o, 0.004, 0.5, i);
  mixInto(
    n,
    crackles(i, e, 0.28, 10, {
      from: 0.02,
      fall: 1.6,
      hp: 5e3,
      ampFall: 0.08,
    }),
    0,
    0.3,
    i,
  );
  return n;
}
export function genImpactGlass(i: number, e: () => number) {
  let t = buffer(i, 0.45);
  mixInto(
    t,
    noiseBurst(i, e, 0.01, 0.002, {
      hp: 2500,
    }),
    0,
    1,
    i,
  );
  for (let n = 0; n < 9; n++) {
    let s = randRange(e, 3200, 9500);
    mixInto(
      t,
      modalRing(
        i,
        0.1,
        [
          [s, randRange(e, 0.01, 0.03), 1],
          [s * 1.47, 0.01, 0.5],
        ],
        e,
      ),
      Math.pow(e(), 2) * 0.3,
      randRange(e, 0.1, 0.35),
      i,
    );
  }
  return t;
}
export function genRicochet(i: number, e: () => number, t: number) {
  let n = buffer(i, 0.75),
    s = [3300, 2700, 3900][t % 3],
    o = [820, 1100, 700][t % 3],
    r = 0,
    a = noiseBuffer(i, 0.75, e);
  for (let l = 0; l < n.length; l++) {
    let c = l / i,
      u = o + (s - o) * Math.exp(-c / 0.16),
      h = 1 + 0.035 * Math.sin(TAU * (18 + 30 * c) * c);
    r += (TAU * u * h) / i;
    n[l] =
      (Math.sin(r) + 0.3 * Math.sin(2 * r)) *
      (1 - Math.exp(-c / 0.004)) *
      Math.exp(-c / 0.19);
  }
  sweepFilter(
    a,
    "bp",
    (l: number) => o + (s - o) * Math.exp((-l * 0.75) / 0.16),
    6,
    i,
  );
  mixInto(n, applyEnvelope(a, i, expEnvelope(0.15, 0.003)), 0, 1.6, i);
  mixInto(
    n,
    noiseBurst(i, e, 0.01, 0.002, {
      hp: 2500,
    }),
    0,
    0.7,
    i,
  );
  return n;
}
export function genWhiz(i: number, e: () => number, t: number) {
  let n = buffer(i, 0.3),
    s = noiseBuffer(i, 0.28, e),
    o = [5200, 4300, 6100][t % 3],
    r = [1300, 1e3, 1700][t % 3];
  sweepFilter(s, "bp", expSweep(o, r, 0.8), 3.5, i);
  for (let l = 0; l < s.length; l++) {
    let c = (l / i - 0.05) / (l / i < 0.05 ? 0.018 : 0.05);
    s[l] *= Math.exp(-c * c);
  }
  mixInto(n, s, 0, 1, i);
  mixInto(
    n,
    noiseBurst(i, e, 0.006, 8e-4, {
      hp: 3e3,
    }),
    0.048,
    0.25,
    i,
  );
  let a = chirp(i, 0.2, o * 0.5, r * 0.6);
  mixInto(n, a, 0, 0.03, i);
  return n;
}
const quantize = (i: number, e: number) => Math.round(i * e) / e;
export function* genGullRotor(i: number, e: () => number) {
  let n = i * 2,
    s = new Float32Array(n),
    o = [
      [184, 2.5],
      [207.5, 3.5],
      [233, 2],
      [258.5, 4.5],
    ];
  for (let [l, c] of o) {
    let u = quantize(l, 2),
      h = quantize(c, 2),
      f = e() * TAU,
      p = e() * TAU;
    for (let d = 0; d < n; d++) {
      let v = d / i,
        g = TAU * u * v + f;
      s[d] +=
        (Math.sin(g) +
          0.5 * Math.sin(2 * g + 1) +
          0.3 * Math.sin(3 * g + 2) +
          0.16 * Math.sin(4 * g) +
          0.08 * Math.sin(6 * g)) *
        (0.72 + 0.28 * Math.sin(TAU * h * v + p)) *
        0.25;
    }
    yield;
  }
  let r = loopedNoise(
      i,
      2,
      e,
      (l: any) => {
        biquad(l, "hp", 1100, 0.7, i);
        biquad(l, "lp", 5200, 0.7, i);
      },
      0.25,
    ),
    a = quantize(46, 2);
  for (let l = 0; l < n; l++)
    s[l] += r[l] * (0.55 + 0.45 * Math.sin((TAU * a * l) / i)) * 0.5;
  return s;
}
export function genHoundServo(i: number, e: () => number) {
  let n = i * 2,
    s = new Float32Array(n);
  for (let r = 0; r < n; r++) {
    let a = r / i,
      l = 1.1 * Math.sin(TAU * 0.5 * a) + 0.5 * Math.sin(TAU * 1.5 * a + 1),
      c = TAU * 310 * a + l,
      u = 0.7 + 0.3 * Math.sin(TAU * 1.5 * a),
      h =
        (Math.sin(c) +
          0.45 * Math.sin(2 * c + l) +
          0.2 * Math.sin(4 * c + 0.5)) *
        0.3 *
        u,
      f = TAU * 62 * a;
    h +=
      (Math.sin(f) +
        0.5 * Math.sin(2 * f) +
        0.33 * Math.sin(3 * f) +
        0.2 * Math.sin(5 * f)) *
      0.28;
    s[r] = h;
  }
  let o = loopedNoise(
    i,
    2,
    e,
    (r: any) => {
      biquad(r, "hp", 2800, 0.7, i);
      biquad(r, "lp", 7e3, 0.7, i);
    },
    0.25,
  );
  for (let r = 0; r < n; r++)
    s[r] += o[r] * 0.12 * (0.6 + 0.4 * Math.sin((TAU * 1.5 * r) / i + 2));
  return s;
}
export function genRelayHum(i: number, e: () => number) {
  let n = i * 2,
    s = new Float32Array(n);
  for (let r = 0; r < n; r++) {
    let a = r / i,
      l = TAU * 50 * a;
    s[r] =
      (Math.sin(l) * 0.5 +
        Math.sin(2 * l + 0.4) +
        0.5 * Math.sin(3 * l + 1) +
        0.3 * Math.sin(4 * l) +
        0.22 * Math.sin(6 * l + 2) +
        0.12 * Math.sin(10 * l)) *
        0.3 *
        (0.9 + 0.1 * Math.sin(TAU * 0.5 * a)) +
      Math.sin(TAU * 4100 * a) * 0.012 * (0.6 + 0.4 * Math.sin(TAU * 1 * a)) +
      Math.sin(TAU * 1250 * a + 0.6 * Math.sin(TAU * 2 * a)) * 0.02;
  }
  let o = loopedNoise(i, 2, e, (r: any) => biquad(r, "bp", 2100, 1.2, i), 0.25);
  for (let r = 0; r < n; r++)
    s[r] +=
      o[r] * 0.16 * Math.pow(0.5 + 0.5 * Math.sin((TAU * 100 * r) / i), 3);
  return s;
}
export function genGullFire(i: number, e: (() => number) | undefined, t: any) {
  let n = buffer(i, 0.3),
    s = t ? 1.07 : 1,
    o = 0;
  mixInto(
    n,
    noiseBurst(i, e, 0.008, 0.0012, {
      hp: 3200,
    }),
    0,
    1.1,
    i,
  );
  let r = buffer(i, 0.12);
  for (let a = 0; a < r.length; a++) {
    let l = a / i,
      c = (380 + 620 * Math.exp(-l / 0.018)) * s;
    o += c / i;
    let u = 2 * (o - Math.floor(o)) - 1;
    r[a] =
      (u + 0.5 * Math.sign(Math.sin(TAU * o * 2.02))) * Math.exp(-l / 0.024);
  }
  biquad(r, "bp", 1500 * s, 0.9, i);
  mixInto(n, r, 0, 1.5, i);
  mixInto(
    n,
    noiseBurst(i, e, 0.08, 0.014, {
      bp: 2400 * s,
      q: 1.4,
    }),
    0,
    0.7,
    i,
  );
  mixInto(n, pitchDropTone(i, 0.05, 240, 120, 0.012, 0.014), 0, 0.5, i);
  mixInto(
    n,
    modalRing(
      i,
      0.05,
      [
        [3400 * s, 0.006, 1],
        [5200, 0.005, 0.6],
        [1900, 0.008, 0.5],
      ],
      e,
    ),
    0.021,
    0.2,
    i,
  );
  mixInto(
    n,
    noiseBurst(i, e, 0.15, 0.04, {
      hp: 6e3,
    }),
    0.002,
    0.1,
    i,
  );
  return saturateTanh(gain(n, 0.6), 1.6);
}
export function genHoundFire(i: number, e: (() => number) | undefined, t: any) {
  let n = buffer(i, 0.48),
    s = t ? 0.94 : 1;
  mixInto(
    n,
    noiseBurst(i, e, 0.012, 0.002, {
      hp: 1500,
      lp: 6e3,
    }),
    0,
    0.7,
    i,
  );
  mixInto(n, pitchDropTone(i, 0.3, 112 * s, 37 * s, 0.035, 0.07), 0, 1.4, i);
  mixInto(
    n,
    noiseBurst(i, e, 0.3, 0.045, {
      hp: 90,
      lp: 900 * s,
    }),
    0,
    1.2,
    i,
  );
  mixInto(
    n,
    noiseBurst(i, e, 0.12, 0.024, {
      bp: 420 * s,
      q: 1.6,
    }),
    0,
    1.2,
    i,
  );
  mixInto(
    n,
    modalRing(
      i,
      0.12,
      [
        [310 * s, 0.03, 1],
        [642 * s, 0.022, 0.7],
        [985 * s, 0.016, 0.5],
        [2200, 0.006, 0.3],
      ],
      e,
    ),
    0.055,
    0.3,
    i,
  );
  mixInto(
    n,
    noiseBurst(i, e, 0.02, 0.004, {
      bp: 1800,
      q: 1,
    }),
    0.055,
    0.25,
    i,
  );
  return saturateTanh(gain(n, 0.42), 1.8);
}
export function genHoundStep(
  i: number,
  e: (() => number) | undefined,
  t: number,
) {
  let n = buffer(i, 0.42),
    s = [1, 1.07, 0.93][t % 3];
  mixInto(n, chirp(i, 0.035, 920 * s, 610 * s), 0, 0.06, i);
  let o = 0.03;
  mixInto(n, pitchDropTone(i, 0.2, 84 * s, 41, 0.03, 0.05, 0.002), o, 1.1, i);
  mixInto(
    n,
    noiseBurst(i, e, 0.12, 0.03, {
      lp: 360,
    }),
    o,
    1.1,
    i,
  );
  mixInto(
    n,
    noiseBurst(i, e, 0.03, 0.006, {
      lp: 2600,
      hp: 500,
    }),
    o,
    0.4,
    i,
  );
  mixInto(
    n,
    modalRing(
      i,
      0.12,
      [
        [522 * s, 0.026, 1],
        [1133 * s, 0.02, 0.7],
        [1871 * s, 0.014, 0.5],
        [3040 * s, 0.008, 0.3],
      ],
      e,
    ),
    o,
    0.2,
    i,
  );
  mixInto(
    n,
    noiseBurst(i, e, 0.14, 0.04, {
      hp: 3e3,
      att: 0.006,
    }),
    o + 0.01,
    0.06,
    i,
  );
  return saturateTanh(n, 1.5);
}
export function genGullDie(i: number, e: (() => number) | undefined) {
  let t = buffer(i, 1.5),
    n = [0, 0, 0, 0];
  mixInto(
    t,
    noiseBurst(i, e, 0.02, 0.004, {
      hp: 2500,
    }),
    0,
    0.9,
    i,
  );
  let s = [184, 207, 233, 258];
  for (let a = 0; a < Math.round(1.1 * i); a++) {
    let l = a / i,
      c = Math.pow(0.16, l / 1) * (1 + 0.06 * Math.sin(TAU * (9 - 5 * l) * l)),
      u = 0;
    for (let f = 0; f < 4; f++) {
      n[f] += (TAU * s[f] * c) / i;
      u += Math.sin(n[f]) + 0.5 * Math.sin(2 * n[f]) + 0.3 * Math.sin(3 * n[f]);
    }
    let h = 0.6 + 0.4 * Math.sign(Math.sin(TAU * (26 - 16 * l) * l));
    t[a] += u * 0.16 * h * Math.exp(-l / 0.55) * (1 - Math.exp(-l / 0.01));
  }
  let o = noiseBuffer(i, 1, e);
  sweepFilter(o, "bp", expSweep(3200, 500), 1, i);
  mixInto(t, applyEnvelope(o, i, expEnvelope(0.35, 0.01)), 0, 0.3, i);
  let r = 0.72;
  mixInto(
    t,
    noiseBurst(i, e, 0.2, 0.035, {
      lp: 3e3,
    }),
    r,
    1,
    i,
  );
  mixInto(t, pitchDropTone(i, 0.12, 130, 55, 0.02, 0.035), r, 0.8, i);
  mixInto(
    t,
    modalRing(
      i,
      0.4,
      [
        [705, 0.07, 1],
        [1490, 0.05, 0.7],
        [2610, 0.035, 0.5],
        [4020, 0.02, 0.3],
      ],
      e,
    ),
    r,
    0.28,
    i,
  );
  mixInto(
    t,
    crackles(i, e, 0.7, 26, {
      from: 0.02,
      fall: 1.7,
      hp: 1500,
      ampFall: 0.2,
      maxLen: 0.008,
    }),
    r,
    0.5,
    i,
  );
  mixInto(
    t,
    modalRing(
      i,
      0.2,
      [
        [1900, 0.03, 1],
        [3350, 0.02, 0.6],
      ],
      e,
    ),
    r + 0.19,
    0.14,
    i,
  );
  return saturateTanh(t, 1.4);
}
export function genHoundDie(i: number, e: (() => number) | undefined) {
  let t = buffer(i, 1.9),
    n = 0,
    s = 0,
    o = buffer(i, 1.3);
  for (let r = 0; r < o.length; r++) {
    let a = r / i,
      l = 30 + 112 * Math.pow(1 - a / 1.3, 1.6);
    n += l / i;
    s += (180 + 1050 * Math.exp(-a / 0.3)) / i;
    o[r] =
      (2 * (n - Math.floor(n)) - 1) *
        (1 - Math.exp(-a / 0.02)) *
        Math.pow(1 - a / 1.3, 0.7) +
      Math.sin(TAU * s) * 0.25 * Math.exp(-a / 0.4);
  }
  sweepFilter(o, "lp", expSweep(1100, 160), 2.5, i);
  mixInto(t, o, 0, 0.55, i);
  mixInto(
    t,
    noiseBurst(i, e, 0.03, 0.006, {
      hp: 2e3,
    }),
    0,
    0.5,
    i,
  );
  for (let [r, a, l] of [
    [0.62, 1, 1],
    [0.84, 0.75, 1.22],
    [0.98, 0.5, 0.86],
    [1.17, 0.42, 1.4],
    [1.33, 0.22, 1.1],
  ]) {
    mixInto(t, pitchDropTone(i, 0.1, 105 * l, 48, 0.02, 0.035), r, a * 0.9, i);
    mixInto(
      t,
      noiseBurst(i, e, 0.08, 0.016, {
        lp: 2400,
      }),
      r,
      a * 0.8,
      i,
    );
    mixInto(
      t,
      modalRing(
        i,
        0.3,
        [
          [388 * l, 0.07, 1],
          [861 * l, 0.05, 0.7],
          [1540 * l, 0.035, 0.5],
          [2750 * l, 0.02, 0.35],
        ],
        e,
      ),
      r,
      a * 0.3,
      i,
    );
  }
  mixInto(
    t,
    crackles(i, e, 1, 22, {
      from: 0,
      fall: 1.2,
      hp: 1800,
      ampFall: 0.4,
      maxLen: 0.007,
    }),
    0.62,
    0.3,
    i,
  );
  return saturateTanh(gain(t, 0.55), 1.5);
}
export function genAlert(i: number, e: () => number, t: any) {
  let n = buffer(i, 0.52),
    s = t ? 622 : 1320,
    o = s * 1.4142,
    r = 0,
    a = (l: number, c: number, u: number, h: number) => {
      let f = Math.round(c * i),
        p = Math.round(l * i);
      for (let d = 0; d < f; d++) {
        let v = d / f,
          g = d / i;
        r += (TAU * u * (1 + h * v)) / i;
        let x = Math.sin(
          r + 1.6 * Math.sin(r * 0.25) + 0.4 * Math.sin(TAU * 71 * g),
        );
        n[p + d] +=
          Math.tanh(x * 2.2) *
          Math.min(1, d / (0.004 * i), (f - d) / (0.012 * i));
      }
    };
  a(0, 0.09, s, 0);
  a(0.12, 0.17, o, -0.05);
  if (t) {
    a(0.3, 0.2, s * 0.5, 0.5);
  }
  biquad(n, "bp", t ? 1100 : 2100, 0.6, i);
  mixInto(
    n,
    noiseBurst(i, e, 0.4, 0.2, {
      hp: 4e3,
      att: 0.02,
    }),
    0,
    0.03,
    i,
  );
  return n;
}
export function genTelegraph(i: number, e: (() => number) | undefined, t: any) {
  let n = buffer(i, 0.6),
    s = n.length,
    o = 0.55,
    r = 0,
    a = 0;
  for (let c = 0; c < s; c++) {
    let u = c / i,
      h = Math.min(1, u / o),
      f = Math.pow(h, 1.4) * (u < o ? 1 : Math.exp(-(u - o) / 0.008));
    if (t) {
      r += (170 + 380 * h * h) / i;
      a += (680 + 900 * h) / i;
      let p = 2 * (r - Math.floor(r)) - 1;
      n[c] =
        (p * (0.7 + 0.3 * Math.sin(TAU * 38 * u)) + 0.35 * Math.sin(TAU * a)) *
        f;
    } else {
      r += (620 + 1900 * h * h * h) / i;
      a += ((1240 + 3800 * h * h * h) * 1.003) / i;
      n[c] =
        (Math.sin(TAU * r) +
          0.4 * Math.sin(TAU * a) +
          0.25 * Math.sign(Math.sin(TAU * r * 0.5))) *
        f *
        (0.8 + 0.2 * Math.sin(TAU * (20 + 60 * h) * u));
    }
  }
  biquad(n, "lp", t ? 2600 : 7e3, 0.7, i);
  biquad(n, "hp", t ? 120 : 400, 0.7, i);
  let l = t ? 7 : 5;
  for (let c = 0; c < l; c++) {
    let u = o * Math.sqrt(c / l);
    mixInto(
      n,
      modalRing(
        i,
        0.03,
        [
          [t ? 1500 : 3800, 0.004, 1],
          [t ? 2600 : 6100, 0.003, 0.6],
        ],
        e,
      ),
      u,
      0.12 + (0.2 * c) / l,
      i,
    );
  }
  return n;
}
export function genExplosion(i: number, e: (() => number) | undefined, t: any) {
  let n = buffer(i, 3),
    s = t ? 0.9 : 1;
  mixInto(
    n,
    noiseBurst(i, e, 0.03, 0.006, {
      hp: 1500,
    }),
    0,
    1.8,
    i,
  );
  mixInto(n, pitchDropTone(i, 1.6, 96 * s, 27, 0.16, 0.36, 0.001), 0, 0.85, i);
  let o = noiseBuffer(i, 1.6, e);
  sweepFilter(o, "lp", expSweep(2800, 260, 0.5), 0.7, i);
  mixInto(n, applyEnvelope(o, i, expEnvelope(0.26, 0.002)), 0, 3.2, i);
  let r = noiseBuffer(i, 2.6, e);
  biquad(r, "lp", 120, 0.7, i);
  mixInto(n, applyEnvelope(r, i, expEnvelope(0.7, 0.03)), 0, 2.2, i);
  mixInto(
    n,
    noiseBurst(i, e, 0.5, 0.09, {
      bp: 520 * s,
      q: 1.2,
    }),
    0,
    1.3,
    i,
  );
  mixInto(
    n,
    crackles(i, e, 2.5, 120, {
      from: 0.25,
      fall: 1.5,
      hp: 1500,
      lp: 9e3,
      ampFall: 0.8,
      maxLen: 0.01,
    }),
    0,
    0.5,
    i,
  );
  for (let a = 0; a < 7; a++) {
    let l = randRange(e, 900, 3600);
    mixInto(
      n,
      modalRing(
        i,
        0.2,
        [
          [l, randRange(e, 0.02, 0.06), 1],
          [l * 1.61, 0.02, 0.5],
        ],
        e,
      ),
      randRange(e, 0.4, 1.9),
      randRange(e, 0.03, 0.09),
      i,
    );
  }
  return saturateTanh(gain(n, 0.36), 1.7);
}
export function genRelayCut(i: number, e: () => number) {
  let t = buffer(i, 1.7);
  mixInto(
    t,
    noiseBurst(i, e, 0.01, 0.002, {
      hp: 2500,
    }),
    0,
    1,
    i,
  );
  let n = noiseBuffer(i, 0.5, e);
  biquad(n, "bp", 3e3, 0.8, i);
  let s = 1;
  for (let l = 0; l < n.length; l++) {
    let c = l / i;
    if (l % 220 === 0) {
      s = e() < 0.55 + 0.4 * (1 - c / 0.5) ? 1 : 0;
    }
    n[l] =
      (n[l] * (Math.sin(TAU * 100 * c) > -0.2 ? 1 : 0.15) +
        0.35 * Math.sign(Math.sin(TAU * 100 * c)) * (e() - 0.3)) *
      s *
      Math.exp(-c / 0.3);
  }
  mixInto(t, n, 0.005, 0.8, i);
  let o = buffer(i, 1.25),
    r = 0,
    a = 0;
  for (let l = 0; l < o.length; l++) {
    let c = l / i,
      u = Math.pow(0.22, c / 1.2);
    r += (TAU * 100 * u) / i;
    a += (TAU * (150 + 1900 * Math.pow(1 - c / 1.25, 2.2))) / i;
    o[l] =
      ((Math.sin(r) +
        0.6 * Math.sin(2 * r) +
        0.4 * Math.sin(3 * r) +
        0.25 * Math.sin(5 * r)) *
        0.5 +
        Math.sin(a) * 0.22) *
      Math.pow(1 - c / 1.25, 1.2) *
      (1 - Math.exp(-c / 0.03));
  }
  mixInto(t, o, 0.4, 0.8, i);
  mixInto(t, pitchDropTone(i, 0.12, 140, 60, 0.03, 0.04), 0.4, 0.5, i);
  return saturateTanh(t, 1.3);
}
export function* genThunder(i: number, e: () => number, t: any) {
  let n = buffer(i, 6.5),
    s = noiseBuffer(i, 6.4, e);
  yield;
  sweepFilter(s, "lp", expSweep(t ? 520 : 380, 70, 0.6), 0.7, i);
  yield;
  let o: any[] = [];
  for (let a = 0; a < 9; a++)
    o.push([
      randRange(e, 0.05, 3.6),
      randRange(e, 0.12, 0.5),
      randRange(e, 0.4, 1),
    ]);
  for (let a = 0; a < s.length; a++) {
    let l = a / i,
      c = 0;
    for (let [u, h, f] of o) {
      let p = (l - u) / h;
      c += f * Math.exp(-p * p);
    }
    s[a] *= (0.25 + c) * Math.exp(-l / 1.9) * (1 - Math.exp(-l / 0.05));
  }
  mixInto(n, s, 0, 1, i);
  yield;
  let r = noiseBuffer(i, 6, e);
  biquad(r, "bp", 48, 1.2, i);
  mixInto(n, applyEnvelope(r, i, expEnvelope(2, 0.2)), 0.05, 3, i);
  if (t) {
    mixInto(
      n,
      noiseBurst(i, e, 0.3, 0.06, {
        hp: 300,
        lp: 2500,
      }),
      0.02,
      0.25,
      i,
    );
  }
  return n;
}
const FOGHORN_HARMONICS = [0, 1, 0.435, 0.268, 0.19, 0.145, 0.116, 0.097];
export function genFoghorn(i: number, e: any) {
  let t = buffer(i, 5),
    n = t.length;
  for (let s = 0; s < n; s++) {
    let o = s / i,
      r = 0.0025 * Math.sin(TAU * 4.3 * o),
      a =
        Math.min(1, o / 0.45) *
        Math.min(1, (5 - o) / 1.5) *
        (o < 3.2 ? 1 : Math.exp(-(o - 3.2) / 0.7)),
      l = 0;
    for (let c = 1; c <= 7; c++)
      l += Math.sin(TAU * 92.5 * c * o * (1 + r) + c) * FOGHORN_HARMONICS[c];
    for (let c = 1; c <= 4; c++)
      l += 0.45 * Math.sin(TAU * 138.6 * c * o + c * 2) * FOGHORN_HARMONICS[c];
    t[s] = l * a;
  }
  biquad(t, "lp", 520, 0.7, i);
  return t;
}
export function genGullCry(i: number, e: () => number, t: any) {
  let n = buffer(i, 1.4),
    s = t ? 3 : 4,
    o = 0.02;
  for (let r = 0; r < s; r++) {
    let a = randRange(e, 0.17, 0.26) * (t ? 1.4 : 1),
      l = Math.round(a * i),
      c = Math.round(o * i),
      u = (t ? 1250 : 1550) * (1 - r * 0.04),
      h = 0;
    for (let f = 0; f < l && c + f < n.length; f++) {
      let p = f / l,
        d = u * (1 + 0.55 * Math.sin(Math.PI * Math.pow(p, 0.6)) - 0.25 * p);
      h += (TAU * d) / i;
      let v = 1 + 0.3 * Math.sin((TAU * 63 * f) / i);
      n[c + f] +=
        (Math.sin(h) +
          0.6 * Math.sin(2 * h + 0.5) +
          0.35 * Math.sin(3 * h) +
          0.15 * Math.sin(4 * h)) *
        v *
        Math.pow(Math.sin(Math.PI * p), 0.7) *
        (1 - r * 0.14);
    }
    o += a + randRange(e, 0.05, 0.12);
  }
  biquad(n, "lp", 4200, 0.7, i);
  return n;
}
export function genHalyard(i: number, e: (() => number) | undefined, t: any) {
  let n = buffer(i, 1.1),
    s = t ? 1.19 : 1,
    o = 0.01,
    r = t ? 3 : 4;
  for (let a = 0; a < r; a++) {
    mixInto(
      n,
      modalRing(
        i,
        0.5,
        [
          [2310 * s, randRange(e, 0.06, 0.13), 1],
          [3740 * s, 0.07, 0.7],
          [5910 * s, 0.04, 0.5],
          [8130 * s, 0.025, 0.3],
          [1012 * s, 0.03, 0.3],
        ],
        e,
      ),
      o,
      randRange(e, 0.35, 1),
      i,
    );
    mixInto(
      n,
      noiseBurst(i, e, 0.004, 0.001, {
        hp: 3e3,
      }),
      o,
      0.3,
      i,
    );
    o += randRange(e, 0.09, 0.26);
  }
  return n;
}
export function genContainerBang(i: number, e: (() => number) | undefined) {
  let t = buffer(i, 2.8),
    n = buffer(i, 2.2);
  mixInto(
    n,
    modalRing(
      i,
      2.2,
      [
        [47, 0.7, 1],
        [77, 0.55, 0.9],
        [121, 0.4, 0.7],
        [163, 0.3, 0.5],
        [214, 0.22, 0.4],
        [330, 0.12, 0.25],
      ],
      e,
    ),
    0,
    0.5,
    i,
  );
  mixInto(
    n,
    noiseBurst(i, e, 0.5, 0.11, {
      lp: 420,
    }),
    0,
    1,
    i,
  );
  mixInto(t, n, 0, 1, i);
  mixInto(t, n, 0.36, 0.3, i);
  mixInto(t, n, 0.61, 0.12, i);
  return t;
}
export function genUiClick(i: number, e: (() => number) | undefined) {
  let t = buffer(i, 0.09);
  mixInto(
    t,
    modalRing(
      i,
      0.08,
      [
        [1820, 0.009, 1],
        [2730, 0.007, 0.6],
        [640, 0.012, 0.5],
      ],
      e,
    ),
    0,
    1,
    i,
  );
  mixInto(
    t,
    noiseBurst(i, e, 0.004, 0.001, {
      hp: 2500,
    }),
    0,
    0.5,
    i,
  );
  return t;
}
export function genUiHover(i: number, e: (() => number) | undefined) {
  let t = buffer(i, 0.06);
  mixInto(
    t,
    modalRing(
      i,
      0.05,
      [
        [3200, 0.008, 1],
        [4800, 0.005, 0.3],
      ],
      e,
    ),
    0,
    1,
    i,
  );
  return t;
}
export function* genRain(i: number, e: () => number) {
  let n = function* (s: () => number) {
    let o = loopedNoise(i, 6, s, (u: any) => {
      biquad(u, "hp", 900, 0.6, i);
      biquad(u, "lp", 8500, 0.6, i);
    });
    yield;
    let r = loopedNoise(i, 6, s, (u: any) => {
        biquad(u, "bp", 420, 0.5, i);
      }),
      a = o.length,
      l = sumBuffers(a, [o, 0.5], [r, 0.75]),
      c = new Float32Array(a);
    for (let u = 0; u < 1020; u++) {
      let h = Math.floor(s() * a),
        f = Math.round(randRange(s, 6e-4, 0.003) * i),
        p = Math.pow(s(), 3) * 1.6 + 0.15;
      for (let d = 0; d < f; d++) {
        c[h] += (s() * 2 - 1) * p * Math.exp((-5 * d) / f);
        if (++h >= a) {
          h = 0;
        }
      }
    }
    yield;
    sweepFilter(c, "hp", () => 2200, 0.7, i, 2);
    yield;
    for (let u = 0; u < 30; u++) {
      let h = randRange(s, 700, 2100);
      mixWrap(
        c,
        chirp(i, randRange(s, 0.008, 0.02), h, h * 1.7),
        s() * 6,
        randRange(s, 0.08, 0.3),
        i,
      );
    }
    for (let u = 0; u < a; u++) l[u] += c[u] * 0.55;
    return l;
  };
  return [
    yield* n(audioRng(Math.floor(e() * 1e9))),
    yield* n(audioRng(Math.floor(e() * 1e9))),
  ];
}
export function* genRainInterior(i: number, e: () => number) {
  let n = function* (s: () => number) {
    let o = loopedNoise(i, 6, s, (c: any) => {
        biquad(c, "lp", 1300, 0.6, i);
        biquad(c, "hp", 110, 0.7, i);
      }),
      r = o.length,
      a = new Float32Array(r);
    for (let c = 0; c < 1560; c++)
      a[Math.floor(s() * r)] += (s() * 2 - 1) * (0.2 + Math.pow(s(), 4) * 3);
    let l = sumBuffers(r, [o, 0.8]);
    for (let [c, u, h] of [
      [1820, 14, 1],
      [2740, 16, 0.8],
      [4150, 18, 0.6],
      [6200, 14, 0.35],
      [940, 8, 0.7],
    ]) {
      let f = Float32Array.from(a);
      sweepFilter(f, "bp", () => c, u, i, 2);
      for (let p = 0; p < r; p++) l[p] += f[p] * h * 5;
      yield;
    }
    for (let c = 0; c < 4; c++) {
      let u = randRange(s, 900, 1600);
      mixWrap(l, chirp(i, 0.014, u, u * 1.8), s() * 6, 0.25, i);
    }
    return l;
  };
  return [
    yield* n(audioRng(Math.floor(e() * 1e9))),
    yield* n(audioRng(Math.floor(e() * 1e9))),
  ];
}
export function genWind(i: number, e: () => number) {
  let s = noiseBuffer(i, 8.5, e),
    o = Float32Array.from(s);
  sweepFilter(
    s,
    "bp",
    (r: number) => {
      let a = r * 8.5;
      return (
        380 +
        190 * Math.sin((TAU * a) / 8) +
        90 * Math.sin((TAU * a) / 2.667 + 1)
      );
    },
    1.3,
    i,
  );
  sweepFilter(
    o,
    "bp",
    (r: number) => {
      let a = r * 8.5;
      return 1350 + 260 * Math.sin((TAU * a) / 4 + 2);
    },
    9,
    i,
  );
  for (let r = 0; r < s.length; r++) {
    let a = r / i;
    s[r] =
      s[r] * (0.7 + 0.3 * Math.sin((TAU * a) / 8 + 0.5)) +
      o[r] * 0.22 * Math.pow(0.5 + 0.5 * Math.sin((TAU * a) / 4 + 1), 2);
  }
  return loopCrossfade(s, i * 8, true);
}
export function* genSea(i: number, e: () => number) {
  let s = noiseBuffer(i, 8.5, e),
    o = noiseBuffer(i, 8 + 0.5, e),
    r = noiseBuffer(i, 8 + 0.5, e);
  yield;
  biquad(s, "lp", 1100, 0.6, i);
  biquad(s, "hp", 70, 0.7, i);
  biquad(o, "hp", 2400, 0.7, i);
  biquad(r, "bp", 520, 1.2, i);
  yield;
  for (let a = 0; a < s.length; a++) {
    let l = a / i,
      c = (l % 4) / 4,
      u = Math.pow(0.5 - 0.5 * Math.cos(TAU * c), 1.5),
      h = Math.exp(-Math.pow((c - 0.5) / 0.05, 2)),
      f = Math.exp(-Math.pow((c - 0.68) / 0.16, 2)),
      p = 0.5 - 0.5 * Math.cos((TAU * ((l + 1.3) % 2.667)) / 2.667);
    s[a] = s[a] * (0.3 + 0.7 * u + 0.25 * p) + r[a] * h * 1.8 + o[a] * f * 0.35;
  }
  return loopCrossfade(s, i * 8, true);
}
