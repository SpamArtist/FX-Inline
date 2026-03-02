import {
  parseCurrencyValue,
  extractCurrencyTextMatches,
} from "../../test-dist/utils/utils.js";

test("parseCurrencyValue handles signs, separators, and lowercase iso", () => {
  const cases = [
    ["$1,234.56", true, 1234.56, "USD"],
    ["eur-42.5", true, -42.5, "EUR"],
    ["+150 usd", true, 150, "USD"],
    ["42.5eur", true, 42.5, "EUR"],
    ["JPY 1,234", true, 1234, "JPY"],
  ];

  for (const [input, valid, value, currency] of cases) {
    const parsed = parseCurrencyValue(input);
    expect(parsed.valid).toBe(valid);
    expect(parsed.value).toBe(value);
    expect(parsed.currency).toBe(currency);
  }
});

test("parseCurrencyValue rejects malformed or incomplete values", () => {
  const invalids = ["USD", "and 100", "100..50", "foo bar", "12.3.4 USD"];

  for (const input of invalids) {
    const parsed = parseCurrencyValue(input);
    expect(parsed.valid).toBe(false);
  }
});

test("extractCurrencyTextMatches ignores non-ISO words and catches real currencies", () => {
  const matches = extractCurrencyTextMatches(
    "Words and 200 apples; offer usd 30 and ₹50 now",
  );

  expect(matches).toHaveLength(2);
  expect(matches[0].currency).toBe("USD");
  expect(matches[0].value).toBe(30);
  expect(matches[1].value).toBe(50);
});

test("extractCurrencyTextMatches supports mixed symbol and ISO snippets", () => {
  const matches = extractCurrencyTextMatches("Deal: £99.99 then 120 CAD and 10€");

  expect(matches).toHaveLength(3);
  expect(matches[0].value).toBe(99.99);
  expect(matches[1].currency).toBe("CAD");
  expect(matches[2].value).toBe(10);
});
