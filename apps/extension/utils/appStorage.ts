import { storage } from "wxt/utils/storage";
import { DEFAULT_STARTING_CURRENCY } from "./constants";
import { CurrencyCode } from "./enums";
import type { UserSettings } from "./appStorage.types";

const SETTINGS_KEY = "local:user-settings";

const VALID_CURRENCY_CODES: ReadonlySet<string> = new Set(
  Object.values(CurrencyCode),
);

const DEFAULT_USER_SETTINGS: UserSettings = {
  preferredCurrency: DEFAULT_STARTING_CURRENCY,
};

const userSettingsItem = storage.defineItem<UserSettings>(SETTINGS_KEY, {
  fallback: DEFAULT_USER_SETTINGS,
});

function isCurrencyCode(value: string): value is CurrencyCode {
  return VALID_CURRENCY_CODES.has(value);
}

function asCurrencyCode(value: string | null | undefined): CurrencyCode {
  if (typeof value !== "string") {
    return DEFAULT_USER_SETTINGS.preferredCurrency;
  }

  if (!isCurrencyCode(value)) {
    return DEFAULT_USER_SETTINGS.preferredCurrency;
  }

  return value;
}

export function sanitizeUserSettings(value: Partial<UserSettings> | null): UserSettings {
  const source = value || {};

  return {
    preferredCurrency: asCurrencyCode(source.preferredCurrency),
  };
}

export async function getUserSettings(): Promise<UserSettings> {
  const stored = await userSettingsItem.getValue();
  const sanitized = sanitizeUserSettings(stored);
  const hasCanonicalShape =
    Object.keys(stored).length === 1 &&
    Object.prototype.hasOwnProperty.call(stored, "preferredCurrency");
  const shouldPersistSanitized =
    stored.preferredCurrency !== sanitized.preferredCurrency || !hasCanonicalShape;

  if (shouldPersistSanitized) {
    await userSettingsItem.setValue(sanitized);
  }

  return sanitized;
}

export async function setUserSettings(settings: UserSettings): Promise<UserSettings> {
  const sanitized = sanitizeUserSettings(settings);
  await userSettingsItem.setValue(sanitized);
  return sanitized;
}

export async function updateUserSettings(
  patch: Partial<UserSettings>,
): Promise<UserSettings> {
  const current = await getUserSettings();
  const next = sanitizeUserSettings({
    ...current,
    ...patch,
  });

  await userSettingsItem.setValue(next);
  return next;
}

export { DEFAULT_USER_SETTINGS, SETTINGS_KEY };
