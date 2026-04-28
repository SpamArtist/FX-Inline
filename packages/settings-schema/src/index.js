import { DEFAULT_ALLOWED_CURRENCY_CODES } from "@fx-inline/currency-detection/currency-codes";

export const INLINE_RUNTIME_SETTINGS_SCHEMA_VERSION = 1;
export const INLINE_RUNTIME_ALL_URLS_SCOPE_ID = "all_urls";

const DEFAULT_GENERATED_AT = "1970-01-01T00:00:00.000Z";
const DEFAULT_TARGET_CURRENCY = "EUR";
const DEFAULT_CONVERTED_CURRENCY_POSITION = "right";
const DEFAULT_DISPLAY_STYLE = "brackets";
const DEFAULT_HIGHLIGHT_COLOR = "#fff1a8";
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;

const VALID_CURRENCY_CODES = new Set(DEFAULT_ALLOWED_CURRENCY_CODES);
VALID_CURRENCY_CODES.add(DEFAULT_TARGET_CURRENCY);

export const DEFAULT_VALID_CURRENCY_CODES = new Set(VALID_CURRENCY_CODES);

const VALID_POSITIONS = new Set(["top", "bottom", "left", "right", "tooltip"]);
const VALID_DISPLAY_STYLES = new Set([
  "pill",
  "underline",
  "highlightColor",
  "brackets",
]);
const KNOWN_SETTING_KEYS = new Set([
  "enabled",
  "domain",
  "pageUrl",
  "targetCurrencies",
  "convertedCurrencyPosition",
  "displayStyle",
  "highlightColor",
  "extraSettings",
]);
const LEGACY_IGNORED_SETTING_KEYS = new Set(["baseCurrency"]);

function isObjectRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isJsonValue(value) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value !== "number" || Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (!isObjectRecord(value)) return false;
  return Object.values(value).every(isJsonValue);
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

function asPosition(value, fallback) {
  return typeof value === "string" && VALID_POSITIONS.has(value)
    ? value
    : fallback;
}

