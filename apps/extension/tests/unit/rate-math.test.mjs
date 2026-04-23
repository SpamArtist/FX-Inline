import { convertAmountWithSnapshot, formatConvertedAmount } from "../../test-dist/utils/rateMath/index.js";

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

  expect(eur).toBe(80);
  expect(usd).toBe(100);
  expect(jpy).toBe(1100);
});

test("convertAmountWithSnapshot rejects invalid source rate", () => {
  const result = convertAmountWithSnapshot(50, "GBP", "USD", snapshot);
  expect(result).toBeNull();
});

test("formatConvertedAmount uses expected precision", () => {
  expect(formatConvertedAmount(1.234567, 4)).toBe("1.2346");
  expect(formatConvertedAmount(1.2, 2)).toBe("1.20");
});
