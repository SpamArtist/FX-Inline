import { browser } from "wxt/browser";
import type englishMessages from "../public/_locales/en/messages.json";
import { messageKey, placeholderNames } from "./messageKey";

const LANGUAGES = new Set([
  "en", "de", "fr", "es", "it", "nl", "pl", "sv", "da", "no", "fi",
  "cs", "ro", "hu", "el", "tr", "uk",
]);

export function resolveExtensionLanguage(locale: string): string {
  const normalized = locale.trim().replaceAll("_", "-").toLowerCase();
  if (normalized === "pt-br") return "pt-BR";
  if (normalized === "pt-pt") return "pt-PT";
  const language = normalized.split("-")[0];
  if (language === "nb") return "no";
  return LANGUAGES.has(language) ? language : "en";
}

export function getExtensionLanguage(): string {
  return resolveExtensionLanguage(browser.i18n.getUILanguage());
}

/** WXT's browser.i18n calls chrome.i18n on Chrome and browser.i18n on Firefox. */
export function t(english: string, values: Record<string, string | number> = {}): string {
  const names = placeholderNames(english);
  const substitutions = names.map((name) => String(values[name] ?? `{${name}}`));
  const localized = browser.i18n.getMessage(
    messageKey(english) as keyof typeof englishMessages, substitutions,
  );
  if (localized?.trim()) return localized;

  // The source remains the fallback even if a catalog entry is absent at runtime.
  return english.replace(/\{([a-z][a-z0-9_]*)\}/gi,
    (token, name: string) => String(values[name] ?? token));
}

export function localizeDocument(document: Document, title: string = t("FX Inline")) {
  document.documentElement.lang = getExtensionLanguage();
  document.title = title;
}
