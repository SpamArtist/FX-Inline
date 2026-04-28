import {
  extractCurrencyTextMatches as extractCurrencyTextMatchesPortable,
  hasThousandMagnitudeHint as hasThousandMagnitudeHintPortable,
  mayContainCurrencyToken as mayContainCurrencyTokenPortable,
  parseCurrencyValue as parseCurrencyValuePortable,
} from "@fx-inline/currency-detection";
import { formatAmountInCurrency as formatAmountInCurrencyShared } from "@fx-inline/inline-runtime/extension";
import { CURRENCY_SYMBOLS } from "./constants";
import type {
  CurrencyFormatOptions,
  CurrencyParseOptions,
  CurrencyTextMatch,
  CurrencyValueParseResult,
} from "./currencyUtils.types";
import type { CurrencyCode } from "./enums";

const CURRENCY_SYMBOL_VARIANT_HINTS = [
  "￥",
  "＄",
  "￡",
  "￦",
  "￠",
  "﹩",
];

const RECOGNIZED_CURRENCY_SYMBOLS = new Set<string>(Array.from(CURRENCY_SYMBOLS));
for (const symbolVariant of CURRENCY_SYMBOL_VARIANT_HINTS) {
  RECOGNIZED_CURRENCY_SYMBOLS.add(symbolVariant);
  RECOGNIZED_CURRENCY_SYMBOLS.add(symbolVariant.normalize("NFKC"));
}

export function isRecognizedCurrencySymbolToken(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed.length) return false;
  if (RECOGNIZED_CURRENCY_SYMBOLS.has(trimmed)) return true;
  return RECOGNIZED_CURRENCY_SYMBOLS.has(trimmed.normalize("NFKC"));
}

export function parseCurrencyValue(
  input: string,
  options?: string | CurrencyParseOptions | null,
): CurrencyValueParseResult {
  const parsed = parseCurrencyValuePortable(input, options as string | { localeHint?: string | null } | null | undefined);
  if (!parsed.valid) {
    return { valid: false };
  }

  return {
    valid: true,
    value: parsed.value,
    currency: parsed.currency as CurrencyCode | null,
  };
}

export function extractCurrencyTextMatches(
  input: string,
  options?: string | CurrencyParseOptions | null,
): CurrencyTextMatch[] {
  const matches = extractCurrencyTextMatchesPortable(
    input,
    options as string | { localeHint?: string | null } | null | undefined,
  );

  return matches as CurrencyTextMatch[];
}

export function mayContainCurrencyToken(input: string): boolean {
  return mayContainCurrencyTokenPortable(input);
}

export function hasThousandMagnitudeHint(input: string): boolean {
  return hasThousandMagnitudeHintPortable(input);
}

export function formatAmountInCurrency(
  amount: number,
  currency: CurrencyCode,
  options?: CurrencyFormatOptions,
): string {
  return formatAmountInCurrencyShared(amount, currency, options);
}
