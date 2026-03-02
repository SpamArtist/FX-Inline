import test from "node:test";
import assert from "node:assert/strict";
import { convertAmountWithSnapshot, formatConvertedAmount } from "../../test-dist/utils/rateMath.js";

const snapshot = {
  rates: {
    USD: 1,
    EUR: 0.8,
    JPY: 110,
  },
};

test("convertAmountWithSnapshot converts across currencies", () => {
  const eur = convertAmountWithSnapshot(100, "USD", "EUR", snapshot);
  const usd = convertAmountWithSnapshot(80, "EUR", "USD", snapshot);
  const jpy = convertAmountWithSnapshot(10, "USD", "JPY", snapshot);

  assert.equal(eur, 80);
  assert.equal(usd, 100);
  assert.equal(jpy, 1100);
});

test("convertAmountWithSnapshot rejects invalid source rate", () => {
  const result = convertAmountWithSnapshot(50, "GBP", "USD", snapshot);
  assert.equal(result, null);
});

test("formatConvertedAmount uses expected precision", () => {
  assert.equal(formatConvertedAmount(1.234567, 4), "1.2346");
  assert.equal(formatConvertedAmount(1.2, 2), "1.20");
});
