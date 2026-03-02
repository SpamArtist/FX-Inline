import {
  getFreeTierMarketDayKey,
  shouldUseFreeTierCache,
  shouldUsePaidTierCache,
} from "../../test-dist/utils/ratePolicy.js";

test("market-day key handles weekend and pre-open rollover", () => {
  const saturday = getFreeTierMarketDayKey(new Date("2026-03-07T16:00:00.000Z"));
  const preOpenMonday = getFreeTierMarketDayKey(new Date("2026-03-09T12:59:00.000Z"));
  const postOpenMonday = getFreeTierMarketDayKey(new Date("2026-03-09T13:31:00.000Z"));

  expect(saturday).toBe("2026-03-06");
  expect(preOpenMonday).toBe("2026-03-06");
  expect(postOpenMonday).toBe("2026-03-09");
});

test("free-tier cache validation fails for missing/old market-day key", () => {
  const now = new Date("2026-03-09T15:00:00.000Z");
  const sameDay = getFreeTierMarketDayKey(now);

  expect(shouldUseFreeTierCache(undefined, now)).toBe(false);
  expect(shouldUseFreeTierCache("2026-03-06", now)).toBe(false);
  expect(shouldUseFreeTierCache(sameDay, now)).toBe(true);
});

test("paid-tier cache validation supports TTL boundaries", () => {
  expect(shouldUsePaidTierCache(1000, 5000, 6000)).toBe(true);
  expect(shouldUsePaidTierCache(1000, 5000, 6001)).toBe(false);
  expect(shouldUsePaidTierCache(1000, 0, 1000)).toBe(true);
});
