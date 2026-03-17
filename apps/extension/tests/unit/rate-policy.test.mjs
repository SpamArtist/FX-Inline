import {
  getMarketDayKey,
  shouldUseMarketDayCache,
  shouldUseTtlCache,
} from "../../test-dist/utils/ratePolicy.js";

test("getMarketDayKey returns same market day after open", () => {
  const result = getMarketDayKey(new Date("2026-03-02T15:00:00.000Z"));
  expect(result).toBe("2026-03-02");
});

test("getMarketDayKey rolls back before open and on weekends", () => {
  const preOpen = getMarketDayKey(new Date("2026-03-02T13:00:00.000Z"));
  const weekend = getMarketDayKey(new Date("2026-03-01T16:00:00.000Z"));

  expect(preOpen).toBe("2026-02-27");
  expect(weekend).toBe("2026-02-27");
});

test("cache policy helpers work for market-day and ttl rules", () => {
  const now = new Date("2026-03-02T15:00:00.000Z");
  const sameDayKey = getMarketDayKey(now);

  expect(shouldUseMarketDayCache(sameDayKey, now)).toBe(true);
  expect(shouldUseMarketDayCache("2026-02-27", now)).toBe(false);

  expect(shouldUseTtlCache(1_000, 5_000, 5_500)).toBe(true);
  expect(shouldUseTtlCache(1_000, 5_000, 6_500)).toBe(false);
});
