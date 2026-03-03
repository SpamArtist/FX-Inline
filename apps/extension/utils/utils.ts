import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CURRENCY_SYMBOLS, ISO_CODES } from "./constants";
import { CurrencyCode } from "./enums";
import { getMagnitudeAliasMap } from "./magnitudeProfiles";

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

function normalizeMagnitudeAlias(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

const symbolPattern = Array.from(CURRENCY_SYMBOLS)
  .map(escapeRegex)
  .sort((a, b) => b.length - a.length)
  .join("|");

const isoPattern = Array.from(ISO_CODES)
  .map(escapeRegex)
  .sort((a, b) => b.length - a.length)
  .join("|");

const isoTokenPattern = `(?<!\\p{L})(?:${isoPattern})(?!\\p{L})`;

type ParserArtifacts = {
  magnitudeMultiplierByAlias: Map<string, number>;
  magnitudeSuffixRegex: RegExp;
  currencySnippetRegex: RegExp;
  currencyRangeRegex: RegExp;
};

const parserArtifactsCache = new Map<string, ParserArtifacts>();

function normalizeLocaleCacheKey(localeHint?: string | null): string {
  return localeHint?.trim().toLowerCase() || "__all__";
}

function buildParserArtifacts(localeHint?: string | null): ParserArtifacts {
  const magnitudeMultiplierByAlias = getMagnitudeAliasMap(localeHint);
  const magnitudePattern = Array.from(magnitudeMultiplierByAlias.keys())
    .map((alias) => escapeRegex(alias).replace(/\s+/g, "\\s+"))
    .sort((a, b) => b.length - a.length)
    .join("|");

  const magnitudeTokenPattern = `(?:${magnitudePattern})(?=$|[^\\p{L}\\p{N}])`;
  const numberWithOptionalMagnitudePattern =
    `[+-]?\\d[\\d,.]*(?:\\s*${magnitudeTokenPattern})?(?:\\s*\\+)?`;
  const currencyTokenPattern = `(${isoTokenPattern}|(?:${symbolPattern}))`;
  const rangeSeparatorPattern = "(?:-|–|—)";
  const currencySnippetRegex = new RegExp(
    `(?:${isoTokenPattern}\\s*${numberWithOptionalMagnitudePattern}|${numberWithOptionalMagnitudePattern}\\s*${isoTokenPattern}|(?:${symbolPattern})\\s*${numberWithOptionalMagnitudePattern}|${numberWithOptionalMagnitudePattern}\\s*(?:${symbolPattern}))`,
    "giu",
  );
  const currencyRangeRegex = new RegExp(
    `${currencyTokenPattern}\\s*(${numberWithOptionalMagnitudePattern})\\s*${rangeSeparatorPattern}\\s*(${numberWithOptionalMagnitudePattern})`,
    "giu",
  );
  const magnitudeSuffixRegex = new RegExp(
    `^(.+?)\\s*(${magnitudePattern})$`,
    "iu",
  );

  return {
    magnitudeMultiplierByAlias,
    magnitudeSuffixRegex,
    currencySnippetRegex,
    currencyRangeRegex,
  };
}

function getParserArtifacts(localeHint?: string | null): ParserArtifacts {
  const cacheKey = normalizeLocaleCacheKey(localeHint);
  const cached = parserArtifactsCache.get(cacheKey);
  if (cached) return cached;

  const artifacts = buildParserArtifacts(localeHint);
  parserArtifactsCache.set(cacheKey, artifacts);
  return artifacts;
}

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

function stripTrailingPlus(input: string): string {
  return input.replace(/\s*\+\s*$/u, "").trim();
}

function parseNumberWithOptionalMagnitudeForArtifacts(
  input: string,
  artifacts: ParserArtifacts,
): number | null {
  const trimmed = stripTrailingPlus(input);
  if (!trimmed.length) return null;

  const magnitudeMatch = trimmed.match(artifacts.magnitudeSuffixRegex);

  if (!magnitudeMatch) {
    return parseFlexibleNumber(trimmed, 0, trimmed.length);
  }

  const numberText = magnitudeMatch[1].trim();
  const normalizedMagnitude = normalizeMagnitudeAlias(magnitudeMatch[2]);
  if (!numberText.length) return null;

  const baseValue = parseFlexibleNumber(numberText, 0, numberText.length);
  if (baseValue === null) return null;

  const multiplier = artifacts.magnitudeMultiplierByAlias.get(normalizedMagnitude);
  if (multiplier === undefined) return null;

  return baseValue * multiplier;
}

function parseWithTokenPrefixForArtifacts(
  input: string,
  artifacts: ParserArtifacts,
): {
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

    const value = parseNumberWithOptionalMagnitudeForArtifacts(valueText, artifacts);
    if (value !== null) {
      return {
        value,
        currency: parsedCurrency,
      };
    }
  }

  return null;
}

function parseWithTokenSuffixForArtifacts(
  input: string,
  artifacts: ParserArtifacts,
): {
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

    const value = parseNumberWithOptionalMagnitudeForArtifacts(valueText, artifacts);
    if (value !== null) {
      return {
        value,
        currency: parsedCurrency,
      };
    }
  }

  return null;
}

type CurrencyParseOptions = {
  localeHint?: string | null;
};

function resolveLocaleHint(options?: string | CurrencyParseOptions | null): string | null {
  if (typeof options === "string") {
    return options || null;
  }

  if (options && typeof options === "object") {
    return options.localeHint || null;
  }

  return null;
}

