/** @jest-environment jsdom */
import { jest } from "@jest/globals";
const nativeGetMessage = jest.fn();
const getUILanguage = jest.fn();
jest.unstable_mockModule("wxt/browser", () => ({
  browser: { i18n: { getMessage: nativeGetMessage, getUILanguage } },
}));
const { resolveExtensionLanguage, getExtensionLanguage, t, localizeDocument } =
  await import("../../test-dist/utils/i18n.js");
const { messageKey } = await import("../../test-dist/utils/messageKey.js");

beforeEach(() => {
  nativeGetMessage.mockReset().mockReturnValue("");
  getUILanguage.mockReset().mockReturnValue("en-US");
});

test.each([
  ["sv-SE", "sv"], ["de-DE", "de"], ["fi-FI", "fi"], ["fr-CA", "fr"],
  ["pt_BR", "pt-BR"], ["pt-PT", "pt-PT"], ["nb-NO", "no"], ["no", "no"],
  ["uk-UA", "uk"], ["en-GB", "en"], ["ja", "en"], ["", "en"],
])("%s selects %s", (locale, expected) => {
  expect(resolveExtensionLanguage(locale)).toBe(expected);
  getUILanguage.mockReturnValue(locale);
  expect(getExtensionLanguage()).toBe(expected);
});

test("native messages receive stable hashed keys and substitutions in named order", () => {
  nativeGetMessage.mockReturnValue("EUR ← USD");
  expect(t("{from} to {to}", { to: "EUR", from: "USD" })).toBe("EUR ← USD");
  expect(nativeGetMessage).toHaveBeenCalledWith(messageKey("{from} to {to}"), ["USD", "EUR"]);
  expect(messageKey("{from} to {to}")).toMatch(/^text_[0-9a-f]{8}$/);
});

test.each(["", "   ", undefined])("missing native message %s falls back to source", (missing) => {
  nativeGetMessage.mockReturnValue(missing);
  expect(t("Preferred Currency")).toBe("Preferred Currency");
});

test("English fallback interpolates literal values, repeated names and numeric zero", () => {
  expect(t("{currency_name} amount", { currency_name: "$& <img src=x>" })).toBe("$& <img src=x> amount");
  expect(t("{value} + {value}", { value: 0 })).toBe("0 + 0");
  expect(t("{missing} amount")).toBe("{missing} amount");
});

test("document language and title follow Chrome UI language", () => {
  getUILanguage.mockReturnValue("de-DE");
  nativeGetMessage.mockReturnValue("FX Inline Einstellungen");
  localizeDocument(document, t("FX Inline Settings"));
  expect(document.documentElement.lang).toBe("de");
  expect(document.title).toBe("FX Inline Einstellungen");
  nativeGetMessage.mockReturnValue("");
  localizeDocument(document);
  expect(document.title).toBe("FX Inline");
});
