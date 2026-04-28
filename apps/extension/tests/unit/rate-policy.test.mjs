import {
  getMarketDayKey,
  shouldUseMarketDayCache,
  shouldUseTtlCache,
} from "../../test-dist/utils/ratePolicy/index.js";

test("getMarketDayKey uses the UTC calendar day", () => {
  expect(getMarketDayKey(new Date("2026-03-02T00:00:00.000Z"))).toBe(
    "2026-03-02",
  );
  expect(getMarketDayKey(new Date("2026-03-02T23:59:59.999Z"))).toBe(
    "2026-03-02",
  );
  expect(getMarketDayKey(new Date("2026-03-03T00:00:00.000Z"))).toBe(
    "2026-03-03",
  );
});

test("getMarketDayKey does not roll back for NYSE pre-open or weekends", () => {
  const preOpen = getMarketDayKey(new Date("2026-03-02T13:00:00.000Z"));
  const weekend = getMarketDayKey(new Date("2026-03-01T16:00:00.000Z"));

  expect(preOpen).toBe("2026-03-02");
  expect(weekend).toBe("2026-03-01");
});

test("cache policy helpers work for market-day and ttl rules", () => {
  const now = new Date("2026-03-02T15:00:00.000Z");
  const sameDayKey = getMarketDayKey(now);

  expect(shouldUseMarketDayCache(sameDayKey, now)).toBe(true);
  expect(shouldUseMarketDayCache("2026-03-01", now)).toBe(false);

  expect(shouldUseTtlCache(1_000, 5_000, 5_500)).toBe(true);
  expect(shouldUseTtlCache(1_000, 5_000, 6_500)).toBe(false);
});
