import { parseCurrencyValue, extractCurrencyTextMatches } from "../../test-dist/utils/utils.js";

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
    ["EUR 12,5", true, 12.5, "EUR"],
    ["USD 4.295 billion", true, 4295000000, "USD"],
    ["4.295 billion USD", true, 4295000000, "USD"],
    ["₫ 4.295 billion", true, 4295000000, "VND"],
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
    "Median price: ₫ 4.295 billion and backup USD 2 million and EUR 3 trillions",
  );

  expect(matches).toHaveLength(3);
  expect(matches[0].currency).toBe("VND");
  expect(matches[0].value).toBe(4295000000);
  expect(matches[1].currency).toBe("USD");
  expect(matches[1].value).toBe(2000000);
  expect(matches[2].currency).toBe("EUR");
  expect(matches[2].value).toBe(3000000000000);
});
