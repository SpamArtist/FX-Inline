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
  "Single sign-on with SAML 2.0",
  "99.99% uptime SLA — trusted by Fortune 500",
  "Get started for free, no credit card required",
  "Eligible for FREE Shipping with Prime",
  "Customer Reviews: 4.5 out of 5 stars",
  "Fully furnished, 2 bedrooms 1 bathroom",
  "5 minutes walk to MRT Bayfront station",
  "近鉄奈良線 徒歩5分",
  "신촌역 도보 5분",
];

const thousandHintInputs = [
  "USD 100K",
  "Comp: ¥6K-¥13K",
  "Comp: ¥6-13K",
  "SEK 100",
  "PKR 5000",
  "No magnitude here",
  "$10K MRR target by Q3",
  "100K+ monthly active users",
  "From $1K/mo to $50K/mo enterprise",
  "Save $2K annually on the Pro plan",
  "Annual contract value: $250K",
  "Plan unlocks at 100K events/month",
  "Goal: $1M ARR",
  "₹2.5L/month deposit",
];

const saasPricingParseSeeds = [
  "$0",
  "$0.00",
  "Free",
  "Custom",
  "Contact sales",
  "Starting at 2.9% + 30¢",
  "$0.50 per dispute",
  "$0.0079 per SMS",
  "$0.0085 per minute",
  "$0.023 per GB / month",
  "$0.0004 per request",
  "$2 user / month",
  "$3 per editor / month",
  "$4 per user/month",
  "$5 per editor / month",
  "$8 per user / month",
  "$8 per member/month",
  "$8.15 per user/month avg.",
  "$8.75 USD",
  "$8.75 USD per active user/month",
  "$10 per user/month",
  "$10 USD per seat / month",
  "$10.99 per user/month",
  "$10 / month",
  "$13/month",
  "$14 per user / month",
  "$15 per user/month",
  "$15 per host, per month",
  "$15/user/month",
  "$16 per user/month",
  "$16 USD per seat / month",
  "$20/month",
  "$20/month per member",
  "$20/mo per seat",
  "$21 per user/month",
  "$24.99 per user/month",
  "$25 / month",
  "$25 USD/user/month*",
  "$39/month per seat",
  "$40 / month",
  "$42 USD/user/month",
  "$70 USD/user/month",
  "$99/month per seat",
  "$150/month minimum",
  "$165 USD/user/month*",
  "$199/yr",
  "$350/month",
  "$890/mo billed annually",
  "$1,200/year",
  "$2,490 / year",
  "$3,600/mo",
  "US $14.99 /month/license",
  "US $21.99 /month/license",
  "From $19.99",
  "Starting at $25",
  "From $39/month per seat",
  "From $99/month per seat",
  "Save $50",
  "Save 20%",
  "Save $228/year",
];

const amazonByCountryParseSeeds = [
  "$24.99",
  "$1,299.00",
  "$1,799.99",
  "List Price: $79.99",
  "Save $5.00 (10%)",
  "From $19.99",
  "($0.50 / Count)",
  "($0.83 / Fl Oz)",
  "$24.99 with Subscribe & Save",
  "£24.99",
  "£1,299.00",
  "RRP: £79.99",
  "Was: £79.99",
  "(£12.49 / kg)",
  "24,99 €",
  "1.299,00 €",
  "EUR 24,99",
  "Statt 79,99 €",
  "1 299,00 €",
  "Prix conseillé : 79,99 €",
  "￥39,000",
  "￥2,498",
  "¥1,299",
  "¥39,800 税込",
  "₹1,299.00",
  "₹15,999.00",
  "M.R.P.: ₹1,799.00",
  "Deal of the Day ₹999",
  "₹2,499 (5% off)",
  "₹2.5 Lakh",
  "A$24.99",
  "A$199.99",
  "AU$1,299.00",
  "CDN$ 24.99",
  "CDN$ 379.00",
  "C$24.99",
  "R$24,99",
  "R$1.299,00",
  "R$3.799,00",
  "MX$24.99",
  "MX$24,999.00",
  "AED 1,799",
  "د.إ 1,799",
  "SAR 1,599",
  "ر.س 1,599",
  "SGD 199.99",
  "₺199,99",
  "₺7.499,00",
];

