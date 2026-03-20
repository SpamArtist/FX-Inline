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

function asCurrencyCode(value: string | null | undefined): CurrencyCode {
  return typeof value === "string" && VALID_CURRENCY_CODES.has(value)
    ? (value as CurrencyCode)
    : DEFAULT_USER_SETTINGS.preferredCurrency;
}

function hasCanonicalUserSettingsShape(value: UserSettings): boolean {
  return (
    Object.keys(value).length === 1 &&
    Object.prototype.hasOwnProperty.call(value, "preferredCurrency")
  );
}

export function sanitizeUserSettings(value: Partial<UserSettings> | null): UserSettings {
  return {
    preferredCurrency: asCurrencyCode(value?.preferredCurrency),
  };
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

export { DEFAULT_USER_SETTINGS, SETTINGS_KEY };
