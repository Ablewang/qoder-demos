// User settings defaults, validation, and read-only legacy migration.
import type { QualityName } from "./quality";
import { PLAYER_DIMS } from "./world";

export type QualitySetting = "auto" | Exclude<QualityName, "test">;

export interface Settings {
  quality: QualitySetting;
  sens: number;
  invertY: boolean;
  volume: number;
  fov: number;
}

const SETTINGS_KEY = "saltline.settings.v1";
const DEFAULT_SETTINGS: Settings = {
  quality: "auto",
  sens: 1,
  invertY: false,
  volume: 0.8,
  fov: PLAYER_DIMS.fov,
};
export const QUALITY_LEVELS: Exclude<QualitySetting, "auto">[] = [
  "low",
  "medium",
  "high",
  "ultra",
];

export function normalizeSettings(value: unknown): Settings {
  const settings = { ...DEFAULT_SETTINGS };
  if (!value || typeof value !== "object") return settings;
  const saved = value as Record<string, unknown>;
  if (
    saved.quality === "auto" ||
    QUALITY_LEVELS.some((quality) => quality === saved.quality)
  ) {
    settings.quality = saved.quality as QualitySetting;
  }
  if (typeof saved.sens === "number" && Number.isFinite(saved.sens)) {
    settings.sens = Math.min(3, Math.max(0.2, saved.sens));
  }
  settings.invertY = !!saved.invertY;
  if (typeof saved.volume === "number" && Number.isFinite(saved.volume)) {
    settings.volume = Math.min(1, Math.max(0, saved.volume));
  }
  if (typeof saved.fov === "number" && Number.isFinite(saved.fov)) {
    settings.fov = Math.min(95, Math.max(60, saved.fov));
  }
  return settings;
}

export function loadLegacySettings(): Settings {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(SETTINGS_KEY) || "null",
    );
    return normalizeSettings(saved);
  } catch {
    return normalizeSettings(null);
  }
}
