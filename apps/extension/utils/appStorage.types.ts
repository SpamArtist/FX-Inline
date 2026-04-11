import type { CurrencyCode } from "./enums";

export type LocalAutoConversionByOrigin = Record<string, boolean>;

export type UserSettings = {
  preferredCurrency: CurrencyCode;
  globalAutoConversionEnabled: boolean;
  localAutoConversionByOrigin: LocalAutoConversionByOrigin;
};
