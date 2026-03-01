import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CURRENCY_SYMBOLS, ISO_CODES } from "./constants";
import { CurrencyCode } from "./enums";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_CODE_VALUES = new Set(Object.values(CurrencyCode));

const CURRENCY_SYMBOL_TO_CODE: Partial<Record<string, CurrencyCode>> = {
  $: CurrencyCode["UNITED STATES DOLLAR"],
  "€": CurrencyCode.EURO,
  "£": "GBP" as CurrencyCode,
  "¥": CurrencyCode.JAPAN,
  "₹": CurrencyCode.INDIA,
  "₩": "KRW" as CurrencyCode,
  "₪": "ILS" as CurrencyCode,
  "₫": "VND" as CurrencyCode,
  "₱": "PHP" as CurrencyCode,
  "฿": "THB" as CurrencyCode,
  "₦": "NGN" as CurrencyCode,
  "₨": "PKR" as CurrencyCode,
  "₭": "LAK" as CurrencyCode,
  "₮": "MNT" as CurrencyCode,
  "₽": "RUB" as CurrencyCode,
  "₺": "TRY" as CurrencyCode,
  "¢": "USD" as CurrencyCode,
  "৳": "BDT" as CurrencyCode,
  "ر.س": "SAR" as CurrencyCode,
  "د.إ": "AED" as CurrencyCode,
  "د.ك": "KWD" as CurrencyCode,
  "ر.ع.": "OMR" as CurrencyCode,
  "ل.د": "LYD" as CurrencyCode,
  "ر.ق": "QAR" as CurrencyCode,
};

const CURRENCY_TOKENS = [
  ...Array.from(ISO_CODES).map((token) => ({
    token,
    isIso: true,
  })),
  ...Array.from(CURRENCY_SYMBOLS).map((token) => ({
    token,
    isIso: false,
  })),
].sort((a, b) => b.token.length - a.token.length);

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const symbolPattern = Array.from(CURRENCY_SYMBOLS)
  .map(escapeRegex)
  .sort((a, b) => b.length - a.length)
  .join("|");

const CURRENCY_SNIPPET_REGEX = new RegExp(
  `(?:\\b[A-Za-z]{3}\\b\\s*[+-]?\\d[\\d,.]*|[+-]?\\d[\\d,.]*\\s*\\b[A-Za-z]{3}\\b|(?:${symbolPattern})\\s*[+-]?\\d[\\d,.]*|[+-]?\\d[\\d,.]*\\s*(?:${symbolPattern}))`,
  "g",
);

function toCurrencyCode(value: string): CurrencyCode | null {
  return CURRENCY_CODE_VALUES.has(value as CurrencyCode)
    ? (value as CurrencyCode)
    : null;
}

function isCurrencyToken(token: string): CurrencyCode | null {
  const upper = token.toUpperCase();

  if (ISO_CODES.has(upper)) {
    return toCurrencyCode(upper);
  }

  if (CURRENCY_SYMBOLS.has(token)) {
    const mappedCode = CURRENCY_SYMBOL_TO_CODE[token];
    return mappedCode ? toCurrencyCode(mappedCode) : null;
  }

  return null;
}

function parseFlexibleNumber(
  str: string,
  start: number,
  end: number,
): number | null {
  let i = start;
  if (i >= end) return null;

  let sign = 1;

  const first = str.charCodeAt(i);
  if (first === 43) i++;
  else if (first === 45) {
    sign = -1;
    i++;
  }

  let integerPart = "";
  let decimalPart = "";

  let seenDot = false;
  let seenComma = false;
  let commaCount = 0;

  for (; i < end; i++) {
    const c = str.charCodeAt(i);

    if (c >= 48 && c <= 57) {
      if (!seenDot) integerPart += str[i];
      else decimalPart += str[i];
      continue;
    }

    if (c === 46) {
      if (seenDot) return null;
      seenDot = true;
      continue;
    }

    if (c === 44) {
      if (seenDot) {
        return null;
      }
      seenComma = true;
      commaCount++;
      continue;
    }

    return null;
  }

  if (!integerPart.length) return null;

  if (!seenDot && seenComma && commaCount === 1) {
    const lastComma = str.lastIndexOf(",", end - 1);
    const digitsAfter = end - lastComma - 1;

    if (digitsAfter > 0 && digitsAfter <= 2) {
      const raw = str.slice(start, end).replace(",", ".");
      const num = Number(raw);
      return Number.isFinite(num) ? sign * num : null;
    }
  }

  const normalized = integerPart + (decimalPart ? "." + decimalPart : "");
  const num = Number(normalized);

  return Number.isFinite(num) ? sign * num : null;
}

