import { formatAmountInCurrency } from "../../test-dist/utils/utils.js";

test("formatAmountInCurrency formats known currencies", () => {
  const formatted = formatAmountInCurrency(1234.56, "USD");

  expect(formatted).toMatch(/1,?234\.56|1\.234,56|US\$/);
});

test("formatAmountInCurrency falls back for invalid currency codes", () => {
  const formatted = formatAmountInCurrency(12.345, "US");
  expect(formatted).toBe("12.35 US");
});
