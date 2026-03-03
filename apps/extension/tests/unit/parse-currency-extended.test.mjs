import {
  parseCurrencyValue,
  extractCurrencyTextMatches,
} from "../../test-dist/utils/utils.js";

test("parseCurrencyValue handles signs, separators, and lowercase iso", () => {
  const cases = [
    ["$1,234.56", true, 1234.56, "USD"],
    ["eur-42.5", true, -42.5, "EUR"],
    ["+150 usd", true, 150, "USD"],
    ["42.5eur", true, 42.5, "EUR"],
    ["JPY 1,234", true, 1234, "JPY"],
    ["¥6M", true, 6000000, "JPY"],
    ["USD 1.2 million", true, 1200000, "USD"],
    ["2 billions USD", true, 2000000000, "USD"],
    ["₫ 4.295 trillion", true, 4295000000000, "VND"],
    ["USD 1.5 triliun", true, 1500000000000, "USD"],
    ["₫ 1 nghìn tỷ", true, 1000000000000, "VND"],
    ["VND 1 ngan ty", true, 1000000000000, "VND"],
  ];

  for (const [input, valid, value, currency] of cases) {
    const parsed = parseCurrencyValue(input);
    expect(parsed.valid).toBe(valid);
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

test("extractCurrencyTextMatches parses large VND listing price snippets", () => {
  const matches = extractCurrencyTextMatches("₫ 45,000,000 / month");

  expect(matches).toHaveLength(1);
  expect(matches[0].currency).toBe("VND");
  expect(matches[0].value).toBe(45000000);
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
