import { browser } from "wxt/browser";
import englishMessages from "../public/_locales/en/messages.json";

export type MessageKey = keyof typeof englishMessages;
export type ExtensionLanguage = "en" | "sv";

type Message = {
  message: string;
  placeholders?: Record<string, { content: string }>;
};

export function resolveExtensionLanguage(locale: string): ExtensionLanguage {
  return /^sv(?:[-_]|$)/i.test(locale.trim()) ? "sv" : "en";
}

export function getExtensionLanguage(): ExtensionLanguage {
  return resolveExtensionLanguage(browser.i18n.getUILanguage());
}

export function getMessage(
  key: MessageKey,
  substitutions?: string | string[],
): string {
  const localized = browser.i18n.getMessage(key, substitutions);
  if (localized?.trim()) return localized;

  // The browser normally uses default_locale. Keep an English fallback for
  // empty translated entries as well, so a control never loses its label.
  const entry: Message = englishMessages[key];
  const values = typeof substitutions === "string"
    ? [substitutions]
    : substitutions ?? [];

  return entry.message.replace(/\$([A-Z_]+)\$/gi, (token, name: string) => {
    const placeholder = entry.placeholders?.[name.toLowerCase()];
    if (!placeholder) return token;
    return placeholder.content.replace(/\$(\d+)/g, (_match, index: string) =>
      values[Number(index) - 1] ?? "",
    );
  });
}

export function localizeDocument(
  document: Document,
  titleKey: MessageKey = "extensionName",
) {
  document.documentElement.lang = getExtensionLanguage();
  document.title = getMessage(titleKey);
}
