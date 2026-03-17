import {
  cancelAmountEdit,
  commitAmountDraft,
  formatCurrencyHeadlineAmount,
  getCurrencyDisplayName,
  getCurrencyIcon,
  getNextAmountDraft,
  isAmountDraftValid,
} from "../../test-dist/utils/currencyPresentation.js";

test("getCurrencyDisplayName resolves names and falls back to code", () => {
  const usdName = getCurrencyDisplayName("USD", "en-US");
  expect(usdName.toLowerCase()).toContain("dollar");

  const fallbackName = getCurrencyDisplayName("EUR", "invalid_locale_token");
  expect(typeof fallbackName).toBe("string");
  expect(fallbackName.length).toBeGreaterThan(0);
});

test("getCurrencyIcon resolves a non-empty icon fallback", () => {
  expect(getCurrencyIcon("USD").length).toBeGreaterThan(0);
  expect(getCurrencyIcon("EUR").length).toBeGreaterThan(0);
});

test("amount draft validation accepts supported patterns", () => {
  expect(isAmountDraftValid("123")).toBe(true);
  expect(isAmountDraftValid("123.45")).toBe(true);
  expect(isAmountDraftValid("123.4567")).toBe(true);

  expect(isAmountDraftValid("123.45678")).toBe(false);
  expect(isAmountDraftValid("12a")).toBe(false);
  expect(isAmountDraftValid("12..3")).toBe(false);
});

test("getNextAmountDraft keeps prior value on invalid edits", () => {
  expect(getNextAmountDraft("12.3", "12.34")).toBe("12.34");
  expect(getNextAmountDraft("12.34", "12.34567")).toBe("12.34");
});

test("commit and cancel helpers preserve expected amount state", () => {
  expect(commitAmountDraft("42.5", "100")).toBe("42.5");
  expect(commitAmountDraft("", "100")).toBe("100");
  expect(commitAmountDraft("12.34567", "100")).toBe("100");

  expect(cancelAmountEdit("88")).toBe("88");
});

test("formatCurrencyHeadlineAmount uses Intl formatting with fallback", () => {
  const expected = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(1500.5);

  expect(formatCurrencyHeadlineAmount("1500.5", "USD", "en-US")).toBe(expected);
  expect(formatCurrencyHeadlineAmount("not-a-number", "USD", "en-US")).toBe(
    "not-a-number",
  );
});
