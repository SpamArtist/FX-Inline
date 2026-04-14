import { CurrencyCode } from "@/utils/enums";
import type { RateSnapshot } from "@/utils/rates.types";
import {
  extractCurrencyTextMatches,
  isRecognizedCurrencySymbolToken,
  mayContainCurrencyToken,
} from "@/utils/utils";
import { getConvertedAmountText } from "./amountFormatting";
import {
  applyConvertedAmountColor,
  getInlineAddonNode,
  setInlineConversionContent,
} from "./conversionNodes";
import {
  AMAZON_HIDDEN_PRICE_ROOT_SELECTOR,
  AMAZON_PRICE_DECIMAL_SELECTOR,
  AMAZON_PRICE_FRACTION_SELECTOR,
  AMAZON_PRICE_SYMBOL_SELECTOR,
  AMAZON_PRICE_WHOLE_SELECTOR,
  ARIA_HIDDEN_SELECTOR,
  DIGIT_REGEX,
  INLINE_CONVERSION_ADDON_MODE,
  INLINE_CONVERSION_CLASS,
} from "./constants";
import { usesLightTextColorForElement } from "./textColor";

function getAmazonHiddenPriceRoots(root: ParentNode): Element[] {
  if (
    !(
      root instanceof Element ||
      root instanceof Document ||
      root instanceof DocumentFragment
    )
  ) {
    return [];
  }

  const roots = new Set<Element>();

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

function getAriaHiddenRoots(root: ParentNode): Element[] {
  if (
    !(
      root instanceof Element ||
      root instanceof Document ||
      root instanceof DocumentFragment
    )
  ) {
    return [];
  }

  const roots = new Set<Element>();

  if (root instanceof Element && root.matches(ARIA_HIDDEN_SELECTOR)) {
    roots.add(root);
  }

  for (const matched of root.querySelectorAll(ARIA_HIDDEN_SELECTOR)) {
    roots.add(matched);
  }

  return Array.from(roots);
}

function getAmazonStructuredRawPrice(root: Element): string | null {
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

function getSiblingCurrencySymbol(valueRoot: Element): string | null {
  const parent = valueRoot.parentElement;
  if (!parent) return null;

  const siblings = Array.from(parent.children);
  const valueIndex = siblings.indexOf(valueRoot);
  if (valueIndex < 0) return null;

  let matchedSymbol: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < siblings.length; index += 1) {
    const sibling = siblings[index];
    if (sibling === valueRoot) continue;
    if (sibling.getAttribute("aria-hidden") !== "true") continue;

    const token = sibling.textContent?.replace(/\s+/g, "").trim();
    if (!token || token.length > 5) continue;
    if (!isRecognizedCurrencySymbolToken(token)) continue;

    const distance = Math.abs(index - valueIndex);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      matchedSymbol = token;
    }
  }

  return matchedSymbol;
}

function getSanitizedAmountText(root: Element): string | null {
  const raw = root.textContent?.trim();
  if (!raw) return null;

  const normalized = raw.replace(/[^\d,.\u00A0\u202F ]/gu, "").trim();
  if (!normalized || !DIGIT_REGEX.test(normalized)) return null;
  return normalized;
}

export function decorateStructuredAmazonPrices(
  root: ParentNode,
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
  localeHint: string | null,
  lightTextCache?: WeakMap<Element, boolean>,
): number {
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

    if (previousOriginal !== rawPrice || previousConverted !== convertedAmount) {
      conversionsApplied += 1;
    }
  }

  return conversionsApplied;
}

export function decorateStructuredSiblingSymbolPrices(
  root: ParentNode,
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
  localeHint: string | null,
  lightTextCache?: WeakMap<Element, boolean>,
): number {
  const hiddenRoots = getAriaHiddenRoots(root);
  if (!hiddenRoots.length) return 0;

  let conversionsApplied = 0;

  for (const hiddenRoot of hiddenRoots) {
    if (hiddenRoot.closest(`.${INLINE_CONVERSION_CLASS}`)) continue;
    if (hiddenRoot.querySelector(AMAZON_PRICE_WHOLE_SELECTOR)) continue;

    const existingAddon = getInlineAddonNode(hiddenRoot);
    const amountText = getSanitizedAmountText(hiddenRoot);
    const symbol = getSiblingCurrencySymbol(hiddenRoot);

    if (!amountText || !symbol) {
      existingAddon?.remove();
      continue;
    }

    const rawPrice = `${symbol}${amountText}`;
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
      usesLightTextColorForElement(hiddenRoot, lightTextCache),
    );
    setInlineConversionContent(wrapper, convertedAmount);

    if (!existingAddon) {
      hiddenRoot.appendChild(wrapper);
      conversionsApplied += 1;
      continue;
    }

    if (previousOriginal !== rawPrice || previousConverted !== convertedAmount) {
      conversionsApplied += 1;
    }
  }

  return conversionsApplied;
}
