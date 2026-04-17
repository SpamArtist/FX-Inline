import { expect, test } from "@jest/globals";

import { createCurrencyParser } from "../src/index.js";

test("createCurrencyParser returns a frozen parser instance", () => {
  const parser = createCurrencyParser();
  expect(Object.isFrozen(parser)).toBe(true);
  expect(typeof parser.parseValue).toBe("function");
  expect(typeof parser.extractMatches).toBe("function");
  expect(typeof parser.mayContainCurrencyToken).toBe("function");
  expect(typeof parser.hasThousandMagnitudeHint).toBe("function");
});

test("parser behavior is immutable after caller mutates config object", () => {
  const config = {
    extraWords: {
      bucks: "USD",
    },
  };

  const parser = createCurrencyParser(config);
  const beforeMutation = parser.parseValue("bucks 10");

  config.extraWords.bucks = "EUR";

  const afterMutation = parser.parseValue("bucks 10");
  expect(beforeMutation).toEqual(afterMutation);
  expect(afterMutation.currency).toBe("USD");
});

test("createCurrencyParser rejects invalid extraIsoCodes format", () => {
  expect(
    () => createCurrencyParser({ extraIsoCodes: ["US"] }),
  ).toThrow(/extraIsoCodes/i);
  expect(
    () => createCurrencyParser({ extraIsoCodes: ["usd"] }),
  ).toThrow(/extraIsoCodes/i);
});

test("createCurrencyParser rejects overriding built-in tokens", () => {
  expect(
    () => createCurrencyParser({ extraSymbols: { "$": "EUR" } }),
  ).toThrow(/extraSymbols/i);
  expect(
    () => createCurrencyParser({ extraWords: { yen: "USD" } }),
  ).toThrow(/extraWords/i);
});

test("createCurrencyParser supports additive runtime extension tokens", () => {
  const parser = createCurrencyParser({
    extraWords: {
      bucks: "USD",
    },
    extraSymbols: {
      "₹₹": "INR",
    },
    extraIsoCodes: ["XYZ"],
    extraMagnitudeProfiles: [
      {
        locale: "x-test",
        entries: [
          {
            multiplier: 1_000_000,
            aliases: ["mega"],
          },
        ],
      },
    ],
  });

  const bucks = parser.parseValue("bucks 20");
  const symbol = parser.parseValue("₹₹ 10");
  const iso = parser.parseValue("XYZ 9");
  const magnitude = parser.parseValue("USD 2 mega", { localeHint: "x-test" });

  expect(bucks.valid).toBe(true);
  expect(bucks.currency).toBe("USD");
  expect(symbol.valid).toBe(true);
  expect(symbol.currency).toBe("INR");
  expect(iso.valid).toBe(true);
  expect(iso.currency).toBe("XYZ");
  expect(magnitude.valid).toBe(true);
  expect(magnitude.value).toBe(2_000_000);
});
