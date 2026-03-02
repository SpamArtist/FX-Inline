import { config } from "./config.js";
import { mutateDb, readDb } from "./db.js";
import { getEntitlementView } from "./entitlements.js";
import { openAlert, resolveAlert } from "./alerts.js";
import { PlanTier, RateSnapshot } from "./types.js";

type ProviderCandidate = {
  name: string;
  url: string;
  parse: (payload: unknown) => Record<string, number>;
};

const PROVIDERS: ProviderCandidate[] = [
  {
    name: "er-api",
    url: "https://open.er-api.com/v6/latest/USD",
    parse: (payload) => {
      const data = payload as { result?: string; rates?: Record<string, number> };
      if (data.result !== "success" || !data.rates) {
        throw new Error("Invalid er-api payload");
      }
      return data.rates;
    },
  },
  {
    name: "exchange-rate-api",
    url: "https://api.exchangerate-api.com/v4/latest/USD",
    parse: (payload) => {
      const data = payload as { rates?: Record<string, number> };
      if (!data.rates) {
        throw new Error("Invalid exchange-rate-api payload");
      }
      return data.rates;
    },
  },
];

const MAJOR_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD"];

function getDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toEasternDate(now = new Date()): Date {
  return new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
}

function getPreviousBusinessDay(date: Date): Date {
  const cursor = new Date(date);
  cursor.setDate(cursor.getDate() - 1);

  while (cursor.getDay() === 0 || cursor.getDay() === 6) {
    cursor.setDate(cursor.getDate() - 1);
  }

  return cursor;
}

export function getFreeTierMarketDayKey(now = new Date()): string {
  const easternNow = toEasternDate(now);

  while (easternNow.getDay() === 0 || easternNow.getDay() === 6) {
    easternNow.setDate(easternNow.getDate() - 1);
  }

  const marketOpen = new Date(easternNow);
  marketOpen.setHours(9, 30, 0, 0);

  if (easternNow < marketOpen) {
    return getDayKey(getPreviousBusinessDay(easternNow));
  }

  return getDayKey(easternNow);
}

function normalizeRates(rates: Record<string, number>): Record<string, number> {
  const normalized: Record<string, number> = {
    USD: 1,
  };

  for (const [code, rate] of Object.entries(rates)) {
    const upper = code.toUpperCase();
    if (!/^[A-Z]{3}$/.test(upper)) continue;
    if (!Number.isFinite(rate) || rate <= 0) continue;
    normalized[upper] = rate;
  }

  return normalized;
}

function validateRateQuality(
  nextRates: Record<string, number>,
  previousRates: Record<string, number> | null,
): void {
  const count = Object.keys(nextRates).length;
  if (count < 25) {
    throw new Error(`Rate payload too small: ${count} currencies`);
  }

  if (!nextRates.USD || nextRates.USD !== 1) {
    throw new Error("USD base rate is invalid");
  }

  if (previousRates) {
    for (const code of MAJOR_CURRENCIES) {
      const oldRate = previousRates[code];
      const newRate = nextRates[code];

      if (!oldRate || !newRate) continue;

      const ratio = newRate / oldRate;
      if (ratio > 3 || ratio < 0.33) {
        throw new Error(`Suspicious jump detected for ${code}`);
      }
    }
  }
}

async function updateProviderHealth(
  provider: string,
  success: boolean,
  errorMessage?: string,
): Promise<void> {
  await mutateDb((draft) => {
    const existing = draft.providerHealth.find((entry) => entry.provider === provider);

    if (!existing) {
      draft.providerHealth.push({
        provider,
        lastSuccessAt: success ? Date.now() : null,
        lastFailureAt: success ? null : Date.now(),
        failureCount: success ? 0 : 1,
        lastError: success ? null : errorMessage || "Unknown provider error",
      });
      return;
    }

    if (success) {
      existing.lastSuccessAt = Date.now();
      existing.lastError = null;
      existing.failureCount = 0;
      return;
    }

    existing.lastFailureAt = Date.now();
    existing.failureCount += 1;
    existing.lastError = errorMessage || "Unknown provider error";
  });
}

