import { validateCatalogs } from "../../../../scripts/i18n/check-locales.mjs";

function createEnglishCatalog() {
  return {
    extensionName: { message: "FX Inline" },
    preferredCurrency: { message: "Preferred Currency" },
    currencyAmount: {
      message: "$CURRENCY_NAME$ amount",
      placeholders: { currency_name: { content: "$1" } },
    },
    amountUpdatesInstantly: { message: "Amount updates instantly" },
  };
}

function createSwedishCatalog() {
  return {
    extensionName: { message: "FX Inline" },
    preferredCurrency: { message: "Valuta [test]" },
    currencyAmount: {
      message: "Belopp i $CURRENCY_NAME$ [test]",
      placeholders: { currency_name: { content: "$1" } },
    },
  };
}

test("an incomplete catalog can use English fallback during development", () => {
  expect(validateCatalogs(createEnglishCatalog(), {
    extensionName: { message: "FX Inline" },
  })).toEqual([]);
});

test("release validation requires every active translation", () => {
  const errors = validateCatalogs(createEnglishCatalog(), {
    extensionName: { message: "FX Inline" },
  }, { requireComplete: true });
  expect(errors).toHaveLength(2);
  expect(errors.some((error) => error.includes("preferredCurrency"))).toBe(true);
  expect(errors.some((error) => error.includes("currencyAmount"))).toBe(true);
});

test("translation can move placeholders and omit the unused message", () => {
  expect(validateCatalogs(createEnglishCatalog(), createSwedishCatalog(), {
    requireComplete: true,
  })).toEqual([]);
});

test("translation cannot remove a placeholder", () => {
  const swedish = createSwedishCatalog();
  swedish.currencyAmount = { message: "Belopp [test]" };
  expect(validateCatalogs(createEnglishCatalog(), swedish)).toContain(
    "sv.currencyAmount: preserve the English placeholders.",
  );
});

test("translation cannot change the placeholder substitution", () => {
  const swedish = createSwedishCatalog();
  swedish.currencyAmount.placeholders.currency_name.content = "$2";
  expect(validateCatalogs(createEnglishCatalog(), swedish)).toContain(
    "sv.currencyAmount.currency_name: preserve the English substitution mapping.",
  );
});

test.each(["", "   "])("unfinished entries must be omitted instead of empty: %s", (message) => {
  const swedish = createSwedishCatalog();
  swedish.preferredCurrency.message = message;
  expect(validateCatalogs(createEnglishCatalog(), swedish)).toContain(
    "sv.preferredCurrency: message must contain text; omit unfinished Swedish entries.",
  );
});
