import type { CurrencyCode } from "./enums";
import type { InlineRuntimeSettingsManifest } from "./inlineRuntimeSettings.types";

export type LocalAutoConversionByOrigin = Record<string, boolean>;

export type LegacyUserSettings = {
  preferredCurrency: CurrencyCode;
  globalAutoConversionEnabled: boolean;
  localAutoConversionByOrigin: LocalAutoConversionByOrigin;
};

export type UserSettings = InlineRuntimeSettingsManifest;
