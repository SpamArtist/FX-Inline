import type { CurrencyCode } from "./enums";
import type { JsonValue } from "./json.types";

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

export type InlineRuntimeSettings = {
  enabled: boolean;
  domain: string;
  pageUrl: string;
  targetCurrencies: CurrencyCode[];
  convertedCurrencyPosition: InlineConvertedCurrencyPosition;
  displayStyle: InlineConvertedCurrencyDisplayStyle;
  extraSettings: Record<string, JsonValue>;
};

export type InlineRuntimeSettingsManifest = {
  schemaVersion: 1;
  generatedAt: string;
  scopes: {
    allUrls: InlineRuntimeSettings;
    domains: Record<string, InlineRuntimeSettings>;
    pages: Record<string, InlineRuntimeSettings>;
  };
};

export type InlineRuntimeSettingKey =
  | "enabled"
  | "domain"
  | "pageUrl"
  | "targetCurrencies"
  | "convertedCurrencyPosition"
  | "displayStyle";

export type InlineRuntimeSettingRegistryEntry = {
  key: InlineRuntimeSettingKey;
  label: string;
  runtimeSupported: boolean;
};

export type ResolvedInlineRuntimeSettings = {
  scopeType: InlineRuntimeScopeType;
  scopeId: string;
  settings: InlineRuntimeSettings;
  unsupportedSettingKeys: string[];
};