function parseCurrencyValueWithArtifacts(
  input: string,
  artifacts: ParserArtifacts,
): { valid: boolean; value?: number; currency?: CurrencyCode | null } {
  if (input == null) return { valid: false };

  const str = String(input).trim();
  if (!str.length) return { valid: false };

  const numericOnly = parseNumberWithOptionalMagnitudeForArtifacts(str, artifacts);
  if (numericOnly !== null) {
    return { valid: true, value: numericOnly, currency: null };
  }

  const prefix = parseWithTokenPrefixForArtifacts(str, artifacts);
  if (prefix) {
    return {
      valid: true,
      value: prefix.value,
      currency: prefix.currency,
    };
  }

  const suffix = parseWithTokenSuffixForArtifacts(str, artifacts);
  if (suffix) {
    return {
      valid: true,
      value: suffix.value,
      currency: suffix.currency,
    };
  }

  return { valid: false };
}

export function parseCurrencyValue(
  input: string,
  options?: string | CurrencyParseOptions | null,
): { valid: boolean; value?: number; currency?: CurrencyCode | null } {
  const localeHint = resolveLocaleHint(options);
  const artifacts = getParserArtifacts(localeHint);
  return parseCurrencyValueWithArtifacts(input, artifacts);
}

export type CurrencyTextMatch = {
  raw: string;
  start: number;
  end: number;
  value: number;
  currency: CurrencyCode;
  rangeEndValue?: number;
};

export function extractCurrencyTextMatches(
  input: string,
  options?: string | CurrencyParseOptions | null,
): CurrencyTextMatch[] {
  if (!input?.length) return [];

  const localeHint = resolveLocaleHint(options);
  const artifacts = getParserArtifacts(localeHint);

  artifacts.currencySnippetRegex.lastIndex = 0;
  artifacts.currencyRangeRegex.lastIndex = 0;

  const matches: CurrencyTextMatch[] = [];

  for (const candidate of input.matchAll(artifacts.currencySnippetRegex)) {
    if (candidate.index === undefined) continue;

    const raw = candidate[0];
    const parsed = parseCurrencyValueWithArtifacts(raw, artifacts);

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

  for (const candidate of input.matchAll(artifacts.currencyRangeRegex)) {
    if (candidate.index === undefined) continue;

    const raw = candidate[0];
    const parsedCurrency = isCurrencyToken(candidate[1]);
    if (!parsedCurrency) continue;

    const firstValueText = candidate[2];
    const secondValueText = candidate[3];
    if (!firstValueText || !secondValueText) continue;

    const normalizedFirstValueText = stripTrailingPlus(firstValueText);
    const normalizedSecondValueText = stripTrailingPlus(secondValueText);

    const firstHadMagnitude =
      artifacts.magnitudeSuffixRegex.test(normalizedFirstValueText);
    const secondHadMagnitude =
      artifacts.magnitudeSuffixRegex.test(normalizedSecondValueText);

    let firstValue = parseNumberWithOptionalMagnitudeForArtifacts(firstValueText, artifacts);
    let secondValue = parseNumberWithOptionalMagnitudeForArtifacts(secondValueText, artifacts);

    if (firstValue === null || secondValue === null) {
      continue;
    }

    if (!firstHadMagnitude && secondHadMagnitude) {
      const secondMagnitude = normalizedSecondValueText.match(artifacts.magnitudeSuffixRegex);
      if (secondMagnitude) {
        const alias = normalizeMagnitudeAlias(secondMagnitude[2]);
        const multiplier = artifacts.magnitudeMultiplierByAlias.get(alias);
        if (multiplier !== undefined) {
          const base = parseFlexibleNumber(
            normalizedFirstValueText,
            0,
            normalizedFirstValueText.length,
          );
          if (base !== null) {
            firstValue = base * multiplier;
          }
        }
      }
    } else if (firstHadMagnitude && !secondHadMagnitude) {
      const firstMagnitude = normalizedFirstValueText.match(artifacts.magnitudeSuffixRegex);
      if (firstMagnitude) {
        const alias = normalizeMagnitudeAlias(firstMagnitude[2]);
        const multiplier = artifacts.magnitudeMultiplierByAlias.get(alias);
        if (multiplier !== undefined) {
          const base = parseFlexibleNumber(
            normalizedSecondValueText,
            0,
            normalizedSecondValueText.length,
          );
          if (base !== null) {
            secondValue = base * multiplier;
          }
        }
      }
    }

    matches.push({
      raw,
      start: candidate.index,
      end: candidate.index + raw.length,
      value: firstValue,
      rangeEndValue: secondValue,
      currency: parsedCurrency,
    });
  }

  const sortedMatches = matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const aLen = a.end - a.start;
    const bLen = b.end - b.start;
    return bLen - aLen;
  });

  const nonOverlappingMatches: CurrencyTextMatch[] = [];
  let latestCoveredEnd = -1;

  for (const match of sortedMatches) {
    if (match.start < latestCoveredEnd) continue;
    nonOverlappingMatches.push(match);
    latestCoveredEnd = match.end;
  }

  return nonOverlappingMatches;
}

type CurrencyFormatOptions = {
  localeHint?: string | null;
  compactLargeValues?: boolean;
  compactThreshold?: number;
};

export function formatAmountInCurrency(
  amount: number,
  currency: CurrencyCode,
  options?: CurrencyFormatOptions,
): string {
  const locale = options?.localeHint?.trim() || undefined;
  const compactThreshold = options?.compactThreshold ?? 1_000_000;
  const useCompact =
    options?.compactLargeValues === true && Math.abs(amount) >= compactThreshold;

  try {
    if (useCompact) {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        notation: "compact",
        compactDisplay: "short",
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }).format(amount);
    }

    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
