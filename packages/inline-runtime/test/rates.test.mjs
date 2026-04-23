import { jest } from "@jest/globals";

import { getMarketDayKey } from "../src/rates/policy/marketDay.js";
import { __setMemoryRateCacheForTests, getRates } from "../src/rates/index.js";

beforeEach(() => {
  jest.clearAllMocks();
  __setMemoryRateCacheForTests(null);
});

afterEach(() => {
  __setMemoryRateCacheForTests(null);
  delete global.fetch;
});

test("returns cached snapshot when market-day cache is still valid", async () => {
  const cached = {
    base: "USD",
    fetchedAt: Date.now(),
    marketDayKey: getMarketDayKey(),
    rates: {
      USD: 1,
      EUR: 0.9,
    },
    source: "cache",
  };

  __setMemoryRateCacheForTests(cached);
  global.fetch = jest.fn();

  const snapshot = await getRates();

  expect(snapshot).toBe(cached);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("falls back to second provider when first provider fails", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: false, status: 500 })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        rates: {
          USD: 1,
          EUR: 0.91,
          INR: 83,
        },
      }),
    });

  const snapshot = await getRates({ forceRefresh: true });

  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(snapshot.source).toBe("client-exchange-rate-api");
  expect(snapshot.rates.USD).toBe(1);
  expect(snapshot.rates.EUR).toBe(0.91);
});

test("reuses last valid cache when refresh fails", async () => {
  const cached = {
    base: "USD",
    fetchedAt: Date.now(),
    marketDayKey: "2000-01-01",
    rates: {
      USD: 1,
      EUR: 0.9,
    },
    source: "cache",
  };

  __setMemoryRateCacheForTests(cached);

  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce({ ok: false, status: 503 });

  const snapshot = await getRates({ forceRefresh: true });

  expect(snapshot).toBe(cached);
});