function asDisplayStyle(value, fallback) {
  return typeof value === "string" && VALID_DISPLAY_STYLES.has(value)
    ? value
    : fallback;
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
    if (!parsed.hostname) return null;
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function normalizePageScope(value) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getHostnameFromUrl(value) {
  return normalizeDomainScope(value);
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
    convertedCurrencyPosition:
      overrides.convertedCurrencyPosition ?? DEFAULT_CONVERTED_CURRENCY_POSITION,
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

export const DEFAULT_INLINE_RUNTIME_SETTINGS = createDefaultInlineRuntimeSettings();
export const DEFAULT_INLINE_RUNTIME_SETTINGS_MANIFEST =
  createDefaultInlineRuntimeSettingsManifest();

function collectExtraSettings(value) {
  if (!isObjectRecord(value)) return {};

  const extras = {};

  if (isObjectRecord(value.extraSettings)) {
    for (const [key, extraValue] of Object.entries(value.extraSettings)) {
      if (!KNOWN_SETTING_KEYS.has(key) && isJsonValue(extraValue)) {
        extras[key] = extraValue;
      }
    }
  }

  for (const [key, extraValue] of Object.entries(value)) {
    if (KNOWN_SETTING_KEYS.has(key)) continue;
    if (LEGACY_IGNORED_SETTING_KEYS.has(key)) continue;
    if (isJsonValue(extraValue)) {
      extras[key] = extraValue;
    }
  }

  return extras;
}

export function sanitizeInlineRuntimeSettings(
  value,
  fallback = DEFAULT_INLINE_RUNTIME_SETTINGS,
) {
  const raw = isObjectRecord(value) ? value : {};
  const fallbackTargets = fallback.targetCurrencies.length
    ? fallback.targetCurrencies
    : [DEFAULT_TARGET_CURRENCY];

  return {
    enabled:
      typeof raw.enabled === "boolean"
        ? raw.enabled
        : fallback.enabled,
    domain:
      typeof raw.domain === "string"
        ? normalizeDomainScope(raw.domain) ?? fallback.domain
        : fallback.domain,
    pageUrl:
      typeof raw.pageUrl === "string"
        ? normalizePageScope(raw.pageUrl) ?? fallback.pageUrl
        : fallback.pageUrl,
    targetCurrencies: asTargetCurrencies(raw.targetCurrencies, fallbackTargets),
    convertedCurrencyPosition: asPosition(
      raw.convertedCurrencyPosition,
      fallback.convertedCurrencyPosition,
    ),
    displayStyle: asDisplayStyle(raw.displayStyle, fallback.displayStyle),
    highlightColor: asHexColor(raw.highlightColor, fallback.highlightColor),
    extraSettings: collectExtraSettings(raw),
  };
}

export function sanitizeInlineRuntimeSettingsManifest(
  value,
  fallback = DEFAULT_INLINE_RUNTIME_SETTINGS_MANIFEST,
) {
  const raw = isObjectRecord(value) ? value : {};
  const rawScopes = isObjectRecord(raw.scopes) ? raw.scopes : {};
  const fallbackAllUrls = fallback.scopes.allUrls;
  const allUrls = sanitizeInlineRuntimeSettings(rawScopes.allUrls, fallbackAllUrls);
  const domains = {};
  const pages = {};

  if (isObjectRecord(rawScopes.domains)) {
    for (const [domainKey, domainValue] of Object.entries(rawScopes.domains)) {
      const normalizedDomain = normalizeDomainScope(domainKey);
      if (!normalizedDomain) continue;
      domains[normalizedDomain] = sanitizeInlineRuntimeSettings(domainValue, {
        ...allUrls,
        domain: normalizedDomain,
        pageUrl: "",
      });
    }
  }

  if (isObjectRecord(rawScopes.pages)) {
    for (const [pageKey, pageValue] of Object.entries(rawScopes.pages)) {
      const normalizedPage = normalizePageScope(pageKey);
      if (!normalizedPage) continue;
      const parsedPage = new URL(normalizedPage);
      const domainFallback = domains[parsedPage.hostname] ?? allUrls;
      pages[normalizedPage] = sanitizeInlineRuntimeSettings(pageValue, {
        ...domainFallback,
        domain: parsedPage.hostname,
        pageUrl: normalizedPage,
      });
    }
  }

  return {
    schemaVersion: INLINE_RUNTIME_SETTINGS_SCHEMA_VERSION,
    generatedAt:
      typeof raw.generatedAt === "string" && raw.generatedAt.trim()
        ? raw.generatedAt
        : fallback.generatedAt,
    scopes: {
      allUrls,
      domains,
      pages,
    },
  };
}

export function resolveInlineRuntimeSettingsForUrl(manifest, pageUrl) {
  const sanitized = sanitizeInlineRuntimeSettingsManifest(manifest);
  const normalizedPage = normalizePageScope(pageUrl);
  const hostname = getHostnameFromUrl(pageUrl);

  if (normalizedPage && sanitized.scopes.pages[normalizedPage]) {
    const settings = sanitized.scopes.pages[normalizedPage];
    return {
      scopeType: "page",
      scopeId: normalizedPage,
      settings,
      unsupportedSettingKeys: getUnsupportedRuntimeSettingKeys(settings),
    };
  }

  if (hostname && sanitized.scopes.domains[hostname]) {
    const settings = sanitized.scopes.domains[hostname];
    return {
      scopeType: "domain",
      scopeId: hostname,
      settings,
      unsupportedSettingKeys: getUnsupportedRuntimeSettingKeys(settings),
    };
  }

  return {
    scopeType: INLINE_RUNTIME_ALL_URLS_SCOPE_ID,
    scopeId: INLINE_RUNTIME_ALL_URLS_SCOPE_ID,
    settings: sanitized.scopes.allUrls,
    unsupportedSettingKeys: getUnsupportedRuntimeSettingKeys(sanitized.scopes.allUrls),
  };
}

export function getPrimaryTargetCurrency(settings) {
  return settings.targetCurrencies[0] ?? DEFAULT_TARGET_CURRENCY;
}

export function getUnsupportedRuntimeSettingKeys(settings) {
  return Object.keys(settings.extraSettings).sort();
}

export function cloneInlineRuntimeSettings(settings) {
  return {
    ...settings,
    targetCurrencies: [...settings.targetCurrencies],
    extraSettings: {
      ...settings.extraSettings,
    },
  };
}
