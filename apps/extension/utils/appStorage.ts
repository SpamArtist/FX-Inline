import {
  AuthPayload,
  EntitlementPayload,
  EntitlementStatus,
  PlanTier,
} from "@/packages/shared/contracts";
import { storage } from "wxt/utils/storage";
import { CurrencyCode } from "./enums";
import { AUTH_FEATURES_ENABLED, PAID_FEATURES_ENABLED } from "./featureFlags";

export type AuthSession = {
  email: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: number | null;
  refreshTokenExpiresAt: number | null;
};

export type EntitlementState = {
  status: EntitlementStatus;
  planTier: PlanTier;
  checkedAt: number | null;
  trialEndsAt: number | null;
  currentPeriodEnd: number | null;
  dailyLimit: number;
  remainingToday: number | null;
};

type LegacySubscriptionState = {
  token?: string | null;
  isActive?: boolean;
};

export type UserSettings = {
  preferredCurrency: CurrencyCode;
  auth: AuthSession;
  entitlement: EntitlementState;
};

const SETTINGS_KEY = "local:user-settings";

const VALID_CURRENCY_CODES = new Set(Object.values(CurrencyCode));

const DEFAULT_USER_SETTINGS: UserSettings = {
  preferredCurrency: CurrencyCode["UNITED STATES DOLLAR"],
  auth: {
    email: null,
    accessToken: null,
    refreshToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
  },
  entitlement: {
    status: "free",
    planTier: "free",
    checkedAt: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
    dailyLimit: 300,
    remainingToday: null,
  },
};

const userSettingsItem = storage.defineItem<UserSettings>(SETTINGS_KEY, {
  fallback: DEFAULT_USER_SETTINGS,
});

function areAuthSessionsEqual(a: AuthSession, b: AuthSession): boolean {
  return (
    a.email === b.email &&
    a.accessToken === b.accessToken &&
    a.refreshToken === b.refreshToken &&
    a.accessTokenExpiresAt === b.accessTokenExpiresAt &&
    a.refreshTokenExpiresAt === b.refreshTokenExpiresAt
  );
}

function areEntitlementsEqual(a: EntitlementState, b: EntitlementState): boolean {
  return (
    a.status === b.status &&
    a.planTier === b.planTier &&
    a.checkedAt === b.checkedAt &&
    a.trialEndsAt === b.trialEndsAt &&
    a.currentPeriodEnd === b.currentPeriodEnd &&
    a.dailyLimit === b.dailyLimit &&
    a.remainingToday === b.remainingToday
  );
}

function areUserSettingsEqual(a: UserSettings, b: UserSettings): boolean {
  return (
    a.preferredCurrency === b.preferredCurrency &&
    areAuthSessionsEqual(a.auth, b.auth) &&
    areEntitlementsEqual(a.entitlement, b.entitlement)
  );
}

function asCurrencyCode(value: unknown): CurrencyCode {
  if (typeof value !== "string") {
    return DEFAULT_USER_SETTINGS.preferredCurrency;
  }

  return VALID_CURRENCY_CODES.has(value as CurrencyCode)
    ? (value as CurrencyCode)
    : DEFAULT_USER_SETTINGS.preferredCurrency;
}

function asPlanTier(value: unknown): PlanTier {
  return value === "paid" ? "paid" : "free";
}

