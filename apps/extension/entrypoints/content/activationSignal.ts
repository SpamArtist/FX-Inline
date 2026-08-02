import { ACTIVATION_CURRENCY_SYMBOLS } from "@fx-inline/currency-detection/activation-data";

const ACTIVATION_TEXT_WINDOW_LIMIT = 512;

function escapeRegexLiteral(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
}

const CURRENCY_SYMBOL_PATTERN = `(?:${ACTIVATION_CURRENCY_SYMBOLS.map(
  escapeRegexLiteral,
).join("|")})`;
const ISO_CODE_PATTERN =
  "(?:AED|AFN|ALL|AMD|AOA|ARS|AUD|AWG|AZN|BAM|BBD|BDT|BHD|BIF|BMD|BND|BOB|BRL|BSD|BWP|BYN|BZD|CAD|CDF|CHF|CLP|CNY|COP|CRC|CUP|CVE|CZK|DJF|DKK|DOP|DZD|EGP|ERN|ETB|EUR|FJD|FKP|GBP|GEL|GHS|GIP|GMD|GNF|GTQ|GYD|HKD|HNL|HUF|IDR|ILS|INR|IQD|IRR|ISK|JMD|JOD|JPY|KES|KGS|KHR|KMF|KRW|KWD|KYD|KZT|LAK|LBP|LKR|LRD|LYD|MAD|MDL|MGA|MKD|MMK|MNT|MOP|MRU|MUR|MVR|MWK|MXN|MYR|MZN|NGN|NIO|NOK|NPR|NZD|OMR|PEN|PGK|PHP|PKR|PLN|PYG|QAR|RON|RSD|RUB|RWF|SAR|SBD|SCR|SDG|SEK|SGD|SHP|SLE|SOS|SRD|SSP|STN|SYP|SZL|THB|TJS|TMT|TND|TOP|TRY|TTD|TWD|TZS|UAH|UGX|USD|UYU|UZS|VES|VND|VUV|WST|XAF|XCD|XCG|XOF|YER|ZAR|ZMW|ZWL)";
const NUMBER_PATTERN = "\\d[\\d\\s.,'’]*(?:\\d|[.,]\\d)?";
const CURRENCY_ACTIVATION_PATTERNS = [
  new RegExp(`${CURRENCY_SYMBOL_PATTERN}\\s*${NUMBER_PATTERN}`, "u"),
  new RegExp(`${NUMBER_PATTERN}\\s*${CURRENCY_SYMBOL_PATTERN}`, "u"),
  new RegExp(`\\b${ISO_CODE_PATTERN}\\b\\s*${NUMBER_PATTERN}`, "u"),
  new RegExp(`${NUMBER_PATTERN}\\s*\\b${ISO_CODE_PATTERN}\\b`, "u"),
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

  return CURRENCY_ACTIVATION_PATTERNS.some((pattern) => pattern.test(normalized));
}
