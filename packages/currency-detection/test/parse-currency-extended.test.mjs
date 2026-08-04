import { expect, test } from "@jest/globals";

import {
  createCurrencyParser,
  extractCurrencyTextMatches,
  hasThousandMagnitudeHint,
  mayContainCurrencyToken,
  parseCurrencyValue,
} from "../src/index.js";

test("parseCurrencyValue handles signs, separators, and lowercase iso", () => {
  const cases = [
    ["$1,234.56", true, 1234.56, "USD"],
    ["eur-42.5", true, -42.5, "EUR"],
    ["+150 usd", true, 150, "USD"],
    ["42.5eur", true, 42.5, "EUR"],
    ["JPY 1,234", true, 1234, "JPY"],
    ["yen 1,234", true, 1234, "JPY"],
    ["YÊN 1,234", true, 1234, "JPY"],
    ["1,234 yên", true, 1234, "JPY"],
    ["¥6M", true, 6000000, "JPY"],
    ["¥6m", true, 6000000, "JPY"],
    ["¥6M+", true, 6000000, "JPY"],
    ["USD 350+", true, 350, "USD"],
    ["USD 1.2 million", true, 1200000, "USD"],
    ["2 billions USD", true, 2000000000, "USD"],
    ["₫ 4.295 trillion", true, 4295000000000, "VND"],
    ["USD 1.5 triliun", true, 1500000000000, "USD"],
    ["₫ 1 nghìn tỷ", true, 1000000000000, "VND"],
    ["VND 1 ngan ty", true, 1000000000000, "VND"],
    ["1 000 000 ₫", true, 1000000, "VND"],
    ["1\u00A0000\u00A0000\u00A0₫", true, 1000000, "VND"],
  ];

  for (const [input, valid, value, currency] of cases) {
    const parsed = parseCurrencyValue(input);
    expect(parsed.valid).toBe(valid);
    expect(parsed.value).toBe(value);
    expect(parsed.currency).toBe(currency);
  }
});

test("parseCurrencyValue supports composite dollar symbols", () => {
  const cases = [
    ["R$ 10", 10, "BRL"],
    ["10R$", 10, "BRL"],
    ["RD$ 40", 40, "DOP"],
    ["40 RD$", 40, "DOP"],
    ["A$3", 3, "AUD"],
    ["AU$ 4", 4, "AUD"],
    ["CA$ 5", 5, "CAD"],
    ["NZ$6", 6, "NZD"],
    ["HK$7", 7, "HKD"],
    ["MX$8", 8, "MXN"],
    ["NT$9", 9, "TWD"],
    ["US$10", 10, "USD"],
    ["EC$11", 11, "XCD"],
  ];

  for (const [input, value, currency] of cases) {
    const parsed = parseCurrencyValue(input);
    expect(parsed.valid).toBe(true);
    expect(parsed.value).toBe(value);
    expect(parsed.currency).toBe(currency);
  }
});

test("parseCurrencyValue normalizes compatibility/full-width currency symbols", () => {
  const cases = [
    ["￥39,000", 39000, "JPY"],
    ["＄100", 100, "USD"],
    ["￡200", 200, "GBP"],
    ["￦3000", 3000, "KRW"],
    ["￠50", 50, "USD"],
    ["﹩75", 75, "USD"],
  ];

  for (const [input, value, currency] of cases) {
    const parsed = parseCurrencyValue(input);
    expect(parsed.valid).toBe(true);
    expect(parsed.value).toBe(value);
    expect(parsed.currency).toBe(currency);
  }
});

test("parseCurrencyValue supports lakh/lac/crore/cr with currency prefix and suffix", () => {
  const cases = [
    ["1 Lakh INR", 100000, "INR"],
    ["1 Lac INR", 100000, "INR"],
    ["INR 1 Lakh", 100000, "INR"],
    ["INR 1 Lac", 100000, "INR"],
    ["1 Crore INR", 10000000, "INR"],
    ["1 Cr INR", 10000000, "INR"],
    ["INR 1 Crore", 10000000, "INR"],
    ["INR 1 Cr", 10000000, "INR"],
  ];

  for (const [input, value, currency] of cases) {
    const parsed = parseCurrencyValue(input);
    expect(parsed.valid).toBe(true);
    expect(parsed.value).toBe(value);
    expect(parsed.currency).toBe(currency);
  }
});

