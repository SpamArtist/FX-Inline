import test from "node:test";
import assert from "node:assert/strict";
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
    ["foo", false, undefined, undefined],
  ];

  for (const [input, expectedValid, expectedValue, expectedCurrency] of cases) {
    const parsed = parseCurrencyValue(input);
    assert.equal(parsed.valid, expectedValid, input);

    if (expectedValid) {
      assert.equal(parsed.value, expectedValue, input);
      assert.equal(parsed.currency ?? null, expectedCurrency ?? null, input);
    }
  }
});

test("extractCurrencyTextMatches finds ISO/symbol snippets", () => {
  const matches = extractCurrencyTextMatches("Deal: $100 and 200 eur today");

  assert.equal(matches.length, 2);
  assert.equal(matches[0].currency, "USD");
  assert.equal(matches[0].value, 100);
  assert.equal(matches[1].currency, "EUR");
  assert.equal(matches[1].value, 200);
});
