import { storage } from "wxt/utils/storage";
import { DEFAULT_STARTING_CURRENCY } from "./constants";
import { CurrencyCode } from "./enums";
import type {
  LocalAutoConversionByOrigin,
  UserSettings,
} from "./appStorage.types";

const SETTINGS_KEY = "local:user-settings";

const VALID_CURRENCY_CODES: ReadonlySet<string> = new Set(
  Object.values(CurrencyCode),
);

const DEFAULT_USER_SETTINGS: UserSettings = {
  preferredCurrency: DEFAULT_STARTING_CURRENCY,
  globalAutoConversionEnabled: true,
  localAutoConversionByOrigin: {},
};

const userSettingsItem = storage.defineItem<UserSettings>(SETTINGS_KEY, {
  fallback: DEFAULT_USER_SETTINGS,
});

function asCurrencyCode(value: string | null | undefined): CurrencyCode {
  return typeof value === "string" && VALID_CURRENCY_CODES.has(value)
    ? (value as CurrencyCode)
    : DEFAULT_USER_SETTINGS.preferredCurrency;
}

function asGlobalAutoConversionEnabled(value: unknown): boolean {
  return typeof value === "boolean"
    ? value
    : DEFAULT_USER_SETTINGS.globalAutoConversionEnabled;
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
    return { ...DEFAULT_USER_SETTINGS.localAutoConversionByOrigin };
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

function hasCanonicalUserSettingsShape(value: UserSettings): boolean {
  return (
    Object.keys(value).length === 3 &&
    Object.prototype.hasOwnProperty.call(value, "preferredCurrency") &&
    Object.prototype.hasOwnProperty.call(value, "globalAutoConversionEnabled") &&
    Object.prototype.hasOwnProperty.call(value, "localAutoConversionByOrigin")
  );
}

export function sanitizeUserSettings(value: Partial<UserSettings> | null): UserSettings {
  return {
    preferredCurrency: asCurrencyCode(value?.preferredCurrency),
    globalAutoConversionEnabled: asGlobalAutoConversionEnabled(
      value?.globalAutoConversionEnabled,
    ),
    localAutoConversionByOrigin: asLocalAutoConversionByOrigin(
      value?.localAutoConversionByOrigin,
    ),
  };
}

function hasSameLocalAutoConversionSettings(
  first: LocalAutoConversionByOrigin,
  second: LocalAutoConversionByOrigin,
): boolean {
  const firstKeys = Object.keys(first);
  if (firstKeys.length !== Object.keys(second).length) return false;

  for (const key of firstKeys) {
    if (first[key] !== second[key]) return false;
  }

  return true;
}

async function persistSanitizedUserSettings(
  value: Partial<UserSettings>,
): Promise<UserSettings> {
  const sanitized = sanitizeUserSettings(value);
  await userSettingsItem.setValue(sanitized);
  return sanitized;
}

export async function getUserSettings(): Promise<UserSettings> {
  const stored = await userSettingsItem.getValue();
  const sanitized = sanitizeUserSettings(stored);

  if (
    stored.preferredCurrency !== sanitized.preferredCurrency ||
    stored.globalAutoConversionEnabled !== sanitized.globalAutoConversionEnabled ||
    !hasSameLocalAutoConversionSettings(
      stored.localAutoConversionByOrigin,
      sanitized.localAutoConversionByOrigin,
    ) ||
    !hasCanonicalUserSettingsShape(stored)
  ) {
    await userSettingsItem.setValue(sanitized);
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
  if (settings.globalAutoConversionEnabled === false) return false;
  if (!origin) return true;
  return isLocalAutoConversionEnabledForOrigin(settings, origin);
}

export function isLocalAutoConversionEnabledForOrigin(
  settings: UserSettings,
  origin: string | null,
): boolean {
  if (!origin) return false;

  return settings.localAutoConversionByOrigin[origin] !== false;
}

export { DEFAULT_USER_SETTINGS, SETTINGS_KEY };
