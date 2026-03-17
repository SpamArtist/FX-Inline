import type { CurrencyCode } from "./enums";

export type CurrencyListEntry = {
  code: CurrencyCode;
  logo?: string;
  name?: string;
};
