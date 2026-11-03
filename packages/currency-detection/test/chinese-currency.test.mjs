import { expect, test } from "@jest/globals";

import {
  extractCurrencyTextMatches,
  mayContainCurrencyToken,
  parseCurrencyValue,
} from "../src/index.js";

test.each([
  ["RMB 100", 100],
  ["100 RMB", 100],
  ["rmb100", 100],
  ["100rmb", 100],
  ["CN¥100", 100],
  ["100元", 100],
  ["RMB 1,234.50", 1234.5],
  ["1 234,50 RMB", 1234.5],
  ["CN¥-42.50", -42.5],
  ["100.50 元", 100.5],
  ["CNY 100", 100],
])("recognizes %s as Chinese yuan for selection and page extraction", (price, value) => {
  expect(parseCurrencyValue(price)).toEqual({ valid: true, value, currency: "CNY" });
  expect(mayContainCurrencyToken(price)).toBe(true);

  const input = `Price: ${price}; next item.`;
  const matches = extractCurrencyTextMatches(input);
  expect(matches).toHaveLength(1);
  expect(matches[0]).toEqual({
    raw: price,
    start: 7,
    end: 7 + price.length,
    value,
    currency: "CNY",
  });
});

test.each([undefined, { localeHint: "zh-CN" }])(
  "keeps plain yen symbols as JPY with options %j",
  (options) => {
    for (const price of ["¥100", "￥100"]) {
      expect(parseCurrencyValue(price, options)).toEqual({
        valid: true,
        value: 100,
        currency: "JPY",
      });
      expect(extractCurrencyTextMatches(price, options)).toEqual([
        { raw: price, start: 0, end: price.length, value: 100, currency: "JPY" },
      ]);
    }
  },
);

test("extracts Chinese and Japanese prices together without changing their sources", () => {
  const matches = extractCurrencyTextMatches("RMB 100; 100 RMB; CN¥100; 100元; ¥100");
  expect(matches.map(({ currency }) => currency)).toEqual([
    "CNY", "CNY", "CNY", "CNY", "JPY",
  ]);
});

test("RMB aliases retain existing word and username boundaries", () => {
  for (const input of ["planRMB 100", "RMBplan 100", "@RMB100"]) {
    expect(extractCurrencyTextMatches(input)).toEqual([]);
  }
});
