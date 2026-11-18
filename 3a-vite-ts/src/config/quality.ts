// Quality presets and automatic device-based quality detection.

export type QualityName = "test" | "low" | "medium" | "high" | "ultra";

export interface QualityPreset {
  name: QualityName;
  /** Render resolution multiplier. */
  scale: number;
  msaa: number;
  shadow: number;
  tex: number;
  volSteps: number;
  ao: boolean;
  planar: number;
  bloom: boolean;
  motionBlur: boolean;
  rain: number;
}

export const QUALITY_PRESETS: Record<QualityName, QualityPreset> = {
  test: {
    name: "test",
    scale: 1,
    msaa: 0,
    shadow: 1024,
    tex: 256,
    volSteps: 10,
    ao: true,
    planar: 0.5,
    bloom: true,
    motionBlur: false,
    rain: 0.4,
  },
  low: {
    name: "low",
    scale: 0.7,
    msaa: 0,
    shadow: 2048,
    tex: 512,
    volSteps: 12,
    ao: false,
    planar: 0,
    bloom: true,
    motionBlur: false,
    rain: 0.5,
  },
  medium: {
    name: "medium",
    scale: 0.85,
    msaa: 2,
    shadow: 2048,
    tex: 1024,
    volSteps: 16,
    ao: true,
    planar: 0.5,
    bloom: true,
    motionBlur: false,
    rain: 0.8,
  },
  high: {
    name: "high",
    scale: 1,
    msaa: 4,
    shadow: 4096,
    tex: 1024,
    volSteps: 24,
    ao: true,
    planar: 0.5,
    bloom: true,
    motionBlur: true,
    rain: 1,
  },
  ultra: {
    name: "ultra",
    scale: 1,
    msaa: 4,
    shadow: 4096,
    tex: 2048,
    volSteps: 40,
    ao: true,
    planar: 1,
    bloom: true,
    motionBlur: true,
    rain: 1,
  },
};
export function detectQuality(requested?: string): QualityPreset {
  if (requested && QUALITY_PRESETS[requested as QualityName]) {
    return {
      ...QUALITY_PRESETS[requested as QualityName],
    };
  }
  if (
    /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 &&
      Math.min(screen.width, screen.height) < 900)
  ) {
    return {
      ...QUALITY_PRESETS.low,
    };
  }
  let t = "";
  try {
    let s = document.createElement("canvas"),
      o = s.getContext("webgl2") || s.getContext("webgl");
    if (o) {
      let r = o.getExtension("WEBGL_debug_renderer_info");
      t = String(
        r
          ? o.getParameter(r.UNMASKED_RENDERER_WEBGL)
          : o.getParameter(o.RENDERER),
      );
      let a = o.getExtension("WEBGL_lose_context");
      if (a) {
        a.loseContext();
      }
    }
  } catch {}
  return {
    ...(/SwiftShader|llvmpipe|Software|Mali|Adreno|PowerVR/i.test(t) ||
    (/Intel/i.test(t) && !/Arc/i.test(t))
      ? QUALITY_PRESETS.medium
      : QUALITY_PRESETS.high),
  };
}