async function fetchRatesWithFallback(): Promise<{
  rates: Record<string, number>;
  source: string;
}> {
  const db = await readDb();
  const previousRates = db.rateCaches.paid?.rates || db.rateCaches.free?.rates || null;

  for (const provider of PROVIDERS) {
    try {
      const response = await fetch(provider.url);
      if (!response.ok) {
        throw new Error(`${provider.name} status ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      const parsed = provider.parse(payload);
      const normalized = normalizeRates(parsed);
      validateRateQuality(normalized, previousRates);

      await updateProviderHealth(provider.name, true);
      await resolveAlert(`provider-${provider.name}`);

      return {
        rates: normalized,
        source: provider.name,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await updateProviderHealth(provider.name, false, message);
      await openAlert({
        code: `provider-${provider.name}`,
        level: "warning",
        message: `Provider ${provider.name} failed: ${message}`,
      });
    }
  }

  throw new Error("All rate providers failed");
}

async function setCachedSnapshot(planTier: PlanTier, snapshot: RateSnapshot): Promise<void> {
  await mutateDb((draft) => {
    draft.rateCaches[planTier] = snapshot;
  });
}

async function getCachedSnapshot(planTier: PlanTier): Promise<RateSnapshot | null> {
  const db = await readDb();
  return db.rateCaches[planTier];
}

async function checkStaleCacheAlerts(): Promise<void> {
  const db = await readDb();
  const now = Date.now();

  const paidSnapshot = db.rateCaches.paid;
  if (!paidSnapshot) {
    await openAlert({
      code: "rates-paid-missing",
      level: "warning",
      message: "No paid rate snapshot exists yet",
    });
  } else if (now - paidSnapshot.fetchedAt > config.rateStaleAlertMs) {
    await openAlert({
      code: "rates-paid-stale",
      level: "critical",
      message: "Paid rate snapshot is stale",
    });
  } else {
    await resolveAlert("rates-paid-stale");
    await resolveAlert("rates-paid-missing");
  }

  const freeSnapshot = db.rateCaches.free;
  if (!freeSnapshot) {
    await openAlert({
      code: "rates-free-missing",
      level: "warning",
      message: "No free tier market-day snapshot exists yet",
    });
  } else {
    await resolveAlert("rates-free-missing");
  }
}

export async function getRatesForPlan(planTier: PlanTier, forceRefresh = false): Promise<RateSnapshot> {
  const cached = await getCachedSnapshot(planTier);
  const marketDayKey = getFreeTierMarketDayKey();

  if (!forceRefresh && cached) {
    if (planTier === "paid" && Date.now() - cached.fetchedAt < config.ratePaidTtlMs) {
      await checkStaleCacheAlerts();
      return cached;
    }

    if (planTier === "free" && cached.marketDayKey === marketDayKey) {
      await checkStaleCacheAlerts();
      return cached;
    }
  }

  try {
    const fetched = await fetchRatesWithFallback();
    const snapshot: RateSnapshot = {
      base: "USD",
      rates: fetched.rates,
      fetchedAt: Date.now(),
      marketDayKey: planTier === "free" ? marketDayKey : null,
      source: fetched.source,
    };

    await setCachedSnapshot(planTier, snapshot);
    await checkStaleCacheAlerts();

    return snapshot;
  } catch (error) {
    if (cached) {
      await checkStaleCacheAlerts();
      return cached;
    }

    throw error;
  }
}

export async function getRatesForUser(userId: string | null, forceRefresh = false): Promise<{
  planTier: PlanTier;
  snapshot: RateSnapshot;
}> {
  let planTier: PlanTier = "free";

  if (userId) {
    const entitlement = await getEntitlementView(userId);
    if (entitlement.status === "paid" || entitlement.status === "trial") {
      planTier = "paid";
    }
  }

  const snapshot = await getRatesForPlan(planTier, forceRefresh);

  return {
    planTier,
    snapshot,
  };
}