function parseWithTokenPrefix(input: string): {
  value: number;
  currency: CurrencyCode;
} | null {
  const upperInput = input.toUpperCase();

  for (const tokenInfo of CURRENCY_TOKENS) {
    const hasPrefix = tokenInfo.isIso
      ? upperInput.startsWith(tokenInfo.token)
      : input.startsWith(tokenInfo.token);

    if (!hasPrefix) continue;

    const parsedCurrency = isCurrencyToken(tokenInfo.token);
    if (!parsedCurrency) continue;

    const valueText = input.slice(tokenInfo.token.length).trim();
    if (!valueText.length) continue;

    const value = parseFlexibleNumber(valueText, 0, valueText.length);
    if (value !== null) {
      return {
        value,
        currency: parsedCurrency,
      };
    }
  }

  return null;
}

function parseWithTokenSuffix(input: string): {
  value: number;
  currency: CurrencyCode;
} | null {
  const upperInput = input.toUpperCase();

  for (const tokenInfo of CURRENCY_TOKENS) {
    const hasSuffix = tokenInfo.isIso
      ? upperInput.endsWith(tokenInfo.token)
      : input.endsWith(tokenInfo.token);

    if (!hasSuffix) continue;

    const parsedCurrency = isCurrencyToken(tokenInfo.token);
    if (!parsedCurrency) continue;

    const valueText = input.slice(0, input.length - tokenInfo.token.length).trim();
    if (!valueText.length) continue;

    const value = parseFlexibleNumber(valueText, 0, valueText.length);
    if (value !== null) {
      return {
        value,
        currency: parsedCurrency,
      };
    }
  }

  return null;
}

export function parseCurrencyValue(
  input: string,
): { valid: boolean; value?: number; currency?: CurrencyCode | null } {
  if (input == null) return { valid: false };

  const str = String(input).trim();
  if (!str.length) return { valid: false };

  const numericOnly = parseFlexibleNumber(str, 0, str.length);
  if (numericOnly !== null) {
    return { valid: true, value: numericOnly, currency: null };
  }

  const prefix = parseWithTokenPrefix(str);
  if (prefix) {
    return {
      valid: true,
      value: prefix.value,
      currency: prefix.currency,
    };
  }

  const suffix = parseWithTokenSuffix(str);
  if (suffix) {
    return {
      valid: true,
      value: suffix.value,
      currency: suffix.currency,
    };
  }

  return { valid: false };
}

export type CurrencyTextMatch = {
  raw: string;
  start: number;
  end: number;
  value: number;
  currency: CurrencyCode;
};

export function extractCurrencyTextMatches(input: string): CurrencyTextMatch[] {
  if (!input?.length) return [];

  CURRENCY_SNIPPET_REGEX.lastIndex = 0;

  const matches: CurrencyTextMatch[] = [];

  for (const candidate of input.matchAll(CURRENCY_SNIPPET_REGEX)) {
    if (candidate.index === undefined) continue;

    const raw = candidate[0];
    const parsed = parseCurrencyValue(raw);

    if (!parsed.valid || parsed.currency == null || parsed.value === undefined) {
      continue;
    }

    matches.push({
      raw,
      start: candidate.index,
      end: candidate.index + raw.length,
      value: parsed.value,
      currency: parsed.currency,
    });
  }

  return matches;
}

export function formatAmountInCurrency(amount: number, currency: CurrencyCode): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
