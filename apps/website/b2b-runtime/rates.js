import { DEFAULT_RATE_PROVIDERS } from "./constants.js";

const CACHE_TTL_MS = 30 * 60 * 1000;

function isObjectRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeRates(rawRates) {
  if (!isObjectRecord(rawRates)) {
    throw new Error("Rate response payload is invalid");
  }

  const normalized = { USD: 1 };

  for (const [code, amount] of Object.entries(rawRates)) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      continue;
    }

    const normalizedCode = code.toUpperCase();
    if (!/^[A-Z]{3}$/u.test(normalizedCode)) {
      continue;
    }

    normalized[normalizedCode] = amount;
  }

  return normalized;
}

async function fetchProvider(url, { timeoutMs, fetchImpl }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Provider request failed with ${response.status}`);
    }

    const payload = await response.json();
    const rates = normalizeRates(payload?.rates);

    return {
      base: "USD",
      rates,
      fetchedAt: Date.now(),
      source: url,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function createRateService(options = {}) {
  const providers = Array.isArray(options.providers) && options.providers.length
    ? options.providers
    : DEFAULT_RATE_PROVIDERS;
  const timeoutMs = typeof options.timeoutMs === "number" ? options.timeoutMs : 8000;
  const fetchImpl = options.fetchImpl ?? fetch;

  let cachedSnapshot = null;

  return {
    async getRates({ forceRefresh = false } = {}) {
      if (
        !forceRefresh &&
        cachedSnapshot &&
        Date.now() - cachedSnapshot.fetchedAt < CACHE_TTL_MS
      ) {
        return cachedSnapshot;
      }

      let lastError = null;

      for (const providerUrl of providers) {
        try {
          const snapshot = await fetchProvider(providerUrl, {
            timeoutMs,
            fetchImpl,
          });

          cachedSnapshot = snapshot;
          return snapshot;
        } catch (error) {
          lastError = error;
        }
      }

      if (cachedSnapshot) {
        return cachedSnapshot;
      }

      throw lastError ?? new Error("All rate providers failed");
    },
  };
}