test("parseCurrencyValue rejects malformed or incomplete values", () => {
  const invalids = ["USD", "and 100", "100..50", "foo bar", "12.3.4 USD"];

  for (const input of invalids) {
    const parsed = parseCurrencyValue(input);
    expect(parsed.valid).toBe(false);
  }
});

test("parseCurrencyValue rejects comma-delimited prose before ISO words", () => {
  const parsed = parseCurrencyValue("27, all");
  expect(parsed.valid).toBe(false);

  const matches = extractCurrencyTextMatches("From March 13 to 27, all users");
  expect(matches).toHaveLength(0);
});

test("extractCurrencyTextMatches ignores lowercase/titlecase word-like ISO codes", () => {
  const matches = extractCurrencyTextMatches(
    "Top 10 and all 5 and try 3 with 8 mad and 12 top picks",
  );

  expect(matches).toHaveLength(0);
});

test("extractCurrencyTextMatches keeps uppercase word-like ISO codes", () => {
  const matches = extractCurrencyTextMatches(
    "TOP 10 and ALL 5 and TRY 3 with 8 MAD for fares",
  );

  expect(matches).toHaveLength(4);
  expect(matches.map((match) => match.currency)).toEqual([
    "TOP",
    "ALL",
    "TRY",
    "MAD",
  ]);
  expect(matches.map((match) => match.value)).toEqual([10, 5, 3, 8]);
});

test("extractCurrencyTextMatches ignores non-ISO words and catches real currencies", () => {
  const matches = extractCurrencyTextMatches(
    "Words and 200 apples; offer usd 30 and ₹50 now",
  );

  expect(matches).toHaveLength(2);
  expect(matches[0].currency).toBe("USD");
  expect(matches[0].value).toBe(30);
  expect(matches[1].value).toBe(50);
});

test("extractCurrencyTextMatches supports mixed symbol and ISO snippets", () => {
  const matches = extractCurrencyTextMatches("Deal: £99.99 then 120 CAD and 10€");

  expect(matches).toHaveLength(3);
  expect(matches[0].value).toBe(99.99);
  expect(matches[1].currency).toBe("CAD");
  expect(matches[2].value).toBe(10);
});

test("extractCurrencyTextMatches keeps ordered non-range match facts", () => {
  const text = "Deal: USD 12 | €34 | 56 yen | ₹ 7.5 crore";
  const matches = extractCurrencyTextMatches(text);

  expect(matches).toEqual([
    {
      raw: "USD 12 ",
      start: 6,
      end: 13,
      value: 12,
      currency: "USD",
    },
    {
      raw: "€34 ",
      start: 15,
      end: 19,
      value: 34,
      currency: "EUR",
    },
    {
      raw: "56 yen",
      start: 21,
      end: 27,
      value: 56,
      currency: "JPY",
    },
    {
      raw: "₹ 7.5 crore",
      start: 30,
      end: 41,
      value: 75_000_000,
      currency: "INR",
    },
  ]);
});

test("custom parser config uses ordered non-range extraction", () => {
  const parser = createCurrencyParser({
    extraWords: {
      bucks: "USD",
    },
    extraSymbols: {
      "@@": "AUD",
    },
    extraIsoCodes: ["XYZ"],
    extraMagnitudeProfiles: [
      {
        locale: "x-team",
        entries: [
          {
            multiplier: 1_000_000,
            aliases: ["mega"],
          },
        ],
      },
    ],
  });

  const matches = parser.extractMatches("Custom: bucks 2 mega | XYZ 3 | @@4", {
    localeHint: "x-team",
  });

  expect(matches).toEqual([
    {
      raw: "bucks 2 mega",
      start: 8,
      end: 20,
      value: 2_000_000,
      currency: "USD",
    },
    {
      raw: "XYZ 3 ",
      start: 23,
      end: 29,
      value: 3,
      currency: "XYZ",
    },
    {
      raw: "@@4",
      start: 31,
      end: 34,
      value: 4,
      currency: "AUD",
    },
  ]);
});

