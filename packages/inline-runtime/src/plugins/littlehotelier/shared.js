export const LITTLE_HOTELIER_PLUGIN_NAMESPACE = "site:littlehotelier";
export const LITTLE_HOTELIER_PRICING_CANDIDATES_KEY = "pricing-candidates";

export const LITTLE_HOTELIER_PRICING_TABLE_SELECTOR =
  "section.pricing-table.revised-pricing-lhb";
export const LITTLE_HOTELIER_PRODUCT_PRICE_SELECTOR = '[data-field="product"] p';
export const LITTLE_HOTELIER_AMOUNT_SELECTOR = ".output.lh-pro";
export const LITTLE_HOTELIER_CURRENCY_CODE_SELECTOR = ".code";
export const LITTLE_HOTELIER_SKIP_ATTR = "data-ccx-skip-inline-conversion";
export const LITTLE_HOTELIER_SITE_ATTR = "data-ccx-site";
export const LITTLE_HOTELIER_SITE_KEY = "littlehotelier-pricing";

function isQueryableRoot(root) {
  return (
    root instanceof Element ||
    root instanceof Document ||
    root instanceof DocumentFragment
  );
}

function normalizeText(value) {
  return value?.replace(/\s+/gu, " ").trim() ?? "";
}

export function getLittleHotelierPricingSections(root) {
  if (!isQueryableRoot(root)) return [];

  const sections = new Set();

  if (root instanceof Element) {
    if (root.matches(LITTLE_HOTELIER_PRICING_TABLE_SELECTOR)) {
      sections.add(root);
    }

    const nearestSection = root.closest(LITTLE_HOTELIER_PRICING_TABLE_SELECTOR);
    if (nearestSection) {
      sections.add(nearestSection);
    }
  }

  for (const section of root.querySelectorAll(
    LITTLE_HOTELIER_PRICING_TABLE_SELECTOR,
  )) {
    sections.add(section);
  }

  return Array.from(sections);
}

function getPricingParagraphRawPrice(paragraph) {
  const amountNode = paragraph.querySelector(LITTLE_HOTELIER_AMOUNT_SELECTOR);
  if (!(amountNode instanceof Element)) return null;

  const amountText = normalizeText(amountNode.textContent);
  if (!amountText) return null;

  const currencyCode = normalizeText(
    paragraph.querySelector(LITTLE_HOTELIER_CURRENCY_CODE_SELECTOR)?.textContent,
  );
  if (!currencyCode) return null;

  return {
    amountNode,
    rawPrice: `${amountText} ${currencyCode}`,
  };
}

export function getLittleHotelierPricingRawPrice(paragraph) {
  return getPricingParagraphRawPrice(paragraph)?.rawPrice ?? null;
}

export function collectLittleHotelierPricingCandidates(root) {
  const sections = getLittleHotelierPricingSections(root);
  if (!sections.length) return [];

  const candidates = [];

  for (const section of sections) {
    for (const paragraph of section.querySelectorAll(
      LITTLE_HOTELIER_PRODUCT_PRICE_SELECTOR,
    )) {
      if (!(paragraph instanceof Element)) continue;

      const rawPriceResult = getPricingParagraphRawPrice(paragraph);
      if (!rawPriceResult) continue;

      rawPriceResult.amountNode.setAttribute(LITTLE_HOTELIER_SKIP_ATTR, "true");
      candidates.push({
        hostNode: paragraph,
        amountNode: rawPriceResult.amountNode,
        rawPrice: rawPriceResult.rawPrice,
      });
    }
  }

  return candidates;
}
