import test from "node:test";
import assert from "node:assert/strict";
import {
  getFreeTierMarketDayKey,
  shouldUseFreeTierCache,
  shouldUsePaidTierCache,
} from "../../test-dist/utils/ratePolicy.js";

test("getFreeTierMarketDayKey returns same market day after open", () => {
  const result = getFreeTierMarketDayKey(new Date("2026-03-02T15:00:00.000Z"));
  assert.equal(result, "2026-03-02");
});

test("getFreeTierMarketDayKey rolls back before open and on weekends", () => {
  const preOpen = getFreeTierMarketDayKey(new Date("2026-03-02T13:00:00.000Z"));
  const weekend = getFreeTierMarketDayKey(new Date("2026-03-01T16:00:00.000Z"));

  assert.equal(preOpen, "2026-02-27");
  assert.equal(weekend, "2026-02-27");
});

test("cache policy helpers work for free and paid rules", () => {
  const now = new Date("2026-03-02T15:00:00.000Z");
  const sameDayKey = getFreeTierMarketDayKey(now);

  assert.equal(shouldUseFreeTierCache(sameDayKey, now), true);
  assert.equal(shouldUseFreeTierCache("2026-02-27", now), false);

  assert.equal(shouldUsePaidTierCache(1_000, 5_000, 5_500), true);
  assert.equal(shouldUsePaidTierCache(1_000, 5_000, 6_500), false);
});
