import {
  ALLOWED_ISO_CURRENCY_CODES,
  AMBIGUOUS_ISO_CURRENCY_CODES,
} from "@fx-inline/currency-detection/iso-data";
import { ACTIVATION_CURRENCY_SYMBOLS } from "@fx-inline/currency-detection/activation-data";

const ACTIVATION_TEXT_WINDOW_LIMIT = 512;
const TOKEN_CONTEXT_LIMIT = 64;

function escapeRegexLiteral(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
}

const CURRENCY_SYMBOL_PATTERN = `(?:${ACTIVATION_CURRENCY_SYMBOLS.map(
  (symbol) => escapeRegexLiteral(symbol.normalize("NFKC")),
).join("|")})`;
const NUMBER_PATTERN = "\\d[\\d\\s.,'’]*(?:\\d|[.,]\\d)?";
const AMBIGUOUS_ISO_CODES = new Set(AMBIGUOUS_ISO_CURRENCY_CODES);
const ACTIVATION_ISO_CODE_PATTERN = Array.from(ALLOWED_ISO_CURRENCY_CODES)
  .filter((code) => !AMBIGUOUS_ISO_CODES.has(code))
  .sort((a, b) => b.length - a.length)
  .join("|");
const ISO_TOKEN_PATTERN = new RegExp(
  `(?<!\\p{L})(?:${ACTIVATION_ISO_CODE_PATTERN})(?!\\p{L})`,
  "giu",
);
const SYMBOL_TOKEN_PATTERN = new RegExp(CURRENCY_SYMBOL_PATTERN, "gu");
const TOKEN_CONTEXT_AMOUNT_PATTERN = new RegExp(NUMBER_PATTERN, "u");

export function normalizeActivationScanText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

export function appendActivationScanText(
  rollingText: string,
  text: string,
): string {
  const normalizedText = normalizeActivationScanText(text);
  if (!normalizedText) return rollingText;

  const nextText = rollingText
    ? `${rollingText} ${normalizedText}`
    : normalizedText;

  if (nextText.length <= ACTIVATION_TEXT_WINDOW_LIMIT) {
    return nextText;
  }

  return nextText.slice(nextText.length - ACTIVATION_TEXT_WINDOW_LIMIT);
}

export function hasCurrencyActivationSignal(text: string): boolean {
  if (!text || !/\d/u.test(text)) return false;
  const normalized = text.normalize("NFKC");

  for (const match of normalized.matchAll(SYMBOL_TOKEN_PATTERN)) {
    const tokenStart = match.index;
    const tokenEnd = tokenStart + match[0].length;
    if (hasAmountInTokenContext(normalized, tokenStart, tokenEnd)) return true;
  }

  for (const match of normalized.matchAll(ISO_TOKEN_PATTERN)) {
    const tokenStart = match.index;
    const tokenEnd = tokenStart + match[0].length;
    if (hasAmountInTokenContext(normalized, tokenStart, tokenEnd)) return true;
  }

  return false;
}

function hasAmountInTokenContext(
  text: string,
  tokenStart: number,
  tokenEnd: number,
): boolean {
  const prefixContext = text.slice(
    Math.max(0, tokenStart - TOKEN_CONTEXT_LIMIT),
    tokenStart,
  );
  const suffixContext = text.slice(tokenEnd, tokenEnd + TOKEN_CONTEXT_LIMIT);

  return (
    TOKEN_CONTEXT_AMOUNT_PATTERN.test(prefixContext) ||
    TOKEN_CONTEXT_AMOUNT_PATTERN.test(suffixContext)
  );
}
