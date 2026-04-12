import { CurrencyCode } from "./enums";
import type { JsonValue } from "./json.types";
import {
  normalizeRates,
  parseRatesFromExchangeApi,
  parseRatesFromExchangeRateApi,
} from "./rates.normalize";
import type { RateProvider, RateSnapshot } from "./rates.types";

const RATE_FETCH_TIMEOUT_MS = 8_000;

const RATE_PROVIDERS: RateProvider[] = [
  {
    name: "client-er-api",
    url: "https://open.er-api.com/v6/latest/USD",
    parse: parseRatesFromExchangeApi,
  },
  {
    name: "client-exchange-rate-api",
    url: "https://api.exchangerate-api.com/v4/latest/USD",
    parse: parseRatesFromExchangeRateApi,
  },
];

async function fetchRateProviderPayload(url: string): Promise<JsonValue> {
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

    return (await response.json()) as JsonValue;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchLatestUsdSnapshotFromClient(): Promise<RateSnapshot> {
  let lastError: Error | null = null;

  for (const provider of RATE_PROVIDERS) {
    try {
      const payload = await fetchRateProviderPayload(provider.url);
      const parsedRates = provider.parse(payload);
      const normalizedRates = normalizeRates(parsedRates);

      return {
        base: CurrencyCode["UNITED STATES DOLLAR"],
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

