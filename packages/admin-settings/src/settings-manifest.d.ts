export interface InlineRuntimeSettings {
  enabled: boolean;
  domain: string;
  pageUrl: string;
  targetCurrencies: string[];
  convertedCurrencyPosition: string;
  displayStyle: string;
  highlightColor: string;
  extraSettings: Record<string, unknown>;
}

export interface InlineRuntimeSettingsManifest {
  schemaVersion: number;
  generatedAt: string;
  scopes: {
    allUrls: InlineRuntimeSettings;
    domains: Record<string, InlineRuntimeSettings>;
    pages: Record<string, InlineRuntimeSettings>;
  };
}

export interface DisplayStyleOption {
  value: string;
  label: string;
}

export interface CurrencyOption {
  code: string;
  logo: string;
}

export const INLINE_RUNTIME_SETTINGS_SCHEMA_VERSION: 1;
export const DEFAULT_GENERATED_AT: string;
export const DEFAULT_TARGET_CURRENCY: string;
export const DEFAULT_POSITION: string;
export const DEFAULT_DISPLAY_STYLE: string;
export const DEFAULT_HIGHLIGHT_COLOR: string;
export const POSITION_OPTIONS: string[];
export const DISPLAY_STYLE_OPTIONS: DisplayStyleOption[];
export const CURRENCY_OPTIONS: CurrencyOption[];

export function normalizeDomainScope(value: string | undefined): string | null;
export function normalizePageScope(value: string | undefined): string | null;
export function createDefaultInlineRuntimeSettings(
  overrides?: Partial<InlineRuntimeSettings>,
): InlineRuntimeSettings;
export function createDefaultInlineRuntimeSettingsManifest(): InlineRuntimeSettingsManifest;
export function sanitizeInlineRuntimeSettings(
  value: unknown,
  fallback?: InlineRuntimeSettings,
): InlineRuntimeSettings;
export function sanitizeInlineRuntimeSettingsManifest(
  value: unknown,
): InlineRuntimeSettingsManifest;
export function getDisplayStylePreview(
  displayStyle: string,
  targetCurrency: string,
): string;
