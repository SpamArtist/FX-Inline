import { CurrencyCode } from "../enums";
import type { RateProvider, RateSnapshot } from "../rates.types";
import { fetchRateProviderPayload } from "./http";
import {
  normalizeRates,
  parseErApiRates,
  parseExchangeRateApiRates,
} from "./validation";

const RATE_PROVIDERS: RateProvider[] = [
  {
    name: "client-er-api",
    url: "https://open.er-api.com/v6/latest/USD",
    parse: parseErApiRates,
  },
  {
    name: "client-exchange-rate-api",
    url: "https://api.exchangerate-api.com/v4/latest/USD",
    parse: parseExchangeRateApiRates,
  },
];

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
