import {
  appendActivationScanText,
  hasCurrencyActivationSignal,
  normalizeActivationScanText,
} from "../../test-dist/entrypoints/content/activationSignal.js";

test("currency activation signal detects prices without accepting generic status text", () => {
  expect(hasCurrencyActivationSignal("$129.99")).toBe(true);
  expect(hasCurrencyActivationSignal("USD 129.99")).toBe(true);
  expect(hasCurrencyActivationSignal("129.99 EUR")).toBe(true);
  expect(hasCurrencyActivationSignal("￥39,000")).toBe(true);
  expect(hasCurrencyActivationSignal("API 200 OK")).toBe(false);
});

test("currency activation signal keeps parser-only symbols out", () => {
  expect(hasCurrencyActivationSignal("₽ 100")).toBe(false);
  expect(hasCurrencyActivationSignal("₿ 0.25")).toBe(false);
  expect(hasCurrencyActivationSignal("ر.س 50")).toBe(false);
});

test("activation scan text normalization collapses whitespace", () => {
  expect(normalizeActivationScanText("  Plans\n\tstart   at  $19  ")).toBe(
    "Plans start at $19",
  );
});

test("activation rolling text keeps a 512-character suffix", () => {
  const prefix = "x".repeat(520);
  const rollingText = appendActivationScanText(prefix, "USD 19");

  expect(rollingText).toHaveLength(512);
  expect(rollingText.endsWith("USD 19")).toBe(true);
  expect(hasCurrencyActivationSignal(rollingText)).toBe(true);
});
