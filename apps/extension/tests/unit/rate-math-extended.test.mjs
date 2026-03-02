import {
  convertAmountWithSnapshot,
  formatConvertedAmount,
} from "../../test-dist/utils/rateMath.js";

const snapshot = {
  rates: {
    USD: 1,
    EUR: 0.8,
    JPY: 110,
    INR: 83,
  },
};

test("converts negatives and same-currency amounts correctly", () => {
  const negative = convertAmountWithSnapshot(-25, "USD", "EUR", snapshot);
  const same = convertAmountWithSnapshot(12.34, "USD", "USD", snapshot);

  expect(negative).toBe(-20);
  expect(same).toBe(12.34);
});

test("returns null for missing target or invalid source rates", () => {
  expect(convertAmountWithSnapshot(10, "USD", "GBP", snapshot)).toBeNull();

  const badSnapshot = {
    rates: {
      ...snapshot.rates,
      USD: 0,
    },
  };

  expect(convertAmountWithSnapshot(10, "USD", "EUR", badSnapshot)).toBeNull();
});

test("formatConvertedAmount handles precision edge cases", () => {
  expect(formatConvertedAmount(123.456789, 6)).toBe("123.456789");
  expect(formatConvertedAmount(0.1 + 0.2, 4)).toBe("0.3000");
  expect(formatConvertedAmount(10, 0)).toBe("10");
});
