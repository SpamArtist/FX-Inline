import currencyList from "../../../apps/extension/assets/currency.json" with { type: "json" };

export const INLINE_RUNTIME_SETTINGS_SCHEMA_VERSION = 1;
export const DEFAULT_GENERATED_AT = "1970-01-01T00:00:00.000Z";
export const DEFAULT_TARGET_CURRENCY = "EUR";
export const DEFAULT_POSITION = "right";
export const DEFAULT_DISPLAY_STYLE = "brackets";
export const DEFAULT_HIGHLIGHT_COLOR = "#fff1a8";
export const POSITION_OPTIONS = ["top", "bottom", "left", "right", "tooltip"];
export const DISPLAY_STYLE_OPTIONS = [
  { value: "pill", label: "Pill" },
  { value: "underline", label: "Underline" },
  { value: "highlightColor", label: "Highlight" },
  { value: "brackets", label: "Brackets" },
];
export const CURRENCY_OPTIONS = currencyList
  .map((currency) => ({
    code: currency.code,
    logo: currency.logo,
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;
const VALID_POSITIONS = new Set(POSITION_OPTIONS);
const VALID_DISPLAY_STYLES = new Set(DISPLAY_STYLE_OPTIONS.map((option) => option.value));
const VALID_CURRENCY_CODES = new Set(currencyList.map((entry) => entry.code));
VALID_CURRENCY_CODES.add(DEFAULT_TARGET_CURRENCY);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asTargetCurrencies(value, fallback) {
  const fallbackTarget = fallback[0] ?? DEFAULT_TARGET_CURRENCY;
  if (!Array.isArray(value)) return [fallbackTarget];

  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim().toUpperCase();
    if (VALID_CURRENCY_CODES.has(normalized)) {
      return [normalized];
    }
  }

  return [fallbackTarget];
}

function asHexColor(value, fallback) {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value)
    ? value.toLowerCase()
    : fallback;
}

export function normalizeDomainScope(value) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return parsed.hostname ? parsed.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function normalizePageScope(value) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function createDefaultInlineRuntimeSettings(overrides = {}) {
  return {
    enabled: overrides.enabled ?? true,
    domain: overrides.domain ?? "",
    pageUrl: overrides.pageUrl ?? "",
    targetCurrencies: asTargetCurrencies(
      overrides.targetCurrencies,
      [DEFAULT_TARGET_CURRENCY],
    ),
    convertedCurrencyPosition: overrides.convertedCurrencyPosition ?? DEFAULT_POSITION,
    displayStyle: overrides.displayStyle ?? DEFAULT_DISPLAY_STYLE,
    highlightColor: asHexColor(overrides.highlightColor, DEFAULT_HIGHLIGHT_COLOR),
    extraSettings: {
      ...(overrides.extraSettings ?? {}),
    },
  };
}

export function createDefaultInlineRuntimeSettingsManifest() {
  return {
    schemaVersion: INLINE_RUNTIME_SETTINGS_SCHEMA_VERSION,
    generatedAt: DEFAULT_GENERATED_AT,
    scopes: {
      allUrls: createDefaultInlineRuntimeSettings(),
      domains: {},
      pages: {},
    },
  };
}

function collectExtraSettings(value) {
  if (!isRecord(value.extraSettings)) return {};
  return JSON.parse(JSON.stringify(value.extraSettings));
}

export function sanitizeInlineRuntimeSettings(
  value,
  fallback = createDefaultInlineRuntimeSettings(),
) {
  const raw = isRecord(value) ? value : {};
  const fallbackTargets = fallback.targetCurrencies.length
    ? fallback.targetCurrencies
    : [DEFAULT_TARGET_CURRENCY];

  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : fallback.enabled,
    domain:
      typeof raw.domain === "string"
        ? normalizeDomainScope(raw.domain) ?? fallback.domain
        : fallback.domain,
    pageUrl:
      typeof raw.pageUrl === "string"
        ? normalizePageScope(raw.pageUrl) ?? fallback.pageUrl
        : fallback.pageUrl,
    targetCurrencies: asTargetCurrencies(raw.targetCurrencies, fallbackTargets),
    convertedCurrencyPosition:
      typeof raw.convertedCurrencyPosition === "string" &&
      VALID_POSITIONS.has(raw.convertedCurrencyPosition)
        ? raw.convertedCurrencyPosition
        : fallback.convertedCurrencyPosition,
    displayStyle:
      typeof raw.displayStyle === "string" && VALID_DISPLAY_STYLES.has(raw.displayStyle)
        ? raw.displayStyle
        : fallback.displayStyle,
    highlightColor: asHexColor(raw.highlightColor, fallback.highlightColor),
    extraSettings: collectExtraSettings(raw),
  };
}

export function sanitizeInlineRuntimeSettingsManifest(value) {
  const fallback = createDefaultInlineRuntimeSettingsManifest();
  const raw = isRecord(value) ? value : {};
  const rawScopes = isRecord(raw.scopes) ? raw.scopes : {};
  const allUrls = sanitizeInlineRuntimeSettings(rawScopes.allUrls, fallback.scopes.allUrls);
  const domains = {};
  const pages = {};

  if (isRecord(rawScopes.domains)) {
    for (const [domainKey, domainValue] of Object.entries(rawScopes.domains)) {
      const domain = normalizeDomainScope(domainKey);
      if (!domain) continue;
      domains[domain] = sanitizeInlineRuntimeSettings(domainValue, {
        ...allUrls,
        domain,
        pageUrl: "",
      });
    }
  }

  if (isRecord(rawScopes.pages)) {
    for (const [pageKey, pageValue] of Object.entries(rawScopes.pages)) {
      const pageUrl = normalizePageScope(pageKey);
      if (!pageUrl) continue;
      const hostname = new URL(pageUrl).hostname;
      pages[pageUrl] = sanitizeInlineRuntimeSettings(pageValue, {
        ...(domains[hostname] ?? allUrls),
        domain: hostname,
        pageUrl,
      });
    }
  }

  return {
    schemaVersion: INLINE_RUNTIME_SETTINGS_SCHEMA_VERSION,
    generatedAt:
      typeof raw.generatedAt === "string" && raw.generatedAt.trim()
        ? raw.generatedAt
        : new Date().toISOString(),
    scopes: {
      allUrls,
      domains,
      pages,
    },
  };
}

export function getDisplayStylePreview(displayStyle, targetCurrency) {
  const preview = `${targetCurrency} 90`;
  return displayStyle === "brackets" ? `(${preview})` : preview;
}
