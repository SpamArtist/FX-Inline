export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonObject = {
  [key: string]: JsonValue;
};

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

export type InlineRuntimeSettings<TCurrencyCode extends string = string> = {
  enabled: boolean;
  domain: string;
  pageUrl: string;
  targetCurrencies: TCurrencyCode[];
  convertedCurrencyPosition: InlineConvertedCurrencyPosition;
  displayStyle: InlineConvertedCurrencyDisplayStyle;
  highlightColor: string;
  extraSettings: Record<string, JsonValue>;
};

export type InlineRuntimeSettingsManifest<TCurrencyCode extends string = string> = {
  schemaVersion: 1;
  generatedAt: string;
  scopes: {
    allUrls: InlineRuntimeSettings<TCurrencyCode>;
    domains: Record<string, InlineRuntimeSettings<TCurrencyCode>>;
    pages: Record<string, InlineRuntimeSettings<TCurrencyCode>>;
  };
};

export type ResolvedInlineRuntimeSettings<TCurrencyCode extends string = string> = {
  scopeType: InlineRuntimeScopeType;
  scopeId: string;
  settings: InlineRuntimeSettings<TCurrencyCode>;
  unsupportedSettingKeys: string[];
};

export const INLINE_RUNTIME_SETTINGS_SCHEMA_VERSION: 1;
export const INLINE_RUNTIME_ALL_URLS_SCOPE_ID: "all_urls";
export const DEFAULT_INLINE_RUNTIME_SETTINGS: InlineRuntimeSettings;
export const DEFAULT_INLINE_RUNTIME_SETTINGS_MANIFEST: InlineRuntimeSettingsManifest;
export const DEFAULT_VALID_CURRENCY_CODES: ReadonlySet<string>;

export function normalizeDomainScope(value: string | null | undefined): string | null;

export function normalizePageScope(value: string | null | undefined): string | null;

export function getHostnameFromUrl(value: string | null | undefined): string | null;

export function createDefaultInlineRuntimeSettings<
  TCurrencyCode extends string = string,
>(
  overrides?: Partial<InlineRuntimeSettings<TCurrencyCode>>,
): InlineRuntimeSettings<TCurrencyCode>;

export function createDefaultInlineRuntimeSettingsManifest<
  TCurrencyCode extends string = string,
>(): InlineRuntimeSettingsManifest<TCurrencyCode>;

export function sanitizeInlineRuntimeSettings<
  TCurrencyCode extends string = string,
>(
  value: unknown,
  fallback?: InlineRuntimeSettings<TCurrencyCode>,
): InlineRuntimeSettings<TCurrencyCode>;

export function sanitizeInlineRuntimeSettingsManifest<
  TCurrencyCode extends string = string,
>(
  value: unknown,
  fallback?: InlineRuntimeSettingsManifest<TCurrencyCode>,
): InlineRuntimeSettingsManifest<TCurrencyCode>;

export function resolveInlineRuntimeSettingsForUrl<
  TCurrencyCode extends string = string,
>(
  manifest: InlineRuntimeSettingsManifest<TCurrencyCode>,
  pageUrl: string | null | undefined,
): ResolvedInlineRuntimeSettings<TCurrencyCode>;

export function getPrimaryTargetCurrency<TCurrencyCode extends string = string>(
  settings: InlineRuntimeSettings<TCurrencyCode>,
): TCurrencyCode;

export function getUnsupportedRuntimeSettingKeys(
  settings: InlineRuntimeSettings,
): string[];

export function cloneInlineRuntimeSettings<TCurrencyCode extends string = string>(
  settings: InlineRuntimeSettings<TCurrencyCode>,
): InlineRuntimeSettings<TCurrencyCode>;
