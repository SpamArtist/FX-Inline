import {
  cloneInlineRuntimeSettings as cloneSharedInlineRuntimeSettings,
  createDefaultInlineRuntimeSettings as createSharedDefaultInlineRuntimeSettings,
  createDefaultInlineRuntimeSettingsManifest as createSharedDefaultInlineRuntimeSettingsManifest,
  getHostnameFromUrl,
  getPrimaryTargetCurrency as getSharedPrimaryTargetCurrency,
  getUnsupportedRuntimeSettingKeys as getSharedUnsupportedRuntimeSettingKeys,
  INLINE_RUNTIME_ALL_URLS_SCOPE_ID,
  INLINE_RUNTIME_SETTINGS_SCHEMA_VERSION,
  normalizeDomainScope,
  normalizePageScope,
  resolveInlineRuntimeSettingsForUrl as resolveSharedInlineRuntimeSettingsForUrl,
  sanitizeInlineRuntimeSettings as sanitizeSharedInlineRuntimeSettings,
  sanitizeInlineRuntimeSettingsManifest as sanitizeSharedInlineRuntimeSettingsManifest,
} from "@fx-inline/settings-schema";
import type { CurrencyCode } from "./enums";
import type {
  InlineRuntimeSettingKey,
  InlineRuntimeSettingRegistryEntry,
  InlineRuntimeSettings,
  InlineRuntimeSettingsManifest,
  ResolvedInlineRuntimeSettings,
} from "./inlineRuntimeSettings.types";

export {
  INLINE_RUNTIME_ALL_URLS_SCOPE_ID,
  INLINE_RUNTIME_SETTINGS_SCHEMA_VERSION,
  normalizeDomainScope,
  normalizePageScope,
};

export const INLINE_RUNTIME_SETTING_REGISTRY: Record<
  InlineRuntimeSettingKey,
  InlineRuntimeSettingRegistryEntry
> = {
  enabled: {
    key: "enabled",
    label: "On/Off switch",
    runtimeSupported: true,
  },
  domain: {
    key: "domain",
    label: "Domain",
    runtimeSupported: true,
  },
  pageUrl: {
    key: "pageUrl",
    label: "Page URL",
    runtimeSupported: true,
  },
  targetCurrencies: {
    key: "targetCurrencies",
    label: "Target currency",
    runtimeSupported: true,
  },
  convertedCurrencyPosition: {
    key: "convertedCurrencyPosition",
    label: "Converted currency position",
    runtimeSupported: true,
  },
  displayStyle: {
    key: "displayStyle",
    label: "Display style",
    runtimeSupported: true,
  },
  highlightColor: {
    key: "highlightColor",
    label: "Highlight color",
    runtimeSupported: true,
  },
};

export function createDefaultInlineRuntimeSettings(
  overrides: Partial<InlineRuntimeSettings> = {},
): InlineRuntimeSettings {
  return createSharedDefaultInlineRuntimeSettings<CurrencyCode>(overrides);
}

export function createDefaultInlineRuntimeSettingsManifest(): InlineRuntimeSettingsManifest {
  return createSharedDefaultInlineRuntimeSettingsManifest<CurrencyCode>();
}

export const DEFAULT_INLINE_RUNTIME_SETTINGS = createDefaultInlineRuntimeSettings();

export const DEFAULT_INLINE_RUNTIME_SETTINGS_MANIFEST =
  createDefaultInlineRuntimeSettingsManifest();

export function sanitizeInlineRuntimeSettings(
  value: unknown,
  fallback: InlineRuntimeSettings = DEFAULT_INLINE_RUNTIME_SETTINGS,
): InlineRuntimeSettings {
  return sanitizeSharedInlineRuntimeSettings<CurrencyCode>(value, fallback);
}

export function sanitizeInlineRuntimeSettingsManifest(
  value: unknown,
  fallback: InlineRuntimeSettingsManifest = DEFAULT_INLINE_RUNTIME_SETTINGS_MANIFEST,
): InlineRuntimeSettingsManifest {
  return sanitizeSharedInlineRuntimeSettingsManifest<CurrencyCode>(value, fallback);
}

export function resolveInlineRuntimeSettingsForUrl(
  manifest: InlineRuntimeSettingsManifest,
  pageUrl: string | null | undefined,
): ResolvedInlineRuntimeSettings {
  return resolveSharedInlineRuntimeSettingsForUrl<CurrencyCode>(manifest, pageUrl);
}

export function getPrimaryTargetCurrency(
  settings: InlineRuntimeSettings,
): CurrencyCode {
  return getSharedPrimaryTargetCurrency<CurrencyCode>(settings);
}

export function getUnsupportedRuntimeSettingKeys(
  settings: InlineRuntimeSettings,
): string[] {
  return getSharedUnsupportedRuntimeSettingKeys(settings);
}

export function cloneInlineRuntimeSettings(
  settings: InlineRuntimeSettings,
): InlineRuntimeSettings {
  return cloneSharedInlineRuntimeSettings<CurrencyCode>(settings);
}

export { getHostnameFromUrl };
