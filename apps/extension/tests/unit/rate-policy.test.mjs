import {
  getFreeTierMarketDayKey,
  shouldUseFreeTierCache,
  shouldUsePaidTierCache,
} from "../../test-dist/utils/ratePolicy.js";

test("getFreeTierMarketDayKey returns same market day after open", () => {
  const result = getFreeTierMarketDayKey(new Date("2026-03-02T15:00:00.000Z"));
  expect(result).toBe("2026-03-02");
});

test("getFreeTierMarketDayKey rolls back before open and on weekends", () => {
  const preOpen = getFreeTierMarketDayKey(new Date("2026-03-02T13:00:00.000Z"));
  const weekend = getFreeTierMarketDayKey(new Date("2026-03-01T16:00:00.000Z"));

  expect(preOpen).toBe("2026-02-27");
  expect(weekend).toBe("2026-02-27");
});

test("cache policy helpers work for free and paid rules", () => {
  const now = new Date("2026-03-02T15:00:00.000Z");
  const sameDayKey = getFreeTierMarketDayKey(now);

  expect(shouldUseFreeTierCache(sameDayKey, now)).toBe(true);
  expect(shouldUseFreeTierCache("2026-02-27", now)).toBe(false);

  expect(shouldUsePaidTierCache(1_000, 5_000, 5_500)).toBe(true);
  expect(shouldUsePaidTierCache(1_000, 5_000, 6_500)).toBe(false);
});