const apartmentRentalsAsiaParseSeeds = [
  "₫ 8.000.000/tháng",
  "₫ 12.500.000/tháng",
  "₫ 8.500.000",
  "8 triệu/tháng",
  "₫ 8 triệu/tháng",
  "VND 8 triệu/tháng",
  "VND 850 triệu",
  "IDR 5,000,000/bulan",
  "IDR 5 juta",
  "IDR 5 miliar",
  "IDR 8,500,000/bulan",
  "₹25,000/month",
  "₹15,000/month",
  "₹85,000/month",
  "₹2.5 Lakh/month",
  "₹2.5 Lac/month",
  "₹2.5 Lakh deposit",
  "INR 25,000/month",
  "From ₹2.5 Lakh/month",
  "SGD 3,500/month",
  "SGD 2,200/month",
  "₱25,000/month",
  "PHP 25,000/month",
  "PHP 35,000/month",
  "฿35,000/month",
  "THB 35,000/month",
  "THB 380,000/year",
  "35,000฿/month",
  "¥85,000/月",
  "￥85,000/月",
  "₩600,000/월",
  "₩800,000/월",
  "HK$15,000/month",
  "HK$18,500/month",
  "NT$20,000/月",
  "TWD 20,000",
  "CNY 8000",
  "CNY 8000/月",
  "MYR 2,500",
  "MYR 2,500/month",
];

const saasPricingExtractSeeds = [
  "Free $0 forever | Pro $10/user/month | Business $20/user/month | Enterprise contact sales",
  "Save 20% with annual billing — was $20/mo, now $16/mo for the first year",
  "Stripe charges 2.9% + 30¢ per successful card charge, plus $0.50 per dispute and $4 per recurring transfer",
  "AWS S3 starts at $0.023 per GB / month with $0.0004 per request and free egress under 100 GB",
  "Twilio SMS: $0.0079 per outbound SMS, $0.0075 per inbound, and $0.0085 per voice minute",
  "Datadog Pro $15 per host, per month billed annually — save 20% versus the $18 month-to-month rate",
  "Calendly: Free $0, Standard $10 USD per seat / month, Teams $16 USD per seat / month, Enterprise contact sales",
  "Jira Cloud Free $0 up to 10 users, Standard $8.15 per user/month avg., Premium $16 per user/month, Enterprise custom",
  "Zoom Pro at US $14.99 /month/license, Business at US $21.99 /month/license, Enterprise tiered annually",
  "Notion Free, Plus $10 per user/month, Business $15/user/month billed annually, Enterprise contact sales",
  "Slack Free, Pro $8.75 USD per active user/month, Business+ $15 per user/month, Enterprise Grid custom",
  "GitHub Team $4 per user/month, Enterprise $21 per user/month, Free for individual public repos",
  "Vercel Hobby $0, Pro $20/month per member, Enterprise $150/month minimum with custom SSO",
  "Linear Free up to 10 users, Standard $8 per user / month, Plus $14 per user / month",
  "Figma Free, Professional $3 per editor / month, Organization $5 per editor / month, Enterprise $75 per editor/month",
  "HubSpot Marketing Hub starts at $20/mo per seat, scales to $890/mo billed annually for Professional and $3,600/mo for Enterprise",
  "Salesforce Starter Suite at $25 USD/user/month* billed annually and Enterprise at $165 USD/user/month*",
  "Tableau Creator $70 USD/user/month, Explorer $42 USD/user/month, Viewer $15 USD/user/month",
  "Asana Starter $10.99 per user/month, Advanced $24.99 per user/month — billed annually saves 33%",
  "Mailchimp Essentials from $13/month for 500 contacts, Standard from $20/month, Premium from $350/month",
  "Intercom: From $39/month per seat for Essential, From $99/month per seat for Advanced, Expert custom",
  "DocuSign Personal $10 / month, Standard $25 / month, Business Pro $40 / month — first month free",
  "Notion AI add-on: $8 per member/month — switching to annual saves $96/year per member",
  "Switch to annual billing and save $228/year on the Pro plan, or $1,200/year on Business",
  "Heroku Eco $5/mo, Basic $7/mo, Standard $25-$50/mo, Performance $250-$500/mo, Private custom",
];

