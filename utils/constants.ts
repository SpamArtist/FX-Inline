import { CurrencyCode } from "./enums";

export const CurrencyIcon = {
  [CurrencyCode["UNITED STATES DOLLAR"]]: "$",
  [CurrencyCode.EURO]: "€",
  [CurrencyCode.INDIA]: "🇮🇳",
};

export const DEFAULT_BASE_CURRENCY = {
  code: CurrencyCode.EURO,
  logo: CurrencyIcon[CurrencyCode.EURO],
};

export const DEFAULT_ALT_CURRENCY = {
  code: CurrencyCode.INDIA,
  logo: CurrencyIcon[CurrencyCode.INDIA],
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
  [CurrencyCode["UNITED STATES DOLLAR"]]: {
    code: CurrencyCode["UNITED STATES DOLLAR"],
    icon: CurrencyIcon[CurrencyCode["UNITED STATES DOLLAR"]],
  },
  [CurrencyCode.EURO]: {
    code: CurrencyCode.EURO,
    icon: CurrencyIcon[CurrencyCode.EURO],
  },
  [CurrencyCode.INDIA]: {
    code: CurrencyCode.INDIA,
    icon: CurrencyIcon[CurrencyCode.INDIA],
  },
};
