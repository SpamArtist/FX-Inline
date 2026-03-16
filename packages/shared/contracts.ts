export type PlanTier = "free" | "paid";

export type EntitlementStatus = "free" | "paid" | "trial" | "canceled";

export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
};

export type EntitlementPayload = {
  status: EntitlementStatus;
  planTier: PlanTier;
  trialEndsAt: number | null;
  currentPeriodEnd: number | null;
  checkedAt: number;
  dailyLimit: number;
  remainingToday: number | null;
};

export type AuthResponsePayload = {
  user: {
    id: string;
    email: string;
  };
  auth: AuthPayload;
  entitlement: EntitlementPayload;
};

export type UsageResponsePayload = {
  limited: boolean;
  consumedToday: number;
  dailyLimit: number;
  remainingToday: number;
  entitlement: EntitlementPayload;
};
