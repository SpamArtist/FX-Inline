import { storage } from "wxt/utils/storage";
import { CurrencyCode } from "./enums";
import { getMarketDayKey, shouldUseMarketDayCache } from "./ratePolicy";
import { RateSnapshotLike } from "./rateMath";

const RATE_CACHE_KEY = "local:rate-cache";

const VALID_CURRENCY_CODES: ReadonlySet<string> = new Set(
  Object.values(CurrencyCode),
);

type ExchangeApiResponse = {
  result?: string;
  rates?: Record<string, unknown>;
};

type ExchangeRateApiResponse = {
  rates?: Record<string, unknown>;
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
      if (!isExchangeApiResponse(payload)) {
        throw new Error("Rate API returned an invalid payload");
      }

      const parsedRates = parseNumberRecord(payload.rates);
      if (!parsedRates) {
        throw new Error("Rate API returned an invalid payload");
      }

      return parsedRates;
    },
  },
  {
    name: "client-exchange-rate-api",
    url: "https://api.exchangerate-api.com/v4/latest/USD",
    parse: (payload) => {
      if (!isExchangeRateApiResponse(payload)) {
        throw new Error("ExchangeRate API returned an invalid payload");
      }

      const parsedRates = parseNumberRecord(payload.rates);
      if (!parsedRates) {
        throw new Error("ExchangeRate API returned an invalid payload");
      }

      return parsedRates;
    },
  },
];

export type RateSnapshot = RateSnapshotLike & {
  base: CurrencyCode;
  fetchedAt: number;
  marketDayKey?: string;
  source?: string;
};

const rateCacheItem = storage.defineItem<RateSnapshot | null>(RATE_CACHE_KEY, {
  fallback: null,
});

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function parseNumberRecord(
  value: Record<string, unknown> | undefined,
): Record<string, number> | null {
  if (!value) return null;

  const parsed: Record<string, number> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "number" || !Number.isFinite(entryValue)) {
      continue;
    }

    parsed[key] = entryValue;
  }

  if (!Object.keys(parsed).length) {
    return null;
  }

  return parsed;
}

function isExchangeApiResponse(payload: unknown): payload is ExchangeApiResponse {
  return (
    isObjectRecord(payload) &&
    payload.result === "success" &&
    (payload.rates === undefined || isObjectRecord(payload.rates))
  );
}

function isExchangeRateApiResponse(payload: unknown): payload is ExchangeRateApiResponse {
  return isObjectRecord(payload) && (payload.rates === undefined || isObjectRecord(payload.rates));
}

function isCurrencyCode(value: string): value is CurrencyCode {
  return VALID_CURRENCY_CODES.has(value);
}

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
    const upperCode = code.toUpperCase();

    if (!isCurrencyCode(upperCode)) continue;
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

      const payload: unknown = await response.json();
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

export async function getRates(opts?: { forceRefresh?: boolean }): Promise<RateSnapshot> {
  const marketDayKey = getMarketDayKey();
  const cached = await rateCacheItem.getValue();

  if (
    !opts?.forceRefresh &&
    isValidSnapshot(cached) &&
    shouldUseMarketDayCache(cached.marketDayKey)
  ) {
    return cached;
  }

  try {
    const fetched = await fetchLatestUsdSnapshotFromClient();
    const snapshotWithMarketDay: RateSnapshot = {
      ...fetched,
      marketDayKey,
    };

    await rateCacheItem.setValue(snapshotWithMarketDay);
    return snapshotWithMarketDay;
  } catch (error) {
    if (isValidSnapshot(cached)) {
      return cached;
    }

    throw error;
  }
}
