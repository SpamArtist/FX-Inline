import assert from "node:assert/strict";
import test from "node:test";

import { createCurrencyParser } from "../src/index.js";

test("createCurrencyParser returns a frozen parser instance", () => {
  const parser = createCurrencyParser();
  assert.equal(Object.isFrozen(parser), true);
  assert.equal(typeof parser.parseValue, "function");
  assert.equal(typeof parser.extractMatches, "function");
  assert.equal(typeof parser.mayContainCurrencyToken, "function");
  assert.equal(typeof parser.hasThousandMagnitudeHint, "function");
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
  assert.deepStrictEqual(beforeMutation, afterMutation);
  assert.equal(afterMutation.currency, "USD");
});

test("createCurrencyParser rejects invalid extraIsoCodes format", () => {
  assert.throws(
    () => createCurrencyParser({ extraIsoCodes: ["US"] }),
    /extraIsoCodes/i,
  );
  assert.throws(
    () => createCurrencyParser({ extraIsoCodes: ["usd"] }),
    /extraIsoCodes/i,
  );
});

test("createCurrencyParser rejects overriding built-in tokens", () => {
  assert.throws(
    () => createCurrencyParser({ extraSymbols: { "$": "EUR" } }),
    /extraSymbols/i,
  );
  assert.throws(
    () => createCurrencyParser({ extraWords: { yen: "USD" } }),
    /extraWords/i,
  );
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

  assert.equal(bucks.valid, true);
  assert.equal(bucks.currency, "USD");
  assert.equal(symbol.valid, true);
  assert.equal(symbol.currency, "INR");
  assert.equal(iso.valid, true);
  assert.equal(iso.currency, "XYZ");
  assert.equal(magnitude.valid, true);
  assert.equal(magnitude.value, 2_000_000);
});
