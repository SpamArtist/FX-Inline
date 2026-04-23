import {
  DEFAULT_UI_SETTINGS,
  FONT_SCALE_LIMITS,
  FONT_WEIGHT_LIMITS,
  KNOWN_FONT_FAMILIES,
  SPACING_LIMITS,
} from "./constants.js";

function clampNumber(value, minimum, maximum, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  if (value < minimum) return minimum;
  if (value > maximum) return maximum;
  return value;
}

function sanitizeFontFamily(value, fallback) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();

  if (!KNOWN_FONT_FAMILIES.has(normalized)) {
    return fallback;
  }

  return normalized;
}

function sanitizeColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();

  // Restrict to conservative CSS color tokens only.
  if (!/^#[0-9a-f]{3,8}$/iu.test(normalized) &&
      !/^[a-z]+$/iu.test(normalized) &&
      !/^rgb(a)?\([\d\s,.%]+\)$/iu.test(normalized)) {
    return fallback;
  }

  return normalized;
}

export function sanitizeUiSettings(input, defaults = DEFAULT_UI_SETTINGS) {
  const candidate = input && typeof input === "object" ? input : {};

  return {
    fontScalePct: clampNumber(
      candidate.fontScalePct,
      FONT_SCALE_LIMITS.min,
      FONT_SCALE_LIMITS.max,
      defaults.fontScalePct,
    ),
    fontWeight: clampNumber(
      candidate.fontWeight,
      FONT_WEIGHT_LIMITS.min,
      FONT_WEIGHT_LIMITS.max,
      defaults.fontWeight,
    ),
    fontFamily: sanitizeFontFamily(candidate.fontFamily, defaults.fontFamily),
    fontColor: sanitizeColor(candidate.fontColor, defaults.fontColor),
    spacingEm: clampNumber(
      candidate.spacingEm,
      SPACING_LIMITS.min,
      SPACING_LIMITS.max,
      defaults.spacingEm,
    ),
  };
}

export function mergeUiSettings({
  defaults = DEFAULT_UI_SETTINGS,
  manifestDefaults,
  remoteSettings,
  runtimeOverrides,
}) {
  return sanitizeUiSettings(
    {
      ...defaults,
      ...manifestDefaults,
      ...remoteSettings,
      ...runtimeOverrides,
    },
    defaults,
  );
}
