import { fetchRateProviderPayload } from "../fetch/http.js";
import { normalizeRates } from "../validation/snapshot.js";

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

export async function fetchLatestUsdSnapshotFromClient() {
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