const amazonByCountryExtractSeeds = [
  "Apple AirPods Pro (2nd Generation): $249.00 List Price: $279.00 Save $30.00 (11%) FREE Returns",
  "Kindle Paperwhite (16 GB) $159.99 was $159.99 Save $40.00 with coupon at checkout, Prime free shipping",
  "Anker USB-C Hub 7-in-1 $34.99 ($4.99 / Count for 7) Buy 2 save 5%; Buy 3 save 10%; List Price $49.99",
  "amazon.co.uk Sony WH-1000XM5 £279.00 RRP: £379.00 You Save £100.00 (26%) Eligible for FREE Delivery",
  "amazon.co.uk Dyson V8 £329.99 was £379.99 (£12.49 / kg net) Save £50.00 limited time",
  "amazon.de Bosch Bohrer-Set 24,99 € Statt 39,99 € — Sie sparen 15,00 € (38%) inkl. MwSt.",
  "amazon.de Samsung Galaxy 1.299,00 € Unverbindliche Preisempfehlung: 1.499,00 € — Sie sparen 200,00 €",
  "amazon.fr Philips Sonicare 89,99 € Prix conseillé : 119,99 € Économisez 30,00 € livraison gratuite",
  "amazon.fr Le Creuset 24cm 1 299,00 € livraison gratuite avec Prime",
  "amazon.co.jp ソニーWF-1000XM5 ￥39,800 通常配送料無料 ¥39,800 税込 在庫あり",
  "amazon.co.jp 任天堂Switch ¥32,978 ￥39,980から お得 通常配送料無料 在庫あり",
  "amazon.in OnePlus 12R ₹39,999.00 M.R.P.: ₹45,999.00 Save: ₹6,000.00 (13%) Deal of the Day",
  "amazon.in boAt Rockerz ₹1,299.00 M.R.P.: ₹2,990.00 Save: ₹1,691.00 (57%) ₹2,499 (5% off)",
  "amazon.com.au LEGO Star Wars A$199.99 was A$249.99 You save A$50.00 with Prime free delivery",
  "amazon.com.au iPhone 15 case AU$24.99 with Prime free delivery, ships from Sydney",
  "amazon.ca Bose QC45 CDN$ 379.00 was CDN$ 429.00 You save CDN$ 50.00 free Prime shipping",
  "amazon.ca Echo Dot C$49.99 List Price: C$69.99 Save C$20.00 — Prime exclusive",
  "amazon.com.br PlayStation 5 R$3.799,00 ou em 12x de R$316,58 sem juros, frete GRÁTIS",
  "amazon.com.mx iPhone 15 MX$24,999.00 Precio de lista: MX$28,999.00 ahorras MX$4,000.00",
  "amazon.ae Apple iPad AED 1,799 was AED 2,099 You save AED 300 (14%) د.إ 1,799 free shipping",
  "amazon.sa Apple Watch Series 9 SAR 1,599 was SAR 1,899 ر.س 1,599 free returns",
  "amazon.sg LEGO Technic SGD 199.99 with free Prime shipping over SGD 40, fulfilled by Amazon SG",
  "amazon.com.tr Xiaomi Redmi ₺7.499,00 ₺8.999,00 yerine — %17 indirim, ücretsiz kargo",
  "Comparison: same model is $1,299.00 on amazon.com, £1,099.00 on amazon.co.uk, 1.299,00 € on amazon.de, ₹1,29,999 on amazon.in",
];

