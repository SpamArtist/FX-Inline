import { storage } from "wxt/utils/storage";
import { hasPaidAccess, UserSettings } from "./appStorage";
import { CurrencyCode } from "./enums";
import { PAID_FEATURES_ENABLED } from "./featureFlags";
import {
  getFreeTierMarketDayKey,
  shouldUseFreeTierCache,
  shouldUsePaidTierCache,
} from "./ratePolicy";
import { RateSnapshotLike } from "./rateMath";

const FREE_RATE_CACHE_KEY = "local:rate-cache-free";
const PAID_RATE_CACHE_KEY = "local:rate-cache-paid";

const VALID_CURRENCY_CODES = new Set(Object.values(CurrencyCode));
const PAID_REFRESH_TTL_MS = 60 * 1000;

type ExchangeApiResponse = {
  result?: string;
  rates?: Record<string, number>;
};

type ExchangeRateApiResponse = {
  rates?: Record<string, number>;
};

type RateProvider = {
  name: string;
  url: string;
  parse: (payload: unknown) => Record<string, number>;
};

const RATE_PROVIDERS: RateProvider[] = [
  {
    name: "client-er-api",
    url: "https://open.er-api.com/v6/latest/USD",
    parse: (payload) => {
      const data = payload as ExchangeApiResponse;
      if (data.result !== "success" || !data.rates) {
        throw new Error("Rate API returned an invalid payload");
      }

      return data.rates;
    },
  },
  {
    name: "client-exchange-rate-api",
    url: "https://api.exchangerate-api.com/v4/latest/USD",
    parse: (payload) => {
      const data = payload as ExchangeRateApiResponse;
      if (!data.rates) {
        throw new Error("ExchangeRate API returned an invalid payload");
      }

      return data.rates;
    },
  },
];

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

async function fetchLatestUsdSnapshotFromClient(): Promise<RateSnapshot> {
  let lastError: Error | null = null;

  for (const provider of RATE_PROVIDERS) {
    try {
      const response = await fetch(provider.url);

      if (!response.ok) {
        throw new Error(`${provider.name} failed with status ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      const parsedRates = provider.parse(payload);
      const normalizedRates = normalizeRates(parsedRates);

      return {
        base: CurrencyCode["UNITED STATES DOLLAR"],
        rates: normalizedRates,
        fetchedAt: Date.now(),
        source: provider.name,
      };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Rate provider request failed");
    }
  }

  throw lastError || new Error("All client-side rate providers failed");
}

export async function getFreeTierRates(opts?: {
  forceRefresh?: boolean;
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

  try {
    const fetched = await fetchLatestUsdSnapshotFromClient();
    const snapshotWithMarketDay: RateSnapshot = {
      ...fetched,
      marketDayKey,
    };

    await freeRateCacheItem.setValue(snapshotWithMarketDay);
    return snapshotWithMarketDay;
  } catch (error) {
    if (isValidSnapshot(cached)) {
      return cached;
    }

    throw error;
  }
}

export async function getPaidTierRates(opts?: {
  forceRefresh?: boolean;
}): Promise<RateSnapshot> {
  if (!PAID_FEATURES_ENABLED) {
    return getFreeTierRates({
      forceRefresh: opts?.forceRefresh,
    });
  }

  const cached = await paidRateCacheItem.getValue();

  if (
    !opts?.forceRefresh &&
    isValidSnapshot(cached) &&
    shouldUsePaidTierCache(cached.fetchedAt, PAID_REFRESH_TTL_MS)
  ) {
    return cached;
  }

  try {
    const fetched = await fetchLatestUsdSnapshotFromClient();
    await paidRateCacheItem.setValue(fetched);
    return fetched;
  } catch (error) {
    if (isValidSnapshot(cached)) {
      return cached;
    }

    const fallbackFree = await getFreeTierRates({
      forceRefresh: opts?.forceRefresh,
    });

    const paidFallback: RateSnapshot = {
      ...fallbackFree,
      marketDayKey: undefined,
    };

    await paidRateCacheItem.setValue(paidFallback);
    return paidFallback;
  }
}

export async function getRatesForUser(
  settings: UserSettings,
  opts?: { forceRefresh?: boolean },
): Promise<RateSnapshot> {
  if (PAID_FEATURES_ENABLED && hasPaidAccess(settings)) {
    return getPaidTierRates(opts);
  }

  return getFreeTierRates(opts);
}
