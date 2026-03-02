export type PlanTier = "free" | "paid";

export type EntitlementStatus = "free" | "paid" | "trial" | "canceled";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
  stripeCustomerId: string | null;
};

export type RefreshSession = {
  tokenId: string;
  userId: string;
  issuedAt: number;
  expiresAt: number;
  revokedAt: number | null;
  replacedByTokenId: string | null;
};

export type EntitlementRecord = {
  userId: string;
  status: EntitlementStatus;
  planTier: PlanTier;
  trialEndsAt: number | null;
  currentPeriodEnd: number | null;
  canceledAt: number | null;
  updatedAt: number;
  source: "system" | "stripe";
};

export type RateSnapshot = {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
  marketDayKey: string | null;
  source: string;
};

export type ProviderHealthRecord = {
  provider: string;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  failureCount: number;
  lastError: string | null;
};

export type AlertRecord = {
  id: string;
  level: "info" | "warning" | "critical";
  code: string;
  message: string;
  createdAt: number;
  resolvedAt: number | null;
};

export type UsageCounter = {
  userId: string;
  dayKey: string;
  inlineConversions: number;
  selectionConversions: number;
  updatedAt: number;
};

export type WebhookEventRecord = {
  id: string;
  type: string;
  receivedAt: number;
  processedAt: number | null;
  status: "received" | "processed" | "failed";
  error: string | null;
};

export type DatabaseState = {
  users: UserRecord[];
  refreshSessions: RefreshSession[];
  entitlements: EntitlementRecord[];
  usageCounters: UsageCounter[];
  rateCaches: {
    free: RateSnapshot | null;
    paid: RateSnapshot | null;
  };
  providerHealth: ProviderHealthRecord[];
  alerts: AlertRecord[];
  webhookEvents: WebhookEventRecord[];
};

export type AccessTokenPayload = {
  sub: string;
  email: string;
  typ: "access";
  jti: string;
  iat: number;
  exp: number;
};

export type RefreshTokenPayload = {
  sub: string;
  email: string;
  typ: "refresh";
  jti: string;
  iat: number;
  exp: number;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
};

export type EntitlementView = {
  status: EntitlementStatus;
  planTier: PlanTier;
  trialEndsAt: number | null;
  currentPeriodEnd: number | null;
  checkedAt: number;
  dailyLimit: number;
  remainingToday: number | null;
};

export type AuthedUser = {
  id: string;
  email: string;
};