test("extractCurrencyTextMatches supports yen word aliases", () => {
  const matches = extractCurrencyTextMatches("Comp: yen 6M and 13,000 yên");

  expect(matches).toHaveLength(2);
  expect(matches[0].currency).toBe("JPY");
  expect(matches[0].value).toBe(6000000);
  expect(matches[1].currency).toBe("JPY");
  expect(matches[1].value).toBe(13000);
});

test("extractCurrencyTextMatches supports yen/month suffix snippets", () => {
  const matches = extractCurrencyTextMatches("Rent starts from 990,000 yen/month");

  expect(matches).toHaveLength(1);
  expect(matches[0].currency).toBe("JPY");
  expect(matches[0].value).toBe(990000);
});

test("extractCurrencyTextMatches supports composite dollar symbols", () => {
  const matches = extractCurrencyTextMatches(
    "Rates: R$ 10 | RD$ 20 | A$3 | AU$4 | CA$5 | NZ$6 | HK$7 | MX$8 | NT$9 | US$10 | EC$11 | $12",
  );

  expect(matches).toHaveLength(12);
  expect(matches.map((match) => match.currency)).toEqual([
    "BRL",
    "DOP",
    "AUD",
    "AUD",
    "CAD",
    "NZD",
    "HKD",
    "MXN",
    "TWD",
    "USD",
    "XCD",
    "USD",
  ]);
  expect(matches.map((match) => match.value)).toEqual([
    10,
    20,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
  ]);
});

test("extractCurrencyTextMatches supports unicode compatibility symbol snippets", () => {
  const matches = extractCurrencyTextMatches("Main ￥39,000 and fallback ﹩125");

  expect(matches).toHaveLength(2);
  expect(matches[0].raw.trim()).toBe("￥39,000");
  expect(matches[0].currency).toBe("JPY");
  expect(matches[0].value).toBe(39000);
  expect(matches[1].raw.trim()).toBe("﹩125");
  expect(matches[1].currency).toBe("USD");
  expect(matches[1].value).toBe(125);
});

test("extractCurrencyTextMatches prefers composite tokens over plain dollar", () => {
  const matches = extractCurrencyTextMatches("Promo: R$100 then $200");

  expect(matches).toHaveLength(2);
  expect(matches[0].raw.trim()).toBe("R$100");
  expect(matches[0].currency).toBe("BRL");
  expect(matches[0].value).toBe(100);
  expect(matches[1].raw.trim()).toBe("$200");
  expect(matches[1].currency).toBe("USD");
  expect(matches[1].value).toBe(200);
});

test("extractCurrencyTextMatches supports compact ISO prices in YouTube-style text", () => {
  const matches = extractCurrencyTextMatches(
    "200USD/month Coliving in Da Nang and USD350/week",
  );

  expect(matches).toHaveLength(2);
  expect(matches[0].currency).toBe("USD");
  expect(matches[0].value).toBe(200);
  expect(matches[1].currency).toBe("USD");
  expect(matches[1].value).toBe(350);
});

test("extractCurrencyTextMatches ignores social handles and usernames that resemble prices", () => {
  const matches = extractCurrencyTextMatches(
    "Twitter handles @kes11av and kes11buddy should stay untouched, but USD350/week and KES 11 are valid prices.",
  );

  expect(matches).toHaveLength(2);
  expect(matches.map((match) => match.raw.trim())).toEqual([
    "USD350",
    "KES 11",
  ]);
  expect(matches.map((match) => match.currency)).toEqual(["USD", "KES"]);
  expect(matches.map((match) => match.value)).toEqual([350, 11]);
});

test("extractCurrencyTextMatches parses large VND listing price snippets", () => {
  const matches = extractCurrencyTextMatches("₫ 45,000,000 / month");

  expect(matches).toHaveLength(1);
  expect(matches[0].currency).toBe("VND");
  expect(matches[0].value).toBe(45000000);
});

