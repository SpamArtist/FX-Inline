import type { UiSettings, UiSettingsInput } from "../types.js";

const FONT_FAMILY_ALLOWLIST = new Set([
  "inherit",
  "Inter, sans-serif",
  "ui-sans-serif, system-ui, sans-serif",
  "Arial, sans-serif",
  "Georgia, serif",
  "'IBM Plex Sans', sans-serif",
]);

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  if (value < minimum) return minimum;
  if (value > maximum) return maximum;
  return value;
}

function sanitizeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();

  if (!normalized.length) return fallback;

  if (
    /^#[0-9a-f]{3,8}$/iu.test(normalized) ||
    /^[a-z]+$/iu.test(normalized) ||
    /^rgb(a)?\([\d\s,.%]+\)$/iu.test(normalized)
  ) {
    return normalized;
  }

  return fallback;
}

function sanitizeFontFamily(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  if (!FONT_FAMILY_ALLOWLIST.has(normalized)) {
    return fallback;
  }

  return normalized;
}

export const DEFAULT_UI_SETTINGS: UiSettings = {
  fontScalePct: 90,
  fontWeight: 600,
  fontFamily: "inherit",
  fontColor: "#355aa8",
  spacingEm: 0.1,
};

export function sanitizeUiSettings(input: UiSettingsInput): UiSettings {
  const payload = input && typeof input === "object" ? input : {};

  return {
    fontScalePct: clampNumber(payload.fontScalePct, 60, 200, DEFAULT_UI_SETTINGS.fontScalePct),
    fontWeight: clampNumber(payload.fontWeight, 300, 800, DEFAULT_UI_SETTINGS.fontWeight),
    fontFamily: sanitizeFontFamily(payload.fontFamily, DEFAULT_UI_SETTINGS.fontFamily),
    fontColor: sanitizeColor(payload.fontColor, DEFAULT_UI_SETTINGS.fontColor),
    spacingEm: clampNumber(payload.spacingEm, 0, 0.5, DEFAULT_UI_SETTINGS.spacingEm),
  };
}
