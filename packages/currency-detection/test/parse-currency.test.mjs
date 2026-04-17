import { expect, test } from "@jest/globals";

import {
  extractCurrencyTextMatches,
  parseCurrencyValue,
} from "../src/index.js";

test("parseCurrencyValue supports roadmap formats", () => {
  const cases = [
    ["100", true, 100, null],
    ["USD 100", true, 100, "USD"],
    ["100 USD", true, 100, "USD"],
    ["$100", true, 100, "USD"],
    ["100$", true, 100, "USD"],
    ["USD100", true, 100, "USD"],
    ["100USD", true, 100, "USD"],
    ["usd 100", true, 100, "USD"],
    ["yen 100", true, 100, "JPY"],
    ["EUR 12,5", true, 12.5, "EUR"],
    ["USD 4.295 billion", true, 4295000000, "USD"],
    ["4.295 billion USD", true, 4295000000, "USD"],
    ["₫ 4.295 billion", true, 4295000000, "VND"],
    ["₫ 3.65 tỷ", true, 3650000000, "VND"],
    ["VND 850 triệu", true, 850000000, "VND"],
    ["USD 2 miliar", true, 2000000000, "USD"],
    ["₫3.65tỷ", true, 3650000000, "VND"],
    ["foo", false, undefined, undefined],
  ];

  for (const [input, expectedValid, expectedValue, expectedCurrency] of cases) {
    const parsed = parseCurrencyValue(input);
    expect(parsed.valid).toBe(expectedValid);

    if (expectedValid) {
      expect(parsed.value).toBe(expectedValue);
      expect(parsed.currency ?? null).toBe(expectedCurrency ?? null);
    }
  }
});

test("extractCurrencyTextMatches finds ISO/symbol snippets", () => {
  const matches = extractCurrencyTextMatches("Deal: $100 and 200 eur today");

  expect(matches).toHaveLength(2);
  expect(matches[0].currency).toBe("USD");
  expect(matches[0].value).toBe(100);
  expect(matches[1].currency).toBe("EUR");
  expect(matches[1].value).toBe(200);
});

test("extractCurrencyTextMatches applies billion/million/trillion multipliers", () => {
  const matches = extractCurrencyTextMatches(
    "Median price: ₫ 4.295 billion and backup USD 2 million and EUR 3 trillions and VND 1.2 tỷ",
  );

  expect(matches).toHaveLength(4);
  expect(matches[0].currency).toBe("VND");
  expect(matches[0].value).toBe(4295000000);
  expect(matches[1].currency).toBe("USD");
  expect(matches[1].value).toBe(2000000);
  expect(matches[2].currency).toBe("EUR");
  expect(matches[2].value).toBe(3000000000000);
  expect(matches[3].currency).toBe("VND");
  expect(matches[3].value).toBe(1200000000);
});
