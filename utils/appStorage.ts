import { storage } from "wxt/utils/storage";
import { CurrencyCode } from "./enums";

export type PlanTier = "free" | "paid";

export type SubscriptionState = {
  token: string | null;
  isActive: boolean;
};

export type UserSettings = {
  preferredCurrency: CurrencyCode;
  planTier: PlanTier;
  subscription: SubscriptionState;
};

const SETTINGS_KEY = "local:user-settings";

const VALID_CURRENCY_CODES = new Set(Object.values(CurrencyCode));

const DEFAULT_USER_SETTINGS: UserSettings = {
  preferredCurrency: CurrencyCode["UNITED STATES DOLLAR"],
  planTier: "free",
  subscription: {
    token: null,
    isActive: false,
  },
};

const userSettingsItem = storage.defineItem<UserSettings>(SETTINGS_KEY, {
  fallback: DEFAULT_USER_SETTINGS,
});

function asPlanTier(value: unknown): PlanTier {
  return value === "paid" ? "paid" : "free";
}

function asCurrencyCode(value: unknown): CurrencyCode {
  if (typeof value !== "string") {
    return DEFAULT_USER_SETTINGS.preferredCurrency;
  }

  return VALID_CURRENCY_CODES.has(value as CurrencyCode)
    ? (value as CurrencyCode)
    : DEFAULT_USER_SETTINGS.preferredCurrency;
}

export function sanitizeUserSettings(value: Partial<UserSettings> | null): UserSettings {
  return {
    preferredCurrency: asCurrencyCode(value?.preferredCurrency),
    planTier: asPlanTier(value?.planTier),
    subscription: {
      token:
        typeof value?.subscription?.token === "string" &&
        value.subscription.token.trim().length > 0
          ? value.subscription.token.trim()
          : null,
      isActive: Boolean(value?.subscription?.isActive),
    },
  };
}

export async function getUserSettings(): Promise<UserSettings> {
  const stored = await userSettingsItem.getValue();
  const sanitized = sanitizeUserSettings(stored);

  // Heal old or malformed values when encountered.
  if (JSON.stringify(stored) !== JSON.stringify(sanitized)) {
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

  const next: UserSettings = sanitizeUserSettings({
    ...current,
    ...patch,
    subscription: {
      ...current.subscription,
      ...(patch.subscription || {}),
    },
  });

  await userSettingsItem.setValue(next);
  return next;
}

export function hasPaidAccess(settings: UserSettings): boolean {
  return (
    settings.planTier === "paid" &&
    settings.subscription.isActive &&
    Boolean(settings.subscription.token)
  );
}

export { DEFAULT_USER_SETTINGS };
