import { CurrencyCode } from "./enums";
import type {
  InlineConvertedCurrencyDisplayStyle,
  InlineConvertedCurrencyPosition,
  InlineRuntimeSettingKey,
  InlineRuntimeSettingRegistryEntry,
  InlineRuntimeSettings,
  InlineRuntimeSettingsManifest,
  ResolvedInlineRuntimeSettings,
} from "./inlineRuntimeSettings.types";
import type { JsonValue } from "./json.types";

export const INLINE_RUNTIME_SETTINGS_SCHEMA_VERSION = 1;
export const INLINE_RUNTIME_ALL_URLS_SCOPE_ID = "all_urls";

const DEFAULT_GENERATED_AT = "1970-01-01T00:00:00.000Z";
const DEFAULT_TARGET_CURRENCY = CurrencyCode.EURO;
const DEFAULT_CONVERTED_CURRENCY_POSITION: InlineConvertedCurrencyPosition = "right";
const DEFAULT_DISPLAY_STYLE: InlineConvertedCurrencyDisplayStyle = "brackets";
const DEFAULT_HIGHLIGHT_COLOR = "#fff1a8";
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;

const VALID_CURRENCY_CODES: ReadonlySet<string> = new Set(Object.values(CurrencyCode));
const VALID_POSITIONS: ReadonlySet<string> = new Set([
  "top",
  "bottom",
  "left",
  "right",
  "tooltip",
]);
const VALID_DISPLAY_STYLES: ReadonlySet<string> = new Set([
  "pill",
  "underline",
  "highlightColor",
  "brackets",
]);
const KNOWN_SETTING_KEYS: ReadonlySet<string> = new Set([
  "enabled",
  "domain",
  "pageUrl",
  "targetCurrencies",
  "convertedCurrencyPosition",
  "displayStyle",
  "highlightColor",
  "extraSettings",
]);
const LEGACY_IGNORED_SETTING_KEYS: ReadonlySet<string> = new Set([
  "baseCurrency",
]);

export const INLINE_RUNTIME_SETTING_REGISTRY: Record<
  InlineRuntimeSettingKey,
  InlineRuntimeSettingRegistryEntry
> = {
  enabled: {
    key: "enabled",
    label: "On/Off switch",
    runtimeSupported: true,
  },
  domain: {
    key: "domain",
    label: "Domain",
    runtimeSupported: true,
  },
  pageUrl: {
    key: "pageUrl",
    label: "Page URL",
    runtimeSupported: true,
  },
  targetCurrencies: {
    key: "targetCurrencies",
    label: "Target currency",
    runtimeSupported: true,
  },
  convertedCurrencyPosition: {
    key: "convertedCurrencyPosition",
    label: "Converted currency position",
    runtimeSupported: true,
  },
  displayStyle: {
    key: "displayStyle",
    label: "Display style",
    runtimeSupported: true,
  },
  highlightColor: {
    key: "highlightColor",
    label: "Highlight color",
    runtimeSupported: true,
  },
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
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

function asTargetCurrencies(value: unknown, fallback: CurrencyCode[]): CurrencyCode[] {
  const fallbackTarget = fallback[0] ?? DEFAULT_TARGET_CURRENCY;
  if (!Array.isArray(value)) return [fallbackTarget];

  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim().toUpperCase();
    if (VALID_CURRENCY_CODES.has(normalized)) {
      return [normalized as CurrencyCode];
    }
  }

  return [fallbackTarget];
}

function asPosition(
  value: unknown,
  fallback: InlineConvertedCurrencyPosition,
): InlineConvertedCurrencyPosition {
  return typeof value === "string" && VALID_POSITIONS.has(value)
    ? (value as InlineConvertedCurrencyPosition)
    : fallback;
}

function asDisplayStyle(
  value: unknown,
  fallback: InlineConvertedCurrencyDisplayStyle,
): InlineConvertedCurrencyDisplayStyle {
  return typeof value === "string" && VALID_DISPLAY_STYLES.has(value)
    ? (value as InlineConvertedCurrencyDisplayStyle)
    : fallback;
}

function asHexColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value)
    ? value.toLowerCase()
    : fallback;
}

export function normalizeDomainScope(value: string | null | undefined): string | null {
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

export function normalizePageScope(value: string | null | undefined): string | null {
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

export function getHostnameFromUrl(value: string | null | undefined): string | null {
  return normalizeDomainScope(value);
}

export function createDefaultInlineRuntimeSettings(
  overrides: Partial<InlineRuntimeSettings> = {},
): InlineRuntimeSettings {
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

export const DEFAULT_INLINE_RUNTIME_SETTINGS = createDefaultInlineRuntimeSettings();

export const DEFAULT_INLINE_RUNTIME_SETTINGS_MANIFEST: InlineRuntimeSettingsManifest = {
  schemaVersion: INLINE_RUNTIME_SETTINGS_SCHEMA_VERSION,
  generatedAt: DEFAULT_GENERATED_AT,
  scopes: {
    allUrls: DEFAULT_INLINE_RUNTIME_SETTINGS,
    domains: {},
    pages: {},
  },
};

function collectExtraSettings(value: unknown): Record<string, JsonValue> {
  if (!isObjectRecord(value)) return {};

  const extras: Record<string, JsonValue> = {};

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
  value: unknown,
  fallback: InlineRuntimeSettings = DEFAULT_INLINE_RUNTIME_SETTINGS,
): InlineRuntimeSettings {
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
  value: unknown,
  fallback: InlineRuntimeSettingsManifest = DEFAULT_INLINE_RUNTIME_SETTINGS_MANIFEST,
): InlineRuntimeSettingsManifest {
  const raw = isObjectRecord(value) ? value : {};
  const rawScopes = isObjectRecord(raw.scopes) ? raw.scopes : {};
  const fallbackAllUrls = fallback.scopes.allUrls;
  const allUrls = sanitizeInlineRuntimeSettings(rawScopes.allUrls, fallbackAllUrls);
  const domains: Record<string, InlineRuntimeSettings> = {};
  const pages: Record<string, InlineRuntimeSettings> = {};

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

export function resolveInlineRuntimeSettingsForUrl(
  manifest: InlineRuntimeSettingsManifest,
  pageUrl: string | null | undefined,
): ResolvedInlineRuntimeSettings {
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
    scopeType: "all_urls",
    scopeId: INLINE_RUNTIME_ALL_URLS_SCOPE_ID,
    settings: sanitized.scopes.allUrls,
    unsupportedSettingKeys: getUnsupportedRuntimeSettingKeys(sanitized.scopes.allUrls),
  };
}

export function getPrimaryTargetCurrency(
  settings: InlineRuntimeSettings,
): CurrencyCode {
  return settings.targetCurrencies[0] ?? DEFAULT_TARGET_CURRENCY;
}

export function getUnsupportedRuntimeSettingKeys(
  settings: InlineRuntimeSettings,
): string[] {
  return Object.keys(settings.extraSettings).sort();
}

export function cloneInlineRuntimeSettings(
  settings: InlineRuntimeSettings,
): InlineRuntimeSettings {
  return {
    ...settings,
    targetCurrencies: [...settings.targetCurrencies],
    extraSettings: {
      ...settings.extraSettings,
    },
  };
}
