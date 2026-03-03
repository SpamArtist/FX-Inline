import { formatAmountInCurrency } from "../../test-dist/utils/utils.js";

test("formatAmountInCurrency formats known currencies", () => {
  const formatted = formatAmountInCurrency(1234.56, "USD");

  expect(formatted).toMatch(/1,?234\.56|1\.234,56|US\$/);
});

test("formatAmountInCurrency falls back for invalid currency codes", () => {
  const formatted = formatAmountInCurrency(12.345, "US");
  expect(formatted).toBe("12.35 US");
});

test("formatAmountInCurrency compacts large values for English locale", () => {
  const formatted = formatAmountInCurrency(34167440000, "EUR", {
    localeHint: "en-US",
    compactLargeValues: true,
  });

  expect(formatted).toContain("€");
  expect(formatted).toContain("B");
  expect(formatted).not.toContain("34,167,440,000");
});

test("formatAmountInCurrency compacts large values with regional locale units", () => {
  const formatted = formatAmountInCurrency(34167440000, "EUR", {
    localeHint: "fr-FR",
    compactLargeValues: true,
  });

  expect(formatted).toContain("€");
  expect(formatted).toContain("Md");
  expect(formatted).not.toContain("34167440000");
});
