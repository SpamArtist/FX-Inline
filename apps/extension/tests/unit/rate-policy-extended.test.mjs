import {
  getMarketDayKey,
  shouldUseMarketDayCache,
  shouldUseTtlCache,
} from "../../test-dist/utils/ratePolicy/index.js";

test("market-day key changes only at UTC midnight", () => {
  const beforeMidnight = getMarketDayKey(
    new Date("2026-03-08T23:59:59.999Z"),
  );
  const atMidnight = getMarketDayKey(new Date("2026-03-09T00:00:00.000Z"));
  const afterMidnight = getMarketDayKey(new Date("2026-03-09T12:59:00.000Z"));

  expect(beforeMidnight).toBe("2026-03-08");
  expect(atMidnight).toBe("2026-03-09");
  expect(afterMidnight).toBe("2026-03-09");
});

test("market-day key is independent of source timezone offsets", () => {
  const utcInstant = getMarketDayKey(new Date("2026-03-09T00:30:00.000Z"));
  const newYorkInstant = getMarketDayKey(
    new Date("2026-03-08T20:30:00.000-04:00"),
  );
  const tokyoInstant = getMarketDayKey(
    new Date("2026-03-09T09:30:00.000+09:00"),
  );

  expect(newYorkInstant).toBe(utcInstant);
  expect(tokyoInstant).toBe(utcInstant);
  expect(utcInstant).toBe("2026-03-09");
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