const apartmentRentalsAsiaExtractSeeds = [
  "Cho thuê căn hộ 2PN tại Quận 1: ₫ 12.500.000/tháng, đầy đủ nội thất, view sông Sài Gòn",
  "Mức giá từ ₫ 8 triệu/tháng đến ₫ 15 triệu/tháng cho căn hộ studio tại Quận 7, Phú Mỹ Hưng",
  "VND 850 triệu nhận căn hộ 1PN, hoặc ₫ 12.500.000/tháng cho thuê dài hạn tối thiểu 12 tháng",
  "Disewakan apartemen Sudirman 2BR: IDR 8,500,000/bulan termasuk service charge dan keamanan 24 jam",
  "Harga sewa mulai dari Rp 5 juta/bulan hingga Rp 12 juta/bulan untuk unit 1BR di Kemang Jakarta Selatan",
  "Studio Bangsar Selatan MYR 2,500/month including utilities, or RM 28,000/year if paid upfront",
  "PropertyGuru SG: 2BR Tiong Bahru SGD 3,500/month partially furnished, near Tiong Bahru MRT, 1-year lease",
  "99.co listing: studio Geylang at S$2,200/month — landlord prefers 1-year lease, 1 month deposit",
  "Anaroo Mumbai: 2BHK Bandra West ₹85,000/month, deposit ₹2.5 Lakh, available immediately, no brokerage",
  "MagicBricks Bengaluru: from ₹25,000/month for 1BHK to ₹2.5 Lac/month for 4BHK villa in Whitefield",
  "NoBroker Delhi: ₹15,000 to ₹25,000 / month for 1BHK in Lajpat Nagar; brokerage zero, semi-furnished",
  "Manila condo for rent ₱25,000/month + ₱5,000 association dues, 6-month minimum lease near MRT",
  "BGC studio PHP 35,000/month fully furnished, near Greenbelt and Uptown Mall, parking included",
  "DDProperty Bangkok ฿35,000/month for 1BR in Asok, or THB 380,000/year with 1-month free",
  "Sukhumvit 35,000฿/month furnished, BTS Phrom Phong 200m, deposit 2 months, 1-year minimum",
  "SUUMO Tokyo Shinjuku: 賃料 85,000円/月 管理費 5,000円 敷金 1ヶ月 礼金 1ヶ月 ¥85,000/月",
  "LIFULL HOME'S Osaka ￥85,000/月 + 共益費 ￥5,000/月、敷金1ヶ月、保証会社必須、駅徒歩5分",
  "Daikanyama 1LDK 8.5万円/月 + 管理費 5,000円/月 - apartment near Ebisu station",
  "Spacious HK HK$18,500/month for a 350 sqft studio in Sheung Wan, 1-year minimum, fully serviced",
  "Naver 부동산: 월세 60만원 보증금 1,000만원 신촌역 도보 5분, ₩600,000/월 관리비 별도",
  "Dabang 강남: 전세 5억원 또는 월세 80만원 보증금 2,000만원, ₩800,000/월 관리비 포함",
  "591租屋 信義區套房 NT$20,000/月 含水電網路, TWD 20,000, 押二付一, 立即看屋",
  "贝壳找房 上海 CNY 8000/月 浦东新区一居室, ¥8000/月 押一付三, 业主直租",
  "Comparison: 1BR Tokyo ¥85,000/月 vs Singapore SGD 3,500/month vs Bangkok ฿35,000/month vs Manila ₱25,000/month vs Mumbai ₹85,000/month",
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
  schemaVersion: 2,
  parseInputs: uniqueSorted([
    ...parseSeedInputs,
    ...generatedIsoParseInputs,
    ...generatedSymbolParseInputs,
    ...saasPricingParseSeeds,
    ...amazonByCountryParseSeeds,
    ...apartmentRentalsAsiaParseSeeds,
  ]),
  extractInputs: uniqueSorted([
    ...extractSeedInputs,
    ...generatedIsoExtractInputs,
    ...generatedSymbolExtractInputs,
    ...saasPricingExtractSeeds,
    ...amazonByCountryExtractSeeds,
    ...apartmentRentalsAsiaExtractSeeds,
  ]),
  quickFilterInputs: uniqueSorted(quickFilterInputs),
  thousandHintInputs: uniqueSorted(thousandHintInputs),
  realWorld: {
    saasPricing: {
      parseInputs: uniqueSorted(saasPricingParseSeeds),
      extractInputs: uniqueSorted(saasPricingExtractSeeds),
    },
    amazonByCountry: {
      parseInputs: uniqueSorted(amazonByCountryParseSeeds),
      extractInputs: uniqueSorted(amazonByCountryExtractSeeds),
    },
    apartmentRentalsAsia: {
      parseInputs: uniqueSorted(apartmentRentalsAsiaParseSeeds),
      extractInputs: uniqueSorted(apartmentRentalsAsiaExtractSeeds),
    },
  },
};

await writeFile(fixturesPath, `${JSON.stringify(fixtures, null, 2)}\n`, "utf8");
console.info(`Wrote fixtures: ${fixturesPath}`);
console.info(`parseInputs=${fixtures.parseInputs.length}`);
console.info(`extractInputs=${fixtures.extractInputs.length}`);
console.info(
  `realWorld.saasPricing parseInputs=${fixtures.realWorld.saasPricing.parseInputs.length} extractInputs=${fixtures.realWorld.saasPricing.extractInputs.length}`,
);
console.info(
  `realWorld.amazonByCountry parseInputs=${fixtures.realWorld.amazonByCountry.parseInputs.length} extractInputs=${fixtures.realWorld.amazonByCountry.extractInputs.length}`,
);
console.info(
  `realWorld.apartmentRentalsAsia parseInputs=${fixtures.realWorld.apartmentRentalsAsia.parseInputs.length} extractInputs=${fixtures.realWorld.apartmentRentalsAsia.extractInputs.length}`,
);
