import {
  extractCurrencyTextMatches,
  parseCurrencyValue,
} from "@fx-inline/currency-detection";
import { getConvertedAmountText } from "./amountFormatting.js";
import {
  applyConvertedAmountColor,
  getInlineAddonNode,
  setInlineConversionContent,
} from "./conversionNodes.js";
import {
  ARIA_HIDDEN_SELECTOR,
  DIGIT_REGEX,
  INLINE_CONVERSION_ADDON_MODE,
  INLINE_CONVERSION_CLASS,
} from "./constants.js";
import { usesLightTextColorForElement } from "./textColor.js";

function getAriaHiddenRoots(root) {
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

  if (root instanceof Element && root.matches(ARIA_HIDDEN_SELECTOR)) {
    roots.add(root);
  }

  for (const matched of root.querySelectorAll(ARIA_HIDDEN_SELECTOR)) {
    roots.add(matched);
  }

  return Array.from(roots);
}

function areParsedValuesEqual(left, right) {
  const delta = Math.abs(left - right);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * 4;
  return delta <= tolerance;
}

function getSiblingCurrencyRawPrice(
  valueRoot,
  amountText,
  localeHint,
) {
  const parsedAmount = parseCurrencyValue(amountText, localeHint);
  if (!parsedAmount.valid || parsedAmount.value === undefined) return null;
  const amountValue = parsedAmount.value;

  const parent = valueRoot.parentElement;
  if (!parent) return null;

  const siblings = Array.from(parent.children);
  const valueIndex = siblings.indexOf(valueRoot);
  if (valueIndex < 0) return null;

  let matchedRawPrice = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < siblings.length; index += 1) {
    const sibling = siblings[index];
    if (sibling === valueRoot) continue;
    if (sibling.getAttribute("aria-hidden") !== "true") continue;

    const token = sibling.textContent?.replace(/\s+/g, " ").trim();
    if (!token || token.length > 32) continue;

    const compactToken = token.replace(/\s+/g, "");
    const rawCandidates = Array.from(
      new Set([
        `${compactToken}${amountText}`,
        `${token} ${amountText}`,
        `${amountText} ${token}`,
        `${amountText}${compactToken}`,
      ]),
    );

    let parsedRawPrice = null;

    for (const rawCandidate of rawCandidates) {
      const parsed = extractCurrencyTextMatches(rawCandidate, localeHint);
      const matched = parsed.find((candidate) =>
        areParsedValuesEqual(candidate.value, amountValue),
      );
      if (!matched) continue;

      parsedRawPrice = matched.raw.trim();
      if (parsedRawPrice.length) break;
      parsedRawPrice = null;
    }

    if (!parsedRawPrice) continue;

    const distance = Math.abs(index - valueIndex);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      matchedRawPrice = parsedRawPrice;
    }
  }

  return matchedRawPrice;
}

function getSanitizedAmountText(root) {
  const raw = root.textContent?.trim();
  if (!raw) return null;

  const normalized = raw.replace(/[^\d,.\u00A0\u202F ]/gu, "").trim();
  if (!normalized || !DIGIT_REGEX.test(normalized)) return null;
  return normalized;
}

export function decorateStructuredSiblingSymbolPrices(
  root,
  preferredCurrency,
  rateSnapshot,
  localeHint,
  lightTextCache,
) {
  const ariaHiddenRoots = getAriaHiddenRoots(root);
  if (!ariaHiddenRoots.length) return 0;

  let conversionsApplied = 0;

  for (const ariaHiddenRoot of ariaHiddenRoots) {
    if (ariaHiddenRoot.closest(`.${INLINE_CONVERSION_CLASS}`)) continue;

    const amountText = getSanitizedAmountText(ariaHiddenRoot);
    if (!amountText) continue;

    const rawPrice = getSiblingCurrencyRawPrice(
      ariaHiddenRoot,
      amountText,
      localeHint,
    );

    const existingAddon = getInlineAddonNode(ariaHiddenRoot);

    if (!rawPrice) {
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
      usesLightTextColorForElement(ariaHiddenRoot, lightTextCache),
    );
    setInlineConversionContent(wrapper, convertedAmount);

    if (!existingAddon) {
      ariaHiddenRoot.appendChild(wrapper);
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
