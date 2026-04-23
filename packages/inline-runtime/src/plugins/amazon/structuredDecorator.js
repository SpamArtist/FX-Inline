import {
  extractCurrencyTextMatches,
  mayContainCurrencyToken,
} from "@fx-inline/currency-detection";
import { getConvertedAmountText } from "../../core/amountFormatting.js";
import {
  applyConvertedAmountColor,
  getInlineAddonNode,
  setInlineConversionContent,
} from "../../core/conversionNodes.js";
import {
  AMAZON_HIDDEN_PRICE_ROOT_SELECTOR,
  AMAZON_PRICE_DECIMAL_SELECTOR,
  AMAZON_PRICE_FRACTION_SELECTOR,
  AMAZON_PRICE_SYMBOL_SELECTOR,
  AMAZON_PRICE_WHOLE_SELECTOR,
  INLINE_CONVERSION_ADDON_MODE,
  INLINE_CONVERSION_CLASS,
} from "../../core/constants.js";
import { usesLightTextColorForElement } from "../../core/textColor.js";

function getAmazonHiddenPriceRoots(root) {
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

function getAmazonStructuredRawPrice(root) {
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

export function decorateStructuredAmazonPrices(
  root,
  preferredCurrency,
  rateSnapshot,
  localeHint,
  lightTextCache,
) {
  const hiddenPriceRoots = getAmazonHiddenPriceRoots(root);
  if (!hiddenPriceRoots.length) return 0;

  let conversionsApplied = 0;

  for (const hiddenPriceRoot of hiddenPriceRoots) {
    if (hiddenPriceRoot.closest(`.${INLINE_CONVERSION_CLASS}`)) continue;

    const rawPrice = getAmazonStructuredRawPrice(hiddenPriceRoot);
    const existingAddon = getInlineAddonNode(hiddenPriceRoot);

    if (!rawPrice || !mayContainCurrencyToken(rawPrice)) {
      existingAddon?.remove();
      continue;
    }

    const parsed = extractCurrencyTextMatches(rawPrice, localeHint);
    const matched = parsed.find((item) => item.raw === rawPrice) || parsed[0];
    if (!matched) {
      existingAddon?.remove();
      continue;
    }

    const convertedAmount = getConvertedAmountText(
      matched,
      preferredCurrency,
      rateSnapshot,
      localeHint,
    );
    if (!convertedAmount) {
      existingAddon?.remove();
      continue;
    }

    const previousOriginal = existingAddon?.getAttribute("data-original") ?? null;
    const previousConverted =
      existingAddon?.querySelector(".ccx-converted-amount")?.textContent ?? null;

    const wrapper = existingAddon ?? document.createElement("span");
    wrapper.className = INLINE_CONVERSION_CLASS;
    wrapper.setAttribute("data-ccx-mode", INLINE_CONVERSION_ADDON_MODE);
    wrapper.setAttribute("data-original", rawPrice);
    applyConvertedAmountColor(
      wrapper,
      usesLightTextColorForElement(hiddenPriceRoot, lightTextCache),
    );
    setInlineConversionContent(wrapper, convertedAmount);

    if (!existingAddon) {
      hiddenPriceRoot.appendChild(wrapper);
      conversionsApplied += 1;
      continue;
    }

    if (
      previousOriginal !== rawPrice ||
      previousConverted !== `(${convertedAmount})`
    ) {
      conversionsApplied += 1;
    }
  }

  return conversionsApplied;
}
