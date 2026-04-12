import { CurrencyCode } from "./enums";

export const CURRENCY_CODES = Object.freeze(
  Object.values(CurrencyCode) as CurrencyCode[],
);

export const CURRENCY_CODES_SET: ReadonlySet<string> = new Set(CURRENCY_CODES);

export function isCurrencyCode(value: string): value is CurrencyCode {
  return CURRENCY_CODES_SET.has(value);
}

