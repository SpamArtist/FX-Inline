import type { CurrencyCode } from "./enums";
import type {
  InlineRuntimeSettings as SharedInlineRuntimeSettings,
  InlineRuntimeSettingsManifest as SharedInlineRuntimeSettingsManifest,
  ResolvedInlineRuntimeSettings as SharedResolvedInlineRuntimeSettings,
} from "@fx-inline/settings-schema";

export type InlineRuntimeScopeType = "all_urls" | "domain" | "page";

export type InlineConvertedCurrencyPosition =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "tooltip";

export type InlineConvertedCurrencyDisplayStyle =
  | "pill"
  | "underline"
  | "highlightColor"
  | "brackets";

export type InlineRuntimeSettings = SharedInlineRuntimeSettings<CurrencyCode>;

export type InlineRuntimeSettingsManifest =
  SharedInlineRuntimeSettingsManifest<CurrencyCode>;

export type InlineRuntimeSettingKey =
  | "enabled"
  | "domain"
  | "pageUrl"
  | "targetCurrencies"
  | "convertedCurrencyPosition"
  | "displayStyle"
  | "highlightColor";

export type InlineRuntimeSettingRegistryEntry = {
  key: InlineRuntimeSettingKey;
  label: string;
  runtimeSupported: boolean;
};

export type ResolvedInlineRuntimeSettings =
  SharedResolvedInlineRuntimeSettings<CurrencyCode>;
