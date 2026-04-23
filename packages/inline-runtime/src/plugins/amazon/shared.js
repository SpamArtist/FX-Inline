export const AMAZON_HIDDEN_PRICE_ROOT_SELECTOR = 'span[aria-hidden="true"]';
export const AMAZON_PRICE_SYMBOL_SELECTOR = ".a-price-symbol";
export const AMAZON_PRICE_WHOLE_SELECTOR = ".a-price-whole";
export const AMAZON_PRICE_DECIMAL_SELECTOR = ".a-price-decimal";
export const AMAZON_PRICE_FRACTION_SELECTOR = ".a-price-fraction";

export const AMAZON_PLUGIN_NAMESPACE = "site:amazon";
export const AMAZON_STRUCTURED_CANDIDATES_KEY = "structured-candidates";

export function getAmazonHiddenPriceRoots(root) {
  if (
    !(
      root instanceof Element ||
      root instanceof Document ||
      root instanceof DocumentFragment
    )
  ) {
    return [];
  }

  const roots = new Set();

  if (root instanceof Element) {
    if (root.matches(AMAZON_HIDDEN_PRICE_ROOT_SELECTOR)) {
      roots.add(root);
    }

    const nearestAncestor = root.closest(AMAZON_HIDDEN_PRICE_ROOT_SELECTOR);
    if (nearestAncestor) {
      roots.add(nearestAncestor);
    }
  }

  const wholeNodes = root.querySelectorAll(
    `${AMAZON_HIDDEN_PRICE_ROOT_SELECTOR} ${AMAZON_PRICE_WHOLE_SELECTOR}`,
  );
  for (const wholeNode of wholeNodes) {
    const hiddenRoot = wholeNode.closest(AMAZON_HIDDEN_PRICE_ROOT_SELECTOR);
    if (hiddenRoot) {
      roots.add(hiddenRoot);
    }
  }

  return Array.from(roots);
}

export function getAmazonStructuredRawPrice(root) {
  const symbol = root.querySelector(AMAZON_PRICE_SYMBOL_SELECTOR)?.textContent?.trim();
  const wholeRaw = root
    .querySelector(AMAZON_PRICE_WHOLE_SELECTOR)
    ?.textContent?.trim();
  const whole = wholeRaw?.replace(/[^\d,\u00A0\u202F ]/gu, "").trim();

  if (!symbol || !whole) return null;

  const fractionRaw = root
    .querySelector(AMAZON_PRICE_FRACTION_SELECTOR)
    ?.textContent?.trim();
  const fraction = fractionRaw?.replace(/[^\d]/gu, "").trim();
  if (!fraction) {
    return `${symbol}${whole}`;
  }

  const decimalToken = root
    .querySelector(AMAZON_PRICE_DECIMAL_SELECTOR)
    ?.textContent?.trim();
  const decimal = decimalToken || ".";
  return `${symbol}${whole}${decimal}${fraction}`;
}

export function collectAmazonStructuredCandidates(root) {
  const hiddenPriceRoots = getAmazonHiddenPriceRoots(root);
  if (!hiddenPriceRoots.length) return [];

  const candidates = [];
  for (const hiddenPriceRoot of hiddenPriceRoots) {
    if (!(hiddenPriceRoot instanceof Element)) continue;
    const detectedRawPrice = getAmazonStructuredRawPrice(hiddenPriceRoot);
    if (!detectedRawPrice) continue;
    candidates.push({
      hostNode: hiddenPriceRoot,
      detectedRawPrice,
    });
  }

  return candidates;
}