function asEntitlementStatus(
  value: unknown,
  legacyPaidActive: boolean,
): EntitlementStatus {
  if (value === "paid" || value === "trial" || value === "canceled") {
    return value;
  }

  if (legacyPaidActive) {
    return "paid";
  }

  return "free";
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sanitizeAuth(value: Partial<AuthSession> | null | undefined): AuthSession {
  if (!AUTH_FEATURES_ENABLED) {
    return DEFAULT_USER_SETTINGS.auth;
  }

  return {
    email:
      typeof value?.email === "string" && value.email.trim().length > 0
        ? value.email.trim().toLowerCase()
        : null,
    accessToken:
      typeof value?.accessToken === "string" && value.accessToken.trim().length > 0
        ? value.accessToken.trim()
        : null,
    refreshToken:
      typeof value?.refreshToken === "string" && value.refreshToken.trim().length > 0
        ? value.refreshToken.trim()
        : null,
    accessTokenExpiresAt: asNullableNumber(value?.accessTokenExpiresAt),
    refreshTokenExpiresAt: asNullableNumber(value?.refreshTokenExpiresAt),
  };
}

function sanitizeEntitlement(
  value: Partial<EntitlementState> | null | undefined,
  legacyPaidActive: boolean,
): EntitlementState {
  if (!PAID_FEATURES_ENABLED) {
    return {
      ...DEFAULT_USER_SETTINGS.entitlement,
      dailyLimit:
        typeof value?.dailyLimit === "number" && value.dailyLimit > 0
          ? Math.floor(value.dailyLimit)
          : DEFAULT_USER_SETTINGS.entitlement.dailyLimit,
      remainingToday:
        typeof value?.remainingToday === "number" && Number.isFinite(value.remainingToday)
          ? Math.max(0, Math.floor(value.remainingToday))
          : null,
      checkedAt: asNullableNumber(value?.checkedAt),
    };
  }

  const status = asEntitlementStatus(value?.status, legacyPaidActive);
  const planTier =
    status === "paid" || status === "trial"
      ? "paid"
      : asPlanTier(value?.planTier);

  const dailyLimitCandidate =
    typeof value?.dailyLimit === "number" && value.dailyLimit > 0
      ? Math.floor(value.dailyLimit)
      : DEFAULT_USER_SETTINGS.entitlement.dailyLimit;

  const remainingTodayCandidate =
    typeof value?.remainingToday === "number" && Number.isFinite(value.remainingToday)
      ? Math.max(0, Math.floor(value.remainingToday))
      : null;

  return {
    status,
    planTier,
    checkedAt: asNullableNumber(value?.checkedAt),
    trialEndsAt: asNullableNumber(value?.trialEndsAt),
    currentPeriodEnd: asNullableNumber(value?.currentPeriodEnd),
    dailyLimit: dailyLimitCandidate,
    remainingToday: remainingTodayCandidate,
  };
}

export function sanitizeUserSettings(value: Partial<UserSettings> | null): UserSettings {
  const source = (value || {}) as Partial<UserSettings> & {
    planTier?: unknown;
    subscription?: LegacySubscriptionState;
  };

  const legacyPaidActive =
    source.planTier === "paid" &&
    Boolean(source.subscription?.isActive) &&
    Boolean(source.subscription?.token);

  return {
    preferredCurrency: asCurrencyCode(source.preferredCurrency),
    auth: sanitizeAuth(source.auth),
    entitlement: sanitizeEntitlement(source.entitlement, legacyPaidActive),
  };
}

export async function getUserSettings(): Promise<UserSettings> {
  const stored = await userSettingsItem.getValue();
  const sanitized = sanitizeUserSettings(stored);

  if (!areUserSettingsEqual(stored, sanitized)) {
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
    auth: {
      ...current.auth,
      ...(patch.auth || {}),
    },
    entitlement: {
      ...current.entitlement,
      ...(patch.entitlement || {}),
    },
  });

  await userSettingsItem.setValue(next);
  return next;
}

export function hasAuthSession(settings: UserSettings): boolean {
  if (!AUTH_FEATURES_ENABLED) return false;

  return Boolean(settings.auth.accessToken && settings.auth.refreshToken);
}

export function hasPaidAccess(settings: UserSettings): boolean {
  if (!PAID_FEATURES_ENABLED) return false;

  return (
    settings.entitlement.status === "paid" || settings.entitlement.status === "trial"
  );
}

export function isAccessTokenExpired(settings: UserSettings, skewMs = 30_000): boolean {
  if (!settings.auth.accessToken || !settings.auth.accessTokenExpiresAt) {
    return true;
  }

  return Date.now() + skewMs >= settings.auth.accessTokenExpiresAt;
}

export function applyAuthPayload(
  current: UserSettings,
  payload: AuthPayload,
  email: string,
): UserSettings {
  return sanitizeUserSettings({
    ...current,
    auth: {
      email,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      accessTokenExpiresAt: payload.accessTokenExpiresAt,
      refreshTokenExpiresAt: payload.refreshTokenExpiresAt,
    },
  });
}

export function applyEntitlementPayload(
  current: UserSettings,
  payload: EntitlementPayload,
): UserSettings {
  return sanitizeUserSettings({
    ...current,
    entitlement: {
      status: payload.status,
      planTier: payload.planTier,
      checkedAt: payload.checkedAt,
      trialEndsAt: payload.trialEndsAt,
      currentPeriodEnd: payload.currentPeriodEnd,
      dailyLimit: payload.dailyLimit,
      remainingToday: payload.remainingToday,
    },
  });
}

export async function clearAuthSession(): Promise<UserSettings> {
  const current = await getUserSettings();

  return setUserSettings(
    sanitizeUserSettings({
      ...current,
      auth: DEFAULT_USER_SETTINGS.auth,
      entitlement: DEFAULT_USER_SETTINGS.entitlement,
    }),
  );
}

export { DEFAULT_USER_SETTINGS, SETTINGS_KEY };
