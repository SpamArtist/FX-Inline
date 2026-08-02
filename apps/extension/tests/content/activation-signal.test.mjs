import {
  appendActivationScanText,
  hasCurrencyActivationSignal,
  normalizeActivationScanText,
} from "../../test-dist/entrypoints/content/activationSignal.js";
import { parseCurrencyValue } from "../../test-dist/utils/utils.js";

const AMBIGUOUS_ISO_CODES = [
  "ALL",
  "TOP",
  "TRY",
  "MAD",
  "BAM",
  "BOB",
  "COP",
  "CUP",
  "GEL",
  "PEN",
];

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

test("ISO activation accepts case variants, compact forms, and NFKC tokens", () => {
  expect(hasCurrencyActivationSignal("usd 129.99")).toBe(true);
  expect(hasCurrencyActivationSignal("129.99 eur")).toBe(true);
  expect(hasCurrencyActivationSignal("USD100")).toBe(true);
  expect(hasCurrencyActivationSignal("100eur")).toBe(true);
  expect(hasCurrencyActivationSignal("ＵＳＤ 100")).toBe(true);
});

test("ISO activation uses Unicode letter boundaries", () => {
  expect(hasCurrencyActivationSignal("planUSD 100")).toBe(false);
  expect(hasCurrencyActivationSignal("USDplan 100")).toBe(false);
  expect(hasCurrencyActivationSignal("κόσμοςUSD 100")).toBe(false);
  expect(hasCurrencyActivationSignal("USDκόσμος 100")).toBe(false);
});

test("ambiguous ISO codes never create activation signals", () => {
  for (const code of AMBIGUOUS_ISO_CODES) {
    for (const variant of [code, code.toLowerCase(), `${code[0]}${code.slice(1).toLowerCase()}`]) {
      expect(hasCurrencyActivationSignal(`${variant} 100`)).toBe(false);
      expect(hasCurrencyActivationSignal(`100 ${variant}`)).toBe(false);
    }

    expect(parseCurrencyValue(`${code} 100`)).toMatchObject({
      valid: true,
      value: 100,
      currency: code,
    });
  }
});

test("ISO activation inspects only the 64-character token context", () => {
  expect(hasCurrencyActivationSignal(`USD${".".repeat(63)}1`)).toBe(true);
  expect(hasCurrencyActivationSignal(`USD${".".repeat(64)}1`)).toBe(false);
  expect(hasCurrencyActivationSignal(`1${".".repeat(63)}EUR`)).toBe(true);
  expect(hasCurrencyActivationSignal(`1${".".repeat(64)}EUR`)).toBe(false);
});
