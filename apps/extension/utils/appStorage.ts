import { GENERATED_INLINE_RUNTIME_SETTINGS_MANIFEST } from "../generated/inlineRuntimeSettingsManifest";
import { CurrencyCode } from "./enums";
import type {
  LegacyUserSettings,
  LocalAutoConversionByOrigin,
  UserSettings,
} from "./appStorage.types";
import {
  cloneInlineRuntimeSettings,
  getPrimaryTargetCurrency,
  normalizeDomainScope,
  resolveInlineRuntimeSettingsForUrl,
  sanitizeInlineRuntimeSettingsManifest,
} from "./inlineRuntimeSettings";
import {
  readLocalStorageValue,
  writeLocalStorageValue,
} from "./localStorage";

const SETTINGS_KEY = "user-settings";

const VALID_CURRENCY_CODES: ReadonlySet<string> = new Set(
  Object.values(CurrencyCode),
);

const DEFAULT_USER_SETTINGS: UserSettings = sanitizeInlineRuntimeSettingsManifest(
  GENERATED_INLINE_RUNTIME_SETTINGS_MANIFEST,
);

function asCurrencyCode(value: unknown): CurrencyCode {
  return typeof value === "string" && VALID_CURRENCY_CODES.has(value)
    ? (value as CurrencyCode)
    : getPrimaryTargetCurrency(DEFAULT_USER_SETTINGS.scopes.allUrls);
}

function asGlobalAutoConversionEnabled(value: unknown): boolean {
  return typeof value === "boolean"
    ? value
    : DEFAULT_USER_SETTINGS.scopes.allUrls.enabled;
}

export function getOriginFromUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string" || !url.trim()) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

function asLocalAutoConversionByOrigin(value: unknown): LocalAutoConversionByOrigin {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const settingsByOrigin: LocalAutoConversionByOrigin = {};

  for (const [originKey, isEnabled] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const normalizedOrigin = getOriginFromUrl(originKey);
    if (!normalizedOrigin) continue;
    if (typeof isEnabled !== "boolean") continue;

    settingsByOrigin[normalizedOrigin] = isEnabled;
  }

  return settingsByOrigin;
}

function isLegacyUserSettings(value: unknown): value is Partial<LegacyUserSettings> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (
      Object.prototype.hasOwnProperty.call(value, "preferredCurrency") ||
      Object.prototype.hasOwnProperty.call(value, "globalAutoConversionEnabled") ||
      Object.prototype.hasOwnProperty.call(value, "localAutoConversionByOrigin")
    )
  );
}

function migrateLegacyUserSettings(value: Partial<LegacyUserSettings>): UserSettings {
  const preferredCurrency = asCurrencyCode(value.preferredCurrency);
  const globalAutoConversionEnabled = asGlobalAutoConversionEnabled(
    value.globalAutoConversionEnabled,
  );
  const localAutoConversionByOrigin = asLocalAutoConversionByOrigin(
    value.localAutoConversionByOrigin,
  );

  const allUrls = {
    ...cloneInlineRuntimeSettings(DEFAULT_USER_SETTINGS.scopes.allUrls),
    enabled: globalAutoConversionEnabled,
    targetCurrencies: [preferredCurrency],
  };
  const domains: UserSettings["scopes"]["domains"] = {};

  for (const [origin, isEnabled] of Object.entries(localAutoConversionByOrigin)) {
    const domain = normalizeDomainScope(origin);
    if (!domain) continue;

    if (isEnabled === allUrls.enabled) continue;

    domains[domain] = {
      ...cloneInlineRuntimeSettings(allUrls),
      domain,
      pageUrl: "",
      enabled: isEnabled,
    };
  }

  return {
    schemaVersion: 1,
    generatedAt: DEFAULT_USER_SETTINGS.generatedAt,
    scopes: {
      allUrls,
      domains,
      pages: {},
    },
  };
}

function serializeSettings(settings: UserSettings): string {
  return JSON.stringify(settings);
}

export function sanitizeUserSettings(value: unknown): UserSettings {
  if (isLegacyUserSettings(value)) {
    return sanitizeInlineRuntimeSettingsManifest(migrateLegacyUserSettings(value));
  }

  return sanitizeInlineRuntimeSettingsManifest(value, DEFAULT_USER_SETTINGS);
}

async function persistSanitizedUserSettings(value: unknown): Promise<UserSettings> {
  const sanitized = sanitizeUserSettings(value);
  await writeLocalStorageValue(SETTINGS_KEY, sanitized);
  return sanitized;
}

export async function getUserSettings(): Promise<UserSettings> {
  const stored = await readLocalStorageValue(SETTINGS_KEY, DEFAULT_USER_SETTINGS);
  const sanitized = sanitizeUserSettings(stored);

  if (serializeSettings(stored) !== serializeSettings(sanitized)) {
    await writeLocalStorageValue(SETTINGS_KEY, sanitized);
  }

  return sanitized;
}

export async function setUserSettings(settings: UserSettings): Promise<UserSettings> {
  return persistSanitizedUserSettings(settings);
}

export async function updateUserSettings(
  patch: Partial<UserSettings>,
): Promise<UserSettings> {
  return persistSanitizedUserSettings({
    ...(await getUserSettings()),
    ...patch,
  });
}

export function isAutoConversionEnabledForOrigin(
  settings: UserSettings,
  origin: string | null,
): boolean {
  return resolveInlineRuntimeSettingsForUrl(settings, origin).settings.enabled;
}

export function isLocalAutoConversionEnabledForOrigin(
  settings: UserSettings,
  origin: string | null,
): boolean {
  if (!origin) return false;
  return resolveInlineRuntimeSettingsForUrl(settings, origin).settings.enabled;
}

export { DEFAULT_USER_SETTINGS, SETTINGS_KEY };
