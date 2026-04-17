import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const constantsPath = path.join(repoRoot, "apps/extension/utils/constants.ts");
const fixturesPath = path.join(
  repoRoot,
  "packages/currency-detection/test/fixtures/parity-cases.json",
);

function parseQuotedArray(sectionText) {
  return Array.from(sectionText.matchAll(/"([^"]+)"/g), (match) => match[1]);
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

const constantsSource = await readFile(constantsPath, "utf8");

const isoSectionMatch = constantsSource.match(
  /export const ISO_CODES = new Set\(\[(?<body>[\s\S]*?)\]\);/u,
);
if (!isoSectionMatch?.groups?.body) {
  throw new Error("Could not parse ISO_CODES from constants.ts");
}

const symbolSectionMatch = constantsSource.match(
  /export const CURRENCY_SYMBOLS = new Set\(\[(?<body>[\s\S]*?)\]\);/u,
);
if (!symbolSectionMatch?.groups?.body) {
  throw new Error("Could not parse CURRENCY_SYMBOLS from constants.ts");
}

const isoCodes = parseQuotedArray(isoSectionMatch.groups.body);
const symbols = parseQuotedArray(symbolSectionMatch.groups.body);

const parseSeedInputs = [
  "100",
  "USD 100",
  "100 USD",
  "$100",
  "100$",
  "USD100",
  "100USD",
  "usd 100",
  "yen 100",
  "EUR 12,5",
  "USD 4.295 billion",
  "4.295 billion USD",
  "₫ 4.295 billion",
  "₫ 3.65 tỷ",
  "VND 850 triệu",
  "USD 2 miliar",
  "₫3.65tỷ",
  "foo",
  "$1,234.56",
  "eur-42.5",
  "+150 usd",
  "42.5eur",
  "JPY 1,234",
  "yen 1,234",
  "YÊN 1,234",
  "1,234 yên",
  "¥6M",
  "¥6m",
  "¥6M+",
  "USD 350+",
  "USD 1.2 million",
  "2 billions USD",
  "₫ 4.295 trillion",
  "USD 1.5 triliun",
  "₫ 1 nghìn tỷ",
  "VND 1 ngan ty",
  "1 000 000 ₫",
  "1\u00A0000\u00A0000\u00A0₫",
  "27, all",
  "￥39,000",
  "＄100",
  "￡200",
  "￦3000",
  "￠50",
  "﹩75",
  "￥３９，０００",
  "ＪＰＹ 39000",
  "1 Lakh INR",
  "INR 1 Cr",
  "USD",
  "and 100",
  "100..50",
  "foo bar",
  "12.3.4 USD",
];

const extractSeedInputs = [
  "Deal: $100 and 200 eur today",
  "Median price: ₫ 4.295 billion and backup USD 2 million and EUR 3 trillions and VND 1.2 tỷ",
  "Top 10 and all 5 and try 3 with 8 mad and 12 top picks",
  "TOP 10 and ALL 5 and TRY 3 with 8 MAD for fares",
  "Words and 200 apples; offer usd 30 and ₹50 now",
  "Deal: £99.99 then 120 CAD and 10€",
  "Comp: yen 6M and 13,000 yên",
  "Rent starts from 990,000 yen/month",
  "Rates: R$ 10 | RD$ 20 | A$3 | AU$4 | CA$5 | NZ$6 | HK$7 | MX$8 | NT$9 | US$10 | EC$11 | $12",
  "Main ￥39,000 and fallback ﹩125",
  "Promo: R$100 then $200",
  "200USD/month Coliving in Da Nang and USD350/week",
  "Twitter handles @kes11av and kes11buddy should stay untouched, but USD350/week and KES 11 are valid prices.",
  "₫ 45,000,000 / month",
  "Mais de 1\u00A0000\u00A0000\u00A0₫ por pessoa",
  "Median price ₫ 4.295 billion",
  "Mức giá từ ₫ 3.65 tỷ đến ₫ 4.2 tỷ, có thể lên USD 2 miliar",
  "🇯🇵 Salary: ¥6M–¥13M | Hiring: Application Engineer",
  "Comp range starts at ¥6M+ base",
  "Compensation: ¥6-13M base",
  "Revenue; 2023-24 $446,641,957.",
  "Examples: 1 Lakh INR, 1 Lac INR, INR 1 Lakh, INR 1 Lac, 1 Crore INR, 1 Cr INR, INR 1 Crore, INR 1 Cr.",
  "Unsupported: ￥３９，０００ and ＪＰＹ 39000",
  "From March 13 to 27, all users",
];

const quickFilterInputs = [
  "No price here",
  "Release notes for 2026",
  "$$$",
  "Budget is $300",
  "Offer: eur 120",
  "Package: ¥6M",
  "Comp starts at yen 6M",
  "Comp starts at yên 6M",
  "Rent is ￥39,000",
  "Offer ﹩75 only",
  "الدفع د.إ 4500",
  "￥３９，０００",
  "ＪＰＹ 39000",
];

const thousandHintInputs = [
  "USD 100K",
  "Comp: ¥6K-¥13K",
  "Comp: ¥6-13K",
  "SEK 100",
  "PKR 5000",
  "No magnitude here",
];

const generatedIsoParseInputs = isoCodes.flatMap((code) => [
  `${code} 123`,
  `123 ${code}`,
  `${code}123`,
  `123${code}`,
]);

const generatedIsoExtractInputs = isoCodes.map((code) =>
  `Catalog entries include ${code} 123 in the listing.`,
);

const generatedSymbolParseInputs = symbols.flatMap((symbol) => [
  `${symbol}123`,
  `123${symbol}`,
]);

const generatedSymbolExtractInputs = symbols.map((symbol) =>
  `Promo shows ${symbol}123 as a sample amount.`,
);

const fixtures = {
  schemaVersion: 1,
  parseInputs: uniqueSorted([
    ...parseSeedInputs,
    ...generatedIsoParseInputs,
    ...generatedSymbolParseInputs,
  ]),
  extractInputs: uniqueSorted([
    ...extractSeedInputs,
    ...generatedIsoExtractInputs,
    ...generatedSymbolExtractInputs,
  ]),
  quickFilterInputs: uniqueSorted(quickFilterInputs),
  thousandHintInputs: uniqueSorted(thousandHintInputs),
};

await writeFile(fixturesPath, `${JSON.stringify(fixtures, null, 2)}\n`, "utf8");
console.info(`Wrote fixtures: ${fixturesPath}`);
console.info(`parseInputs=${fixtures.parseInputs.length}`);
console.info(`extractInputs=${fixtures.extractInputs.length}`);
