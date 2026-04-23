import {
  getMarketDayKey,
  shouldUseMarketDayCache,
  shouldUseTtlCache,
} from "../../test-dist/utils/ratePolicy/index.js";

test("market-day key handles weekend and pre-open rollover", () => {
  const saturday = getMarketDayKey(new Date("2026-03-07T16:00:00.000Z"));
  const preOpenMonday = getMarketDayKey(new Date("2026-03-09T12:59:00.000Z"));
  const postOpenMonday = getMarketDayKey(new Date("2026-03-09T13:31:00.000Z"));

  expect(saturday).toBe("2026-03-06");
  expect(preOpenMonday).toBe("2026-03-06");
  expect(postOpenMonday).toBe("2026-03-09");
});

test("market-day cache validation fails for missing/old market-day key", () => {
  const now = new Date("2026-03-09T15:00:00.000Z");
  const sameDay = getMarketDayKey(now);

  expect(shouldUseMarketDayCache(undefined, now)).toBe(false);
  expect(shouldUseMarketDayCache("2026-03-06", now)).toBe(false);
  expect(shouldUseMarketDayCache(sameDay, now)).toBe(true);
});

test("ttl cache validation supports boundary values", () => {
  expect(shouldUseTtlCache(1000, 5000, 6000)).toBe(true);
  expect(shouldUseTtlCache(1000, 5000, 6001)).toBe(false);
  expect(shouldUseTtlCache(1000, 0, 1000)).toBe(true);
});
