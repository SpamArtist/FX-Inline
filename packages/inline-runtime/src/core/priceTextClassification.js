import { mayContainCurrencyToken } from "@fx-inline/currency-detection";

export const PRICE_TEXT_CLASS_DIRECT_CURRENCY = "direct-currency";
export const PRICE_TEXT_CLASS_AMOUNT_ONLY = "amount-only";
export const PRICE_TEXT_CLASS_UNRELATED = "unrelated";

const AMOUNT_ONLY_TEXT_REGEX = /^[+-]?\d[\d,.\u00A0\u202F ]*$/u;

export function classifyPriceText(text) {
  if (!text?.trim()) {
    return {
      kind: PRICE_TEXT_CLASS_UNRELATED,
      text: "",
    };
  }

  const trimmedText = text.trim();

  if (mayContainCurrencyToken(text)) {
    return {
      kind: PRICE_TEXT_CLASS_DIRECT_CURRENCY,
      text,
    };
  }

  if (AMOUNT_ONLY_TEXT_REGEX.test(trimmedText)) {
    return {
      kind: PRICE_TEXT_CLASS_AMOUNT_ONLY,
      text: trimmedText,
    };
  }

  return {
    kind: PRICE_TEXT_CLASS_UNRELATED,
    text,
  };
}
