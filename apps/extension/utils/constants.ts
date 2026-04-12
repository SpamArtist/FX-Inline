import { CURRENCY_CODES } from "./currencyCodes";
import { CurrencyCode } from "./enums";

export const DEFAULT_STARTING_CURRENCY = CurrencyCode["EURO"];

const CURRENCY_ICON = {
  [DEFAULT_STARTING_CURRENCY]: "€",
  [CurrencyCode.INDIA]: "🇮🇳",
};

export const CURRENCY_CODE_MAP: Partial<
  Record<
    CurrencyCode,
    {
      code: CurrencyCode;
      icon: string;
    }
  >
> = {
  [DEFAULT_STARTING_CURRENCY]: {
    code: DEFAULT_STARTING_CURRENCY,
    icon: CURRENCY_ICON[DEFAULT_STARTING_CURRENCY],
  },
  [CurrencyCode.INDIA]: {
    code: CurrencyCode.INDIA,
    icon: CURRENCY_ICON[CurrencyCode.INDIA],
  },
};
export const ISO_CODES: ReadonlySet<string> = new Set(CURRENCY_CODES);

export const CURRENCY_SYMBOLS = new Set([
  "$",
  "€",
  "£",
  "¥",
  "₹",
  "₩",
  "₪",
  "₫",
  "₱",
  "฿",
  "₦",
  "₲",
  "₡",
  "₨",
  "₭",
  "₮",
  "₯",
  "₰",
  "₳",
  "₴",
  "₵",
  "₷",
  "₸",
  "₺",
  "₻",
  "₼",
  "₽",
  "₾",
  "₿",
  "¢",
  "৳",
  "ر.س",
  "د.إ",
  "د.ك",
  "ر.ع.",
  "ل.د",
  "ر.ق",
]);