test("extractCurrencyTextMatches parses grouped spaces with trailing currency symbol", () => {
  const text = "Mais de 1\u00A0000\u00A0000\u00A0₫ por pessoa";
  const matches = extractCurrencyTextMatches(text);

  expect(matches).toHaveLength(1);
  expect(matches[0].raw).toBe("1\u00A0000\u00A0000\u00A0₫");
  expect(matches[0].currency).toBe("VND");
  expect(matches[0].value).toBe(1000000);
});

test("extractCurrencyTextMatches parses word magnitudes in listing snippets", () => {
  const matches = extractCurrencyTextMatches("Median price ₫ 4.295 billion");

  expect(matches).toHaveLength(1);
  expect(matches[0].currency).toBe("VND");
  expect(matches[0].value).toBe(4295000000);
});

test("extractCurrencyTextMatches parses localized magnitude words", () => {
  const matches = extractCurrencyTextMatches(
    "Mức giá từ ₫ 3.65 tỷ đến ₫ 4.2 tỷ, có thể lên USD 2 miliar",
  );

  expect(matches).toHaveLength(3);
  expect(matches[0].currency).toBe("VND");
  expect(matches[0].value).toBe(3650000000);
  expect(matches[1].currency).toBe("VND");
  expect(matches[1].value).toBe(4200000000);
  expect(matches[2].currency).toBe("USD");
  expect(matches[2].value).toBe(2000000000);
});

test("extractCurrencyTextMatches parses compact magnitude ranges in social text", () => {
  const matches = extractCurrencyTextMatches(
    "🇯🇵 Salary: ¥6M–¥13M | Hiring: Application Engineer",
  );

  expect(matches).toHaveLength(2);
  expect(matches[0].raw).toBe("¥6M");
  expect(matches[0].currency).toBe("JPY");
  expect(matches[0].value).toBe(6000000);
  expect(matches[1].raw).toBe("¥13M");
  expect(matches[1].currency).toBe("JPY");
  expect(matches[1].value).toBe(13000000);
});

test("extractCurrencyTextMatches parses compact values with trailing plus", () => {
  const matches = extractCurrencyTextMatches("Comp range starts at ¥6M+ base");

  expect(matches).toHaveLength(1);
  expect(matches[0].raw).toBe("¥6M+");
  expect(matches[0].currency).toBe("JPY");
  expect(matches[0].value).toBe(6000000);
});

test("extractCurrencyTextMatches parses shared-magnitude ranges with one currency token", () => {
  const matches = extractCurrencyTextMatches("Compensation: ¥6-13M base");

  expect(matches).toHaveLength(1);
  expect(matches[0].raw).toBe("¥6-13M");
  expect(matches[0].currency).toBe("JPY");
  expect(matches[0].value).toBe(6000000);
  expect(matches[0].rangeEndValue).toBe(13000000);
});

test("extractCurrencyTextMatches preserves dual-token range parity", () => {
  const matches = extractCurrencyTextMatches(
    "Salary range: ¥6M–¥13M plus bonus",
  );

  expect(matches).toEqual([
    {
      raw: "¥6M",
      start: 14,
      end: 17,
      value: 6_000_000,
      currency: "JPY",
    },
    {
      raw: "¥13M",
      start: 18,
      end: 22,
      value: 13_000_000,
      currency: "JPY",
    },
  ]);
});

test("extractCurrencyTextMatches ignores year-range carryover before real prices", () => {
  const matches = extractCurrencyTextMatches("Revenue; 2023-24 $446,641,957.");

  expect(matches).toHaveLength(1);
  expect(matches[0].currency).toBe("USD");
  expect(matches[0].value).toBe(446641957);
  expect(matches[0].raw.startsWith("$446,641,957")).toBe(true);
});

test("extractCurrencyTextMatches parses mixed lakh/lac/crore/cr snippets", () => {
  const matches = extractCurrencyTextMatches(
    "Examples: 1 Lakh INR, 1 Lac INR, INR 1 Lakh, INR 1 Lac, 1 Crore INR, 1 Cr INR, INR 1 Crore, INR 1 Cr.",
  );

  expect(matches).toHaveLength(8);
  expect(matches.map((match) => match.currency)).toEqual([
    "INR",
    "INR",
    "INR",
    "INR",
    "INR",
    "INR",
    "INR",
    "INR",
  ]);
  expect(matches.map((match) => match.value)).toEqual([
    100000,
    100000,
    100000,
    100000,
    10000000,
    10000000,
    10000000,
    10000000,
  ]);
});

