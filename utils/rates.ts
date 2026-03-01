import { storage } from "wxt/utils/storage";
import { hasPaidAccess, UserSettings } from "./appStorage";
import { CurrencyCode } from "./enums";

const FREE_RATE_CACHE_KEY = "local:rate-cache-free";
const PAID_RATE_CACHE_KEY = "local:rate-cache-paid";

const VALID_CURRENCY_CODES = new Set(Object.values(CurrencyCode));
const PAID_REFRESH_TTL_MS = 60 * 1000;

type ExchangeApiResponse = {
  result?: string;
  rates?: Record<string, number>;
};

export type RateSnapshot = {
  base: CurrencyCode;
  rates: Partial<Record<CurrencyCode, number>>;
  fetchedAt: number;
  marketDayKey?: string;
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

function toEasternDate(now = new Date()): Date {
  return new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
}

function getPreviousBusinessDay(date: Date): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - 1);

  while (copy.getDay() === 0 || copy.getDay() === 6) {
    copy.setDate(copy.getDate() - 1);
  }

  return copy;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getFreeTierMarketDayKey(now = new Date()): string {
  const easternNow = toEasternDate(now);

  while (easternNow.getDay() === 0 || easternNow.getDay() === 6) {
    easternNow.setDate(easternNow.getDate() - 1);
  }

  const marketOpen = new Date(easternNow);
  marketOpen.setHours(9, 30, 0, 0);

  if (easternNow < marketOpen) {
    return toDateKey(getPreviousBusinessDay(easternNow));
  }

  return toDateKey(easternNow);
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
    const upperCode = code.toUpperCase() as CurrencyCode;

    if (!VALID_CURRENCY_CODES.has(upperCode)) continue;
    if (!Number.isFinite(rate) || rate <= 0) continue;

    normalized[upperCode] = rate;
  }

  return normalized;
}

async function fetchLatestUsdSnapshot(): Promise<RateSnapshot> {
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
  };
}

export async function getFreeTierRates(opts?: {
  forceRefresh?: boolean;
}): Promise<RateSnapshot> {
  const marketDayKey = getFreeTierMarketDayKey();
  const cached = await freeRateCacheItem.getValue();

  if (
    !opts?.forceRefresh &&
    isValidSnapshot(cached) &&
    cached.marketDayKey === marketDayKey
  ) {
    return cached;
  }

  try {
    const fetched = await fetchLatestUsdSnapshot();
    const snapshot: RateSnapshot = {
      ...fetched,
      marketDayKey,
    };

    await freeRateCacheItem.setValue(snapshot);
    return snapshot;
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
  const cached = await paidRateCacheItem.getValue();

  if (
    !opts?.forceRefresh &&
    isValidSnapshot(cached) &&
    Date.now() - cached.fetchedAt <= PAID_REFRESH_TTL_MS
  ) {
    return cached;
  }

  try {
    const fetched = await fetchLatestUsdSnapshot();
    await paidRateCacheItem.setValue(fetched);
    return fetched;
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

  return getFreeTierRates(opts);
}

export function convertAmountWithSnapshot(
  amount: number,
  sourceCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  snapshot: RateSnapshot,
): number | null {
  const sourceRate = snapshot.rates[sourceCurrency];
  const targetRate = snapshot.rates[targetCurrency];

  if (
    typeof sourceRate !== "number" ||
    !Number.isFinite(sourceRate) ||
    sourceRate <= 0
  ) {
    return null;
  }

  if (typeof targetRate !== "number" || !Number.isFinite(targetRate)) {
    return null;
  }

  return (amount * targetRate) / sourceRate;
}

export function formatConvertedAmount(amount: number, precision = 4): string {
  return amount.toFixed(precision);
}
