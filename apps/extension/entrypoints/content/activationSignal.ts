import {
  ALLOWED_ISO_CURRENCY_CODES,
  AMBIGUOUS_ISO_CURRENCY_CODES,
} from "@fx-inline/currency-detection/iso-data";

const ACTIVATION_TEXT_WINDOW_LIMIT = 512;
const ISO_TOKEN_CONTEXT_LIMIT = 64;

const CURRENCY_SYMBOL_PATTERN =
  "(?:US\\$|AU\\$|CA\\$|NZ\\$|HK\\$|MX\\$|NT\\$|EC\\$|RD\\$|R\\$|[$€£¥₹₩₪₫₱฿₦₲₡₨₭₮₯₰₳₴₵₷₸₺￥＄￡￦￠﹩])";
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
const TOKEN_CONTEXT_AMOUNT_PATTERN = new RegExp(NUMBER_PATTERN, "u");
const CURRENCY_ACTIVATION_PATTERNS = [
  new RegExp(`${CURRENCY_SYMBOL_PATTERN}\\s*${NUMBER_PATTERN}`, "u"),
  new RegExp(`${NUMBER_PATTERN}\\s*${CURRENCY_SYMBOL_PATTERN}`, "u"),
];

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

  if (CURRENCY_ACTIVATION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  ISO_TOKEN_PATTERN.lastIndex = 0;
  for (const match of normalized.matchAll(ISO_TOKEN_PATTERN)) {
    const tokenStart = match.index;
    const tokenEnd = tokenStart + match[0].length;
    const prefixContext = normalized.slice(
      Math.max(0, tokenStart - ISO_TOKEN_CONTEXT_LIMIT),
      tokenStart,
    );
    const suffixContext = normalized.slice(
      tokenEnd,
      tokenEnd + ISO_TOKEN_CONTEXT_LIMIT,
    );

    if (
      TOKEN_CONTEXT_AMOUNT_PATTERN.test(prefixContext) ||
      TOKEN_CONTEXT_AMOUNT_PATTERN.test(suffixContext)
    ) {
      return true;
    }
  }

  return false;
}
