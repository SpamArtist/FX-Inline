import { storage } from "wxt/utils/storage";
import { getRatesFromBackend } from "./backendClient";
import { getValidAccessToken } from "./accountService";
import { hasPaidAccess, UserSettings } from "./appStorage";
import { CurrencyCode } from "./enums";
import {
  getFreeTierMarketDayKey,
  shouldUseFreeTierCache,
  shouldUsePaidTierCache,
} from "./ratePolicy";
import {
  convertAmountWithSnapshot,
  formatConvertedAmount,
  RateSnapshotLike,
} from "./rateMath";

const FREE_RATE_CACHE_KEY = "local:rate-cache-free";
const PAID_RATE_CACHE_KEY = "local:rate-cache-paid";

const VALID_CURRENCY_CODES = new Set(Object.values(CurrencyCode));
const PAID_REFRESH_TTL_MS = 60 * 1000;

type ExchangeApiResponse = {
  result?: string;
  rates?: Record<string, number>;
};

export type RateSnapshot = RateSnapshotLike & {
  base: CurrencyCode;
  fetchedAt: number;
  marketDayKey?: string;
  source?: string;
};

const freeRateCacheItem = storage.defineItem<RateSnapshot | null>(
  FREE_RATE_CACHE_KEY,
  {
    fallback: null,
  },
);

const paidRateCacheItem = storage.defineItem<RateSnapshot | null>(
  PAID_RATE_CACHE_KEY,
  {
    fallback: null,
  },
);

function isValidSnapshot(snapshot: RateSnapshot | null): snapshot is RateSnapshot {
  if (!snapshot) return false;
  if (snapshot.base !== CurrencyCode["UNITED STATES DOLLAR"]) return false;
  if (!snapshot.rates || typeof snapshot.rates !== "object") return false;

  const baseRate = snapshot.rates[CurrencyCode["UNITED STATES DOLLAR"]];
  return typeof baseRate === "number" && Number.isFinite(baseRate) && baseRate > 0;
}

function normalizeRates(
  rawRates: Record<string, number>,
): Partial<Record<CurrencyCode, number>> {
  const normalized: Partial<Record<CurrencyCode, number>> = {
    [CurrencyCode["UNITED STATES DOLLAR"]]: 1,
  };

  for (const [code, rate] of Object.entries(rawRates)) {
    const upperCode = code.toUpperCase() as CurrencyCode;

    if (!VALID_CURRENCY_CODES.has(upperCode)) continue;
    if (!Number.isFinite(rate) || rate <= 0) continue;

    normalized[upperCode] = rate;
  }

  return normalized;
}

function normalizeSnapshot(payload: {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
  marketDayKey: string | null;
  source: string;
}): RateSnapshot {
  return {
    base: CurrencyCode["UNITED STATES DOLLAR"],
    rates: normalizeRates(payload.rates),
    fetchedAt:
      typeof payload.fetchedAt === "number" && Number.isFinite(payload.fetchedAt)
        ? payload.fetchedAt
        : Date.now(),
    marketDayKey: payload.marketDayKey || undefined,
    source: payload.source,
  };
}

async function fetchLatestUsdSnapshotFallback(): Promise<RateSnapshot> {
  const response = await fetch("https://open.er-api.com/v6/latest/USD");

  if (!response.ok) {
    throw new Error(`Rate API request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ExchangeApiResponse;

  if (payload.result !== "success" || !payload.rates) {
    throw new Error("Rate API returned an invalid payload");
  }

  return {
    base: CurrencyCode["UNITED STATES DOLLAR"],
    rates: normalizeRates(payload.rates),
    fetchedAt: Date.now(),
    source: "extension-fallback-er-api",
  };
}

async function fetchSnapshotFromBackend(forceRefresh = false): Promise<{
  planTier: "free" | "paid";
  snapshot: RateSnapshot;
}> {
  const accessToken = await getValidAccessToken();
  const response = await getRatesFromBackend(accessToken, { forceRefresh });

  return {
    planTier: response.planTier,
    snapshot: normalizeSnapshot(response.snapshot),
  };
}

export async function getFreeTierRates(opts?: {
  forceRefresh?: boolean;
  allowBackend?: boolean;
}): Promise<RateSnapshot> {
  const marketDayKey = getFreeTierMarketDayKey();
  const cached = await freeRateCacheItem.getValue();

  if (
    !opts?.forceRefresh &&
    isValidSnapshot(cached) &&
    shouldUseFreeTierCache(cached.marketDayKey)
  ) {
    return cached;
  }

  if (!opts?.allowBackend) {
    try {
      const fallback = await fetchLatestUsdSnapshotFallback();
      const fallbackWithDay: RateSnapshot = {
        ...fallback,
        marketDayKey,
      };

      await freeRateCacheItem.setValue(fallbackWithDay);
      return fallbackWithDay;
    } catch (error) {
      if (isValidSnapshot(cached)) {
        return cached;
      }

      throw error;
    }
  }

  try {
    const fetched = await fetchSnapshotFromBackend(Boolean(opts?.forceRefresh));

    const normalizedFree: RateSnapshot = {
      ...fetched.snapshot,
      marketDayKey,
    };

    await freeRateCacheItem.setValue(normalizedFree);

    if (fetched.planTier === "paid") {
      await paidRateCacheItem.setValue({
        ...fetched.snapshot,
        marketDayKey: undefined,
      });
    }

    return normalizedFree;
  } catch (error) {
    if (isValidSnapshot(cached)) {
      return cached;
    }

    const fallback = await fetchLatestUsdSnapshotFallback();
    const fallbackWithDay: RateSnapshot = {
      ...fallback,
      marketDayKey,
    };

    await freeRateCacheItem.setValue(fallbackWithDay);
    return fallbackWithDay;
  }
}

export async function getPaidTierRates(opts?: {
  forceRefresh?: boolean;
}): Promise<RateSnapshot> {
  const cached = await paidRateCacheItem.getValue();

  if (
    !opts?.forceRefresh &&
    isValidSnapshot(cached) &&
    shouldUsePaidTierCache(cached.fetchedAt, PAID_REFRESH_TTL_MS)
  ) {
    return cached;
  }

  try {
    const fetched = await fetchSnapshotFromBackend(Boolean(opts?.forceRefresh));

    if (fetched.planTier === "paid") {
      await paidRateCacheItem.setValue(fetched.snapshot);
      return fetched.snapshot;
    }

    const downgradedSnapshot: RateSnapshot = {
      ...fetched.snapshot,
      marketDayKey: getFreeTierMarketDayKey(),
    };

    await freeRateCacheItem.setValue(downgradedSnapshot);
    return downgradedSnapshot;
  } catch (error) {
    if (isValidSnapshot(cached)) {
      return cached;
    }

    throw error;
  }
}

export async function getRatesForUser(
  settings: UserSettings,
  opts?: { forceRefresh?: boolean },
): Promise<RateSnapshot> {
  if (hasPaidAccess(settings)) {
    return getPaidTierRates(opts);
  }

  return getFreeTierRates({
    ...opts,
    allowBackend: true,
  });
}

export { convertAmountWithSnapshot, formatConvertedAmount, getFreeTierMarketDayKey };
