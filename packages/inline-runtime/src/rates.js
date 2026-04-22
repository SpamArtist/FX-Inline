import { getMarketDayKey, shouldUseMarketDayCache } from "./marketDay.js";

const RATE_FETCH_TIMEOUT_MS = 8_000;
const RATE_PROVIDERS = [
  {
    name: "client-er-api",
    url: "https://open.er-api.com/v6/latest/USD",
    parse(payload) {
      if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload) ||
        payload.result !== "success" ||
        !payload.rates ||
        typeof payload.rates !== "object" ||
        Array.isArray(payload.rates)
      ) {
        throw new Error("Rate API returned an invalid payload");
      }

      return payload.rates;
    },
  },
  {
    name: "client-exchange-rate-api",
    url: "https://api.exchangerate-api.com/v4/latest/USD",
    parse(payload) {
      if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload) ||
        !payload.rates ||
        typeof payload.rates !== "object" ||
        Array.isArray(payload.rates)
      ) {
        throw new Error("ExchangeRate API returned an invalid payload");
      }

      return payload.rates;
    },
  },
];

let memoryRateCache = null;

function normalizeRates(rawRates) {
  const normalized = { USD: 1 };

  for (const [code, rate] of Object.entries(rawRates)) {
    const upperCode = code.toUpperCase();
    if (!/^[A-Z]{3,4}$/.test(upperCode)) continue;
    if (!Number.isFinite(rate) || rate <= 0) continue;
    normalized[upperCode] = rate;
  }

  return normalized;
}

function isValidSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (!snapshot.rates || typeof snapshot.rates !== "object") return false;
  const usd = snapshot.rates.USD;
  return typeof usd === "number" && Number.isFinite(usd) && usd > 0;
}

async function fetchRateProviderPayload(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, RATE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchLatestUsdSnapshotFromClient() {
  let lastError = null;

  for (const provider of RATE_PROVIDERS) {
    try {
      const payload = await fetchRateProviderPayload(provider.url);
      const parsedRates = provider.parse(payload);
      const normalizedRates = normalizeRates(parsedRates);

      return {
        base: "USD",
        rates: normalizedRates,
        fetchedAt: Date.now(),
        source: provider.name,
      };
    } catch (error) {
      const cause = error instanceof Error ? error.message : "Unknown failure";
      lastError = new Error(`${provider.name} request failed: ${cause}`);
    }
  }

  throw lastError || new Error("All client-side rate providers failed");
}

export async function getRates(options) {
  const marketDayKey = getMarketDayKey();

  if (
    !options?.forceRefresh &&
    isValidSnapshot(memoryRateCache) &&
    shouldUseMarketDayCache(memoryRateCache.marketDayKey)
  ) {
    return memoryRateCache;
  }

  try {
    const fetched = await fetchLatestUsdSnapshotFromClient();
    memoryRateCache = {
      ...fetched,
      marketDayKey,
    };

    return memoryRateCache;
  } catch (error) {
    if (isValidSnapshot(memoryRateCache)) {
      return memoryRateCache;
    }

    throw error;
  }
}

export function __setMemoryRateCacheForTests(snapshot) {
  memoryRateCache = snapshot;
}
