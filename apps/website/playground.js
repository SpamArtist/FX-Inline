const pricingPageUrlInput = document.getElementById("pricing-page-url");
const previewCurrencyInput = document.getElementById("preview-currency");
const previewDomain = document.getElementById("preview-domain");
const refreshPreviewButton = document.getElementById("refresh-preview");
const previewSurface = document.querySelector("[data-preview-surface]");
const previewPage = document.querySelector("[data-preview-page]");

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

const PREVIEW_PLANS = [
  {
    name: "Starter",
    price: "$29/mo",
    description: "For lean teams validating a new market.",
  },
  {
    name: "Growth",
    price: "$99/mo",
    description: "For teams scaling international demand.",
    featured: true,
  },
  {
    name: "Business",
    price: "$249/mo",
    description: "For managed pricing-page rollout.",
  },
];

let previewLoadTimer = 0;

if (
  !pricingPageUrlInput ||
  !previewCurrencyInput ||
  !previewDomain ||
  !refreshPreviewButton ||
  !previewSurface ||
  !previewPage
) {
  throw new Error("Pricing page preview DOM is missing required controls.");
}

function createNode(tagName, className, text) {
  const node = document.createElement(tagName);

  if (className) {
    node.className = className;
  }

  if (text !== undefined) {
    node.textContent = text;
  }

  return node;
}

function setPreviewState(state) {
  previewSurface.setAttribute("data-state", state);
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

function getUsdValue(rawPrice) {
  const priceMatch = rawPrice.match(/\$([\d,]+(?:\.\d+)?)/u);

  if (!priceMatch) {
    return 0;
  }

  return Number(priceMatch[1].replaceAll(",", ""));
}

function formatPreviewHint(rawPrice, targetCurrency) {
  const value = getUsdValue(rawPrice);
  const rate = PREVIEW_RATES_FROM_USD[targetCurrency] || PREVIEW_RATES_FROM_USD.EUR;
  const locale = PREVIEW_NUMBER_LOCALES[targetCurrency] || PREVIEW_NUMBER_LOCALES.EUR;
  const convertedValue = value * rate;
  const formattedValue = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(convertedValue);

  return `~ ${targetCurrency} ${formattedValue}${getBillingSuffix(rawPrice)}`;
}

function clearPreviewPage() {
  previewPage.replaceChildren();
}

function renderReadyPreview() {
  window.clearTimeout(previewLoadTimer);
  setPreviewState("ready");
  refreshPreviewButton.disabled = false;
  refreshPreviewButton.textContent = "Refresh preview";
  previewDomain.textContent = getPreviewDomainLabel(pricingPageUrlInput.value);
  clearPreviewPage();

  const placeholder = createNode("div", "preview-placeholder");
  placeholder.append(
    createNode("strong", "", "Load a pricing page preview"),
    createNode(
      "p",
      "",
      "Enter a pricing page URL, choose a target currency, and refresh the preview.",
    ),
  );
  previewPage.append(placeholder);
}

function renderLoadingPreview(domainLabel) {
  setPreviewState("loading");
  refreshPreviewButton.disabled = true;
  refreshPreviewButton.textContent = "Loading";
  previewDomain.textContent = domainLabel;
  clearPreviewPage();

  const loading = createNode("div", "preview-loading");
  loading.append(
    createNode("span", "preview-spinner"),
    createNode("strong", "", "Loading pricing page"),
    createNode("p", "", `Preparing local-currency hints for ${domainLabel}.`),
  );
  previewPage.append(loading);
}

function renderLoadedPreview(domainLabel, targetCurrency) {
  setPreviewState("loaded");
  refreshPreviewButton.disabled = false;
  refreshPreviewButton.textContent = "Refresh preview";
  clearPreviewPage();

  const header = createNode("div", "preview-page-header");
  const headerCopy = createNode("div");
  headerCopy.append(
    createNode("p", "", "Loaded pricing page"),
    createNode("strong", "", "Local-currency hints added"),
  );
  header.append(headerCopy, createNode("span", "preview-status-pill", "FX Inline active"));

  const grid = createNode("div", "preview-plan-grid");

  for (const plan of PREVIEW_PLANS) {
    const article = createNode("article");

    if (plan.featured) {
      article.classList.add("is-featured");
    }

    const price = createNode("p", "preview-price");
    price.append(
      createNode("span", "", plan.price),
      createNode("em", "local-price-hint", formatPreviewHint(plan.price, targetCurrency)),
    );

    article.append(
      createNode("p", "plan-name", plan.name),
      price,
      createNode("small", "", plan.description),
    );
    grid.append(article);
  }

  const footer = createNode(
    "p",
    "preview-page-note",
    `Preview loaded from ${domainLabel}. Original prices stay visible.`,
  );

  previewPage.append(header, grid, footer);
}

function refreshPricingPreview() {
  const targetCurrency = getPreviewCurrency();
  const domainLabel = getPreviewDomainLabel(pricingPageUrlInput.value);

  renderLoadingPreview(domainLabel);
  window.clearTimeout(previewLoadTimer);
  previewLoadTimer = window.setTimeout(() => {
    renderLoadedPreview(domainLabel, targetCurrency);
  }, 420);
}

pricingPageUrlInput.addEventListener("input", renderReadyPreview);
previewCurrencyInput.addEventListener("change", renderReadyPreview);
refreshPreviewButton.addEventListener("click", refreshPricingPreview);

renderReadyPreview();
