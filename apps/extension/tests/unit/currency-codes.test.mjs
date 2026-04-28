import { ISO_CODES } from "../../test-dist/utils/constants.js";
import { CurrencyCode } from "../../test-dist/utils/enums.js";
import {
  extractCurrencyTextMatches,
  parseCurrencyValue,
} from "../../test-dist/utils/utils.js";
import { convertAmountWithSnapshot } from "../../test-dist/utils/rateMath/index.js";
import { normalizeRates } from "../../test-dist/utils/rates/validation.js";

const activeCountryCodes = ["BOB", "COP", "VES"];
const inactiveUnitCodes = ["BOV", "COU", "VED"];

test("CurrencyCode enum maps Bolivia, Colombia, and Venezuela to circulating ISO codes", () => {
  expect(CurrencyCode.BOLIVIA).toBe("BOB");
  expect(CurrencyCode.COLOMBIA).toBe("COP");
  expect(CurrencyCode.VENEZUELA).toBe("VES");
});

test("extension ISO constants include active codes and exclude non-circulating unit codes", () => {
  for (const code of activeCountryCodes) {
    expect(ISO_CODES.has(code)).toBe(true);
  }

  for (const code of inactiveUnitCodes) {
    expect(ISO_CODES.has(code)).toBe(false);
  }
});

test("extension parser wrapper accepts active country currency codes", () => {
  const parsed = activeCountryCodes.map((code) => parseCurrencyValue(`${code} 123`));

  expect(parsed).toEqual([
    { valid: true, value: 123, currency: "BOB" },
    { valid: true, value: 123, currency: "COP" },
    { valid: true, value: 123, currency: "VES" },
  ]);

  const matches = extractCurrencyTextMatches("Rates: BOB 10; COP 20; VES 30.");
  expect(matches.map((match) => match.currency)).toEqual(activeCountryCodes);
});

test("rate normalization keeps provider rates for active country currency codes", () => {
  const normalized = normalizeRates({
    BOB: 6.9,
    cop: 4000,
    VES: 37,
    BOV: 1,
    COU: 2,
    VED: 3,
  });

  expect(normalized.BOB).toBe(6.9);
  expect(normalized.COP).toBe(4000);
  expect(normalized.VES).toBe(37);
  expect(normalized.BOV).toBeUndefined();
  expect(normalized.COU).toBeUndefined();
  expect(normalized.VED).toBeUndefined();
});

test("conversion math can convert active country codes from normalized snapshots", () => {
  const snapshot = {
    rates: {
      USD: 1,
      EUR: 0.9,
      BOB: 6.9,
      COP: 4000,
      VES: 37,
    },
  };

  expect(convertAmountWithSnapshot(69, "BOB", "EUR", snapshot)).toBeCloseTo(9);
  expect(convertAmountWithSnapshot(4000, "COP", "EUR", snapshot)).toBeCloseTo(0.9);
  expect(convertAmountWithSnapshot(37, "VES", "EUR", snapshot)).toBeCloseTo(0.9);
});
