/** @jest-environment jsdom */

import { jest } from "@jest/globals";

const nativeGetMessage = jest.fn();
const getUILanguage = jest.fn();

jest.unstable_mockModule("wxt/browser", () => ({
  browser: { i18n: { getMessage: nativeGetMessage, getUILanguage } },
}));

const {
  resolveExtensionLanguage,
  getExtensionLanguage,
  getMessage,
  localizeDocument,
} = await import("../../test-dist/utils/i18n.js");

beforeEach(() => {
  nativeGetMessage.mockReset().mockReturnValue("");
  getUILanguage.mockReset().mockReturnValue("en-US");
  document.documentElement.lang = "en";
  document.title = "Original title";
});

test.each(["sv", "sv-SE", "sv-FI"])("%s selects Swedish", (locale) => {
  expect(resolveExtensionLanguage(locale)).toBe("sv");
  getUILanguage.mockReturnValue(locale);
  expect(getExtensionLanguage()).toBe("sv");
});

test.each(["en", "en-GB", "de-DE", "fi-FI", "", "invalid_locale_token"])(
  "%s selects English",
  (locale) => {
    expect(resolveExtensionLanguage(locale)).toBe("en");
  },
);

test("native browser messages receive substitutions and keep translated word order", () => {
  // This message is test data. The user provides production translations.
  nativeGetMessage.mockReturnValue("SEK är vald [test]");

  expect(getMessage("preferredCurrencyUpdated", ["SEK"])).toBe("SEK är vald [test]");
  expect(nativeGetMessage).toHaveBeenCalledWith("preferredCurrencyUpdated", ["SEK"]);
});

test.each(["", undefined])("missing native message %s falls back to English", (missing) => {
  nativeGetMessage.mockReturnValue(missing);
  expect(getMessage("preferredCurrency")).toBe("Preferred Currency");
});

test("English fallback replaces named placeholders from string and array substitutions", () => {
  expect(getMessage("preferredCurrencyUpdated", "SEK")).toBe(
    "Preferred currency updated to SEK.",
  );
  expect(getMessage("currencyAmount", ["svensk krona"])).toBe("svensk krona amount");
  expect(getMessage("editCurrencyAmount", ["svensk krona"])).toBe(
    "Edit svensk krona amount",
  );
});

test("placeholder values remain literal text", () => {
  expect(getMessage("currencyAmount", ["$& <img src=x>"])).toBe("$& <img src=x> amount");
});

test("localizeDocument sets Swedish language and translated title", () => {
  getUILanguage.mockReturnValue("sv-SE");
  nativeGetMessage.mockReturnValue("Inställningar [test]");

  localizeDocument(document, "settingsTitle");

  expect(document.documentElement.lang).toBe("sv");
  expect(document.title).toBe("Inställningar [test]");
});

test("localizeDocument uses English title fallback and product title if no key is given", () => {
  getUILanguage.mockReturnValue("de-DE");
  localizeDocument(document, "settingsTitle");
  expect(document.documentElement.lang).toBe("en");
  expect(document.title).toBe("FX Inline Settings");

  localizeDocument(document);
  expect(document.title).toBe("FX Inline");
});
