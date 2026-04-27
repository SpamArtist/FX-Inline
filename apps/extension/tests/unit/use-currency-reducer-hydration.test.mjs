import { jest } from "@jest/globals";
import { loadCurrencyReducerHydration } from "../../test-dist/hooks/useCurrencyReducer.hydration.js";

test("loadCurrencyReducerHydration returns preferred currency and rates on success", async () => {
  const readUserSettings = jest.fn().mockResolvedValue({
    schemaVersion: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    scopes: {
      allUrls: {
        enabled: true,
        domain: "",
        pageUrl: "",
        targetCurrencies: ["INR"],
        convertedCurrencyPosition: "right",
        displayStyle: "brackets",
        highlightColor: "#fff1a8",
        extraSettings: {},
      },
      domains: {},
      pages: {},
    },
  });
  const readRates = jest.fn().mockResolvedValue({
    base: "USD",
    fetchedAt: 123,
    rates: {
      USD: 1,
      INR: 80,
    },
  });

  const hydrated = await loadCurrencyReducerHydration({
    readUserSettings,
    readRates,
  });

  expect(readUserSettings).toHaveBeenCalledTimes(1);
  expect(readRates).toHaveBeenCalledTimes(1);
  expect(hydrated.preferredCurrency).toBe("INR");
  expect(hydrated.rateSnapshot).toMatchObject({
    base: "USD",
    rates: {
      USD: 1,
      INR: 80,
    },
  });
});

test("loadCurrencyReducerHydration returns null state when settings or rates fail", async () => {
  const readUserSettings = jest.fn().mockRejectedValue(new Error("boom"));
  const readRates = jest.fn().mockResolvedValue({
    base: "USD",
    fetchedAt: 123,
    rates: {
      USD: 1,
    },
  });

  const hydrated = await loadCurrencyReducerHydration({
    readUserSettings,
    readRates,
  });

  expect(readUserSettings).toHaveBeenCalledTimes(1);
  expect(readRates).not.toHaveBeenCalled();
  expect(hydrated).toEqual({
    preferredCurrency: null,
    rateSnapshot: null,
  });
});
