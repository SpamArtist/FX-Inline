import { createCurrencyParser } from "@fx-inline/currency-detection";

const parser = createCurrencyParser();
const pricingPageUrlInput = document.getElementById("pricing-page-url");
const previewCurrencyInput = document.getElementById("preview-currency");
const previewDomain = document.getElementById("preview-domain");
const refreshPreviewButton = document.getElementById("refresh-preview");
const previewPriceNodes = document.querySelectorAll("[data-preview-price]");

const PREVIEW_RATES_FROM_USD = {
  EUR: 0.92,
  GBP: 0.8,
  INR: 83.2,
  JPY: 156,
  CAD: 1.37,
};

const PREVIEW_NUMBER_LOCALES = {
  EUR: "de-DE",
  GBP: "en-GB",
  INR: "en-IN",
  JPY: "ja-JP",
  CAD: "en-CA",
};

if (
  !pricingPageUrlInput ||
  !previewCurrencyInput ||
  !previewDomain ||
  !refreshPreviewButton ||
  previewPriceNodes.length === 0
) {
  throw new Error("Pricing page preview DOM is missing required controls.");
}

function getPreviewCurrency() {
  const currency = previewCurrencyInput.value;
  return PREVIEW_RATES_FROM_USD[currency] ? currency : "EUR";
}

function getPreviewDomainLabel(rawUrl) {
  const trimmed = rawUrl.trim();

  if (!trimmed) {
    return "example.com/pricing";
  }

  const normalizedUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(normalizedUrl);
    const normalizedPath = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.hostname}${normalizedPath}`;
  } catch {
    return trimmed.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
}

function getBillingSuffix(rawPrice) {
  const billingMatch = rawPrice.match(/\/[a-z]+/iu);
  return billingMatch ? billingMatch[0] : "";
}

function formatPreviewHint(value, targetCurrency, billingSuffix) {
  const rate = PREVIEW_RATES_FROM_USD[targetCurrency] || PREVIEW_RATES_FROM_USD.EUR;
  const locale = PREVIEW_NUMBER_LOCALES[targetCurrency] || PREVIEW_NUMBER_LOCALES.EUR;
  const convertedValue = value * rate;
  const formattedValue = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(convertedValue);

  return `approx ${targetCurrency} ${formattedValue}${billingSuffix}`;
}

function updatePricingPreview() {
  const targetCurrency = getPreviewCurrency();
  previewDomain.textContent = getPreviewDomainLabel(pricingPageUrlInput.value);

  for (const priceNode of previewPriceNodes) {
    const rawPrice = priceNode.getAttribute("data-preview-price") || "";
    const hintNode = priceNode.querySelector("[data-preview-hint]");
    const match = parser.extractMatches(rawPrice, { localeHint: "en-US" })[0];

    if (!hintNode || !match) {
      continue;
    }

    hintNode.textContent = formatPreviewHint(
      match.value,
      targetCurrency,
      getBillingSuffix(rawPrice),
    );
  }
}

pricingPageUrlInput.addEventListener("input", updatePricingPreview);
previewCurrencyInput.addEventListener("change", updatePricingPreview);
refreshPreviewButton.addEventListener("click", updatePricingPreview);

updatePricingPreview();
