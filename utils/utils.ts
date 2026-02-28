import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CURRENCY_SYMBOLS, ISO_CODES } from "./constants";
import { CurrencyCode, LocalStorageItem } from "./enums";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// TODO: Get active base currency from server
export function getPreferedBaseCurrency(): CurrencyCode {
  return (window.localStorage.getItem(
    LocalStorageItem.PREFERED_BASE_CURRENCY,
  ) || CurrencyCode["UNITED STATES DOLLAR"]) as CurrencyCode;
}

export function setPreferedBaseCurrency() {
  window.localStorage.setItem(
    LocalStorageItem.PREFERED_BASE_CURRENCY,
    CurrencyCode["UNITED STATES DOLLAR"],
  );
}

export function getPreferedAltCurrency(): CurrencyCode {
  return (window.localStorage.getItem(LocalStorageItem.PREFERED_ALT_CURRENCY) ||
    CurrencyCode.EURO) as CurrencyCode;
}

export function setPreferedAltCurrency() {
  window.localStorage.setItem(
    LocalStorageItem.PREFERED_BASE_CURRENCY,
    CurrencyCode.EURO,
  );
}

export function getConversionRatesAgainstPreferedBaseCurrency(
  currency: CurrencyCode,
) {
  const CONVERSION_RATES: Partial<Record<CurrencyCode, number>> = {
    [CurrencyCode["UNITED STATES DOLLAR"]]: 1,
    [CurrencyCode.EURO]: 0.83768698,
    [CurrencyCode.INDIA]: 92.1,
    [CurrencyCode.JAPAN]: 153.28,
    [CurrencyCode.VIETNAM]: 26044.99,
  };

  return CONVERSION_RATES[currency];
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

  // Sign
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

    // digit
    if (c >= 48 && c <= 57) {
      if (!seenDot) integerPart += str[i];
      else decimalPart += str[i];
      continue;
    }

    // dot (only allowed once, and only as decimal)
    if (c === 46) {
      if (seenDot) return null; // multiple dots
      seenDot = true;
      continue;
    }

    // comma
    if (c === 44) {
      if (seenDot) {
        // comma not allowed after decimal dot
        return null;
      }
      seenComma = true;
      commaCount++;
      continue;
    }

    return null;
  }

  if (!integerPart.length) return null;

  // If both dot and comma exist → dot is decimal, comma is grouping
  // If only commas exist:
  //   - If one comma and 2 digits after → treat as decimal
  //   - If multiple commas → treat as grouping

  if (!seenDot && seenComma && commaCount === 1) {
    const lastComma = str.lastIndexOf(",", end - 1);
    const digitsAfter = end - lastComma - 1;

    if (digitsAfter > 0 && digitsAfter <= 2) {
      // treat as decimal
      const raw = str.slice(start, end).replace(",", ".");
      const num = Number(raw);
      return Number.isFinite(num) ? sign * num : null;
    }
  }

  // Otherwise treat commas as grouping separators
  const normalized = integerPart + (decimalPart ? "." + decimalPart : "");

  const num = Number(normalized);
  return Number.isFinite(num) ? sign * num : null;
}

// -- MAIN -- //
export function parseCurrencyValue(
  input: string,
): { valid: boolean; value?: number; currency?: CurrencyCode | null } {
  if (input == null) return { valid: false };

  const str = String(input);
  let start = 0;
  let end = str.length;

  // manual trim
  while (start < end && str.charCodeAt(start) <= 32) start++;
  while (end > start && str.charCodeAt(end - 1) <= 32) end--;

  if (start >= end) return { valid: false };

  // fast path: number only
  const numOnly = parseFlexibleNumber(str, start, end);
  if (numOnly !== null) {
    return { valid: true, value: numOnly, currency: null };
  }

  // find first space
  let space = -1;
  for (let i = start; i < end; i++) {
    if (str.charCodeAt(i) === 32) {
      space = i;
      break;
    }
  }

  if (space === -1) return { valid: false };

  // prefix currency
  const prefix = str.slice(start, space);
  const prefixCurrency = isCurrencyToken(prefix);
  if (prefixCurrency) {
    const value = parseFlexibleNumber(str, space + 1, end);
    if (value !== null) {
      return { valid: true, value, currency: prefixCurrency };
    }
  }

  // suffix currency
  for (let i = end - 1; i > start; i--) {
    if (str.charCodeAt(i) === 32) {
      const suffix = str.slice(i + 1, end);
      const suffixCurrency = isCurrencyToken(suffix);

      if (suffixCurrency) {
        const value = parseFlexibleNumber(str, start, i);
        if (value !== null) {
          return { valid: true, value, currency: suffixCurrency };
        }
      }
      break;
    }
  }

  return { valid: false };
}