test("mayContainCurrencyToken quickly filters non-currency text", () => {
  expect(mayContainCurrencyToken("No price here")).toBe(false);
  expect(mayContainCurrencyToken("Release notes for 2026")).toBe(false);
  expect(mayContainCurrencyToken("$$$")).toBe(false);

  expect(mayContainCurrencyToken("Budget is $300")).toBe(true);
  expect(mayContainCurrencyToken("Offer: eur 120")).toBe(true);
  expect(mayContainCurrencyToken("Package: ¥6M")).toBe(true);
  expect(mayContainCurrencyToken("Comp starts at yen 6M")).toBe(true);
  expect(mayContainCurrencyToken("Comp starts at yên 6M")).toBe(true);
  expect(mayContainCurrencyToken("Rent is ￥39,000")).toBe(true);
  expect(mayContainCurrencyToken("Offer ﹩75 only")).toBe(true);
  expect(mayContainCurrencyToken("الدفع د.إ 4500")).toBe(true);
});

test("unicode symbol normalization does not enable full-width digits or full-width ISO", () => {
  const fullWidthDigits = parseCurrencyValue("￥３９，０００");
  expect(fullWidthDigits.valid).toBe(false);

  const fullWidthIso = parseCurrencyValue("ＪＰＹ 39000");
  expect(fullWidthIso.valid).toBe(false);

  const matches = extractCurrencyTextMatches(
    "Unsupported: ￥３９，０００ and ＪＰＹ 39000",
  );
  expect(matches).toHaveLength(0);
  expect(mayContainCurrencyToken("￥３９，０００")).toBe(false);
  expect(mayContainCurrencyToken("ＪＰＹ 39000")).toBe(false);
});

test("hasThousandMagnitudeHint detects K-style magnitudes only when tied to a number", () => {
  expect(hasThousandMagnitudeHint("USD 100K")).toBe(true);
  expect(hasThousandMagnitudeHint("Comp: ¥6K-¥13K")).toBe(true);
  expect(hasThousandMagnitudeHint("Comp: ¥6-13K")).toBe(true);

  expect(hasThousandMagnitudeHint("SEK 100")).toBe(false);
  expect(hasThousandMagnitudeHint("PKR 5000")).toBe(false);
  expect(hasThousandMagnitudeHint("No magnitude here")).toBe(false);
});

test("locale profiles parse localized magnitudes with localeHint", () => {
  const viParsed = parseCurrencyValue("₫ 3.65 tỷ", { localeHint: "vi-VN" });
  const enParsed = parseCurrencyValue("₫ 3.65 tỷ", { localeHint: "en-US" });

  expect(viParsed.valid).toBe(true);
  expect(viParsed.value).toBe(3650000000);
  expect(viParsed.currency).toBe("VND");

  expect(enParsed.valid).toBe(false);
});

test("locale profiles support Chinese, Korean, Marathi, and Azerbaijani scales", () => {
  const zhParsed = parseCurrencyValue("CNY 3.2亿", { localeHint: "zh-CN" });
  const koParsed = parseCurrencyValue("KRW 7억", { localeHint: "ko-KR" });
  const mrParsed = parseCurrencyValue("INR 2 कोटी", { localeHint: "mr-IN" });
  const azParsed = parseCurrencyValue("AZN 1.5 milyard", { localeHint: "az-AZ" });

  expect(zhParsed.valid).toBe(true);
  expect(zhParsed.currency).toBe("CNY");
  expect(zhParsed.value).toBe(320000000);

  expect(koParsed.valid).toBe(true);
  expect(koParsed.currency).toBe("KRW");
  expect(koParsed.value).toBe(700000000);

  expect(mrParsed.valid).toBe(true);
  expect(mrParsed.currency).toBe("INR");
  expect(mrParsed.value).toBe(20000000);

  expect(azParsed.valid).toBe(true);
  expect(azParsed.currency).toBe("AZN");
  expect(azParsed.value).toBe(1500000000);
});
