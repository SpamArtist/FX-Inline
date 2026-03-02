import path from "node:path";
import process from "node:process";

function asInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asString(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

export const config = {
  port: asInt(process.env.BACKEND_PORT, 8787),
  host: asString(process.env.BACKEND_HOST, "127.0.0.1"),
  publicBaseUrl: asString(process.env.BACKEND_PUBLIC_BASE_URL, "http://127.0.0.1:8787"),
  dbFile: asString(
    process.env.BACKEND_DB_FILE,
    path.resolve(process.cwd(), "backend/data/db.json"),
  ),
  accessTokenSecret: asString(
    process.env.ACCESS_TOKEN_SECRET,
    "dev-access-token-secret-change-me",
  ),
  refreshTokenSecret: asString(
    process.env.REFRESH_TOKEN_SECRET,
    "dev-refresh-token-secret-change-me",
  ),
  accessTokenTtlSeconds: asInt(process.env.ACCESS_TOKEN_TTL_SECONDS, 15 * 60),
  refreshTokenTtlSeconds: asInt(process.env.REFRESH_TOKEN_TTL_SECONDS, 30 * 24 * 60 * 60),
  trialPeriodDays: asInt(process.env.TRIAL_PERIOD_DAYS, 14),
  freeDailyLimit: asInt(process.env.FREE_DAILY_LIMIT, 300),
  paidDailyLimit: asInt(process.env.PAID_DAILY_LIMIT, 100000),
  ratePaidTtlMs: asInt(process.env.RATE_PAID_TTL_MS, 60_000),
  rateStaleAlertMs: asInt(process.env.RATE_STALE_ALERT_MS, 10 * 60 * 1000),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY?.trim() || null,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || null,
  stripePriceId: process.env.STRIPE_PRICE_ID?.trim() || null,
  adminApiKey: process.env.ADMIN_API_KEY?.trim() || null,
};
