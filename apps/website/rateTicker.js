const RATE_TICKER_CACHE_KEY = "fx-inline-rate-ticker-cache-v1";

export const RATE_TICKER_PROVIDER_CONFIGS = [
  {
    name: "client-er-api",
    url: "https://open.er-api.com/v6/latest/USD",
    parse(payload) {
      if (
        !isPlainObject(payload) ||
        payload.result !== "success" ||
        !isPlainObject(payload.rates)
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
      if (!isPlainObject(payload) || !isPlainObject(payload.rates)) {
        throw new Error("ExchangeRate API returned an invalid payload");
      }

      return payload.rates;
    },
  },
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getDefaultStorage() {
  return typeof globalThis.localStorage === "object" ? globalThis.localStorage : null;
}

function normalizeRates(rawRates) {
  const rates = {};

  for (const [currency, rawRate] of Object.entries(rawRates)) {
    const code = currency.toUpperCase();
    const rate = typeof rawRate === "number" ? rawRate : Number(rawRate);

    if (/^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0) {
      rates[code] = rate;
    }
  }

  if (Object.keys(rates).length === 0) {
    throw new Error("Rate API returned no usable rates");
  }

  return rates;
}

function isRateSnapshot(value) {
  return (
    isPlainObject(value) &&
    value.base === "USD" &&
    isPlainObject(value.rates) &&
    typeof value.fetchedAt === "number" &&
    typeof value.source === "string"
  );
}

function readRateTickerCache(storage) {
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(RATE_TICKER_CACHE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : null;

    if (
      !isPlainObject(parsedValue) ||
      typeof parsedValue.dayKey !== "string" ||
      !isRateSnapshot(parsedValue.snapshot)
    ) {
      return null;
    }

    return {
      dayKey: parsedValue.dayKey,
      snapshot: parsedValue.snapshot,
      previousSnapshot: isRateSnapshot(parsedValue.previousSnapshot)
        ? parsedValue.previousSnapshot
        : null,
    };
  } catch {
    return null;
  }
}

function writeRateTickerCache(storage, cache) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(RATE_TICKER_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage can be unavailable in private contexts. The ticker still renders.
  }
}

export function getDailyRateTickerCacheKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export async function fetchLatestUsdSnapshot({ fetchImpl, now = new Date() } = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch is unavailable for the rate ticker");
  }

  let lastError = null;

  for (const provider of RATE_TICKER_PROVIDER_CONFIGS) {
    try {
      const response = await fetchImpl(provider.url);

      if (!response || (typeof response.ok === "boolean" && !response.ok)) {
        throw new Error(`${provider.name} returned an unsuccessful response`);
      }

      const payload = await response.json();
      const parsedRates = provider.parse(payload);
      const normalizedRates = normalizeRates(parsedRates);

      return {
        base: "USD",
        rates: normalizedRates,
        fetchedAt: now.getTime(),
        source: provider.name,
      };
    } catch (error) {
      const cause = error instanceof Error ? error.message : "Unknown failure";
      lastError = new Error(`${provider.name} request failed: ${cause}`);
    }
  }

  throw lastError || new Error("All website rate providers failed");
}

export async function loadDailyUsdRateSnapshot({
  fetchImpl = globalThis.fetch?.bind(globalThis),
  storage = getDefaultStorage(),
  now = new Date(),
} = {}) {
  const dayKey = getDailyRateTickerCacheKey(now);
  const cache = readRateTickerCache(storage);

  if (cache?.dayKey === dayKey) {
    return {
      snapshot: cache.snapshot,
      previousSnapshot: cache.previousSnapshot,
      fromCache: true,
    };
  }

  try {
    const snapshot = await fetchLatestUsdSnapshot({ fetchImpl, now });
    const previousSnapshot = cache?.snapshot ?? null;

    writeRateTickerCache(storage, {
      dayKey,
      snapshot,
      previousSnapshot,
    });

    return {
      snapshot,
      previousSnapshot,
      fromCache: false,
    };
  } catch (error) {
    if (cache?.snapshot) {
      return {
        snapshot: cache.snapshot,
        previousSnapshot: cache.previousSnapshot,
        fromCache: true,
        error,
      };
    }

    throw error;
  }
}

export function formatTickerRate(rate) {
  const fractionDigits = Math.abs(rate) >= 10 ? 2 : 4;

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: false,
  }).format(rate);
}

export function formatTickerDelta(deltaPercent) {
  const normalizedDelta = Math.abs(deltaPercent) < 0.005 ? 0 : deltaPercent;
  const sign = normalizedDelta > 0 ? "+" : normalizedDelta < 0 ? "-" : "";

  return `${sign}${Math.abs(normalizedDelta).toFixed(2)}%`;
}

function getTickerDelta(currentRate, previousRate) {
  if (!Number.isFinite(previousRate) || previousRate <= 0) {
    return 0;
  }

  return ((currentRate - previousRate) / previousRate) * 100;
}

function getTickerTargetCurrency(item) {
  const labels = Array.from(item.querySelectorAll("span"))
    .map((span) => span.textContent.trim())
    .filter(Boolean);
  const pairLabel = labels.find((label) => /^[A-Z]{3}\/[A-Z]{3}$/.test(label));

  return pairLabel ? pairLabel.split("/")[1] : null;
}

function updateDataElement(element, value, text) {
  element.value = value;
  element.setAttribute("value", value);
  element.textContent = text;
}

function updateDeltaClass(element, deltaPercent) {
  element.classList.remove("is-up", "is-down", "is-flat");

  if (deltaPercent > 0) {
    element.classList.add("is-up");
  } else if (deltaPercent < 0) {
    element.classList.add("is-down");
  } else {
    element.classList.add("is-flat");
  }
}

export function renderRateTicker(root, { snapshot, previousSnapshot = null }) {
  const ticker = root.querySelector(".rate-ticker");

  if (!ticker) {
    return;
  }

  for (const item of ticker.querySelectorAll(".rate-ticker-list li")) {
    const targetCurrency = getTickerTargetCurrency(item);
    const currentRate = targetCurrency ? snapshot.rates[targetCurrency] : null;

    if (!Number.isFinite(currentRate)) {
      continue;
    }

    const dataElements = Array.from(item.querySelectorAll("data"));
    const rateElement = dataElements.find((element) => !element.classList.contains("rate-delta"));
    const deltaElement = dataElements.find((element) => element.classList.contains("rate-delta"));

    if (!rateElement || !deltaElement) {
      continue;
    }

    const previousRate = targetCurrency ? previousSnapshot?.rates?.[targetCurrency] : null;
    const deltaPercent = getTickerDelta(currentRate, previousRate);

    updateDataElement(rateElement, String(currentRate), formatTickerRate(currentRate));
    updateDataElement(
      deltaElement,
      deltaPercent.toFixed(2),
      formatTickerDelta(deltaPercent),
    );
    updateDeltaClass(deltaElement, deltaPercent);
  }
}

export function initializeRateTicker(root = globalThis.document, options = {}) {
  if (!root?.querySelector(".rate-ticker")) {
    return null;
  }

  return loadDailyUsdRateSnapshot(options)
    .then((result) => {
      renderRateTicker(root, result);
      return result;
    })
    .catch((error) => {
      console.warn("[fx-inline] Failed to update website rate ticker", error);
      return null;
    });
}
