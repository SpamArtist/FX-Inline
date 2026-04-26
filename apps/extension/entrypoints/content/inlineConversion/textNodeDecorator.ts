import { CurrencyCode } from "@/utils/enums";
import type { RateSnapshot } from "@/utils/rates.types";
import {
  extractCurrencyTextMatches,
  mayContainCurrencyToken,
  parseCurrencyValue,
} from "@/utils/utils";
import { getConvertedAmountText } from "./amountFormatting";
import {
  applyConvertedAmountColor,
  getInlineAddonNode,
  setInlineConversionContent,
} from "./conversionNodes";
import {
  INLINE_CONVERSION_ADDON_MODE,
  INLINE_CONVERSION_CLASS,
} from "./constants";
import { usesLightTextColor } from "./textColor";

const AMOUNT_ONLY_TEXT_REGEX = /^[+-]?\d[\d,.\u00A0\u202F ]*$/u;

function areParsedValuesEqual(left: number, right: number): boolean {
  const delta = Math.abs(left - right);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * 4;
  return delta <= tolerance;
}

function getNearestSiblingText(
  amountRoot: Element,
  direction: -1 | 1,
): string | null {
  const parent = amountRoot.parentNode;
  if (!parent) return null;

  const siblings = Array.from(parent.childNodes);
  const index = siblings.indexOf(amountRoot);
  if (index < 0) return null;

  for (
    let siblingIndex = index + direction;
    siblingIndex >= 0 && siblingIndex < siblings.length;
    siblingIndex += direction
  ) {
    const sibling = siblings[siblingIndex];
    if (!sibling) continue;

    if (
      sibling instanceof HTMLSpanElement &&
      sibling.classList.contains(INLINE_CONVERSION_CLASS)
    ) {
      continue;
    }

    const text = sibling.textContent?.replace(/\s+/g, " ").trim();
    if (!text) continue;

    return text.slice(0, 64);
  }

  return null;
}

function getSplitSiblingRawPrice(
  amountNode: Text,
  amountText: string,
  localeHint: string | null,
): string | null {
  const amountParsed = parseCurrencyValue(amountText, localeHint);
  if (!amountParsed.valid || amountParsed.value === undefined) return null;
  const amountValue = amountParsed.value;

  const amountRoot = amountNode.parentElement;
  if (!amountRoot) return null;

  const before = getNearestSiblingText(amountRoot, -1);
  const after = getNearestSiblingText(amountRoot, 1);
  const rawCandidates: string[] = [];

  if (before) {
    rawCandidates.push(`${before} ${amountText}`);
    rawCandidates.push(`${before}${amountText}`);
  }
  if (after) {
    rawCandidates.push(`${amountText} ${after}`);
    rawCandidates.push(`${amountText}${after}`);
  }

  for (const rawCandidate of rawCandidates) {
    const parsed = extractCurrencyTextMatches(rawCandidate, localeHint);
    const matched = parsed.find((candidate) =>
      areParsedValuesEqual(candidate.value, amountValue),
    );
    if (!matched) continue;

    return matched.raw.trim() || null;
  }

  return null;
}

function decorateSplitSiblingPriceInTextNode(
  textNode: Text,
  amountText: string,
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
  localeHint: string | null,
  lightTextCache?: WeakMap<Element, boolean>,
): number {
  const amountRoot = textNode.parentElement;
  if (!amountRoot || amountRoot.closest(`.${INLINE_CONVERSION_CLASS}`)) return 0;
  if (amountRoot.closest('[aria-hidden="true"]')) return 0;

  const rawPrice = getSplitSiblingRawPrice(textNode, amountText, localeHint);
  const existingAddon = getInlineAddonNode(amountRoot);
  if (!rawPrice) {
    existingAddon?.remove();
    return 0;
  }

  const parsed = extractCurrencyTextMatches(rawPrice, localeHint);
  const matched = parsed.find((item) => item.raw === rawPrice) || parsed[0];
  if (!matched) {
    existingAddon?.remove();
    return 0;
  }

  const convertedAmount = getConvertedAmountText(
    matched,
    preferredCurrency,
    rateSnapshot,
    localeHint,
  );
  if (!convertedAmount) {
    existingAddon?.remove();
    return 0;
  }

  const previousOriginal = existingAddon?.getAttribute("data-original") ?? null;
  const previousConverted =
    existingAddon?.querySelector(".fx-inline-converted-amount")?.textContent ?? null;

  const wrapper = existingAddon ?? document.createElement("span");
  wrapper.className = INLINE_CONVERSION_CLASS;
  wrapper.setAttribute("data-fx-inline-mode", INLINE_CONVERSION_ADDON_MODE);
  wrapper.setAttribute("data-original", rawPrice);
  applyConvertedAmountColor(
    wrapper,
    usesLightTextColor(textNode, lightTextCache),
  );
  setInlineConversionContent(wrapper, convertedAmount);

  if (!existingAddon) {
    amountRoot.appendChild(wrapper);
    return 1;
  }

  if (
    previousOriginal !== rawPrice ||
    previousConverted !== `(${convertedAmount})`
  ) {
    return 1;
  }

  return 0;
}

export function decoratePricesInTextNode(
  textNode: Text,
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
  localeHint: string | null,
  lightTextCache?: WeakMap<Element, boolean>,
): number {
  const text = textNode.nodeValue;
  if (!text?.trim()) return 0;
  const trimmedText = text.trim();
  const shouldAttemptDirectParse = mayContainCurrencyToken(text);
  const matches = shouldAttemptDirectParse
    ? extractCurrencyTextMatches(text, localeHint)
    : [];
  if (!matches.length) {
    if (!AMOUNT_ONLY_TEXT_REGEX.test(trimmedText)) return 0;
    return decorateSplitSiblingPriceInTextNode(
      textNode,
      trimmedText,
      preferredCurrency,
      rateSnapshot,
      localeHint,
      lightTextCache,
    );
  }

  const lightTextContext = usesLightTextColor(textNode, lightTextCache);

  let cursor = 0;
  let conversionsApplied = 0;
  const fragment = document.createDocumentFragment();

  for (const match of matches) {
    if (match.start < cursor) continue;

    fragment.append(text.slice(cursor, match.start));

    const convertedAmount = getConvertedAmountText(
      match,
      preferredCurrency,
      rateSnapshot,
      localeHint,
    );
    if (!convertedAmount) {
      fragment.append(match.raw);
      cursor = match.end;
      continue;
    }

    const wrapper = document.createElement("span");
    wrapper.className = INLINE_CONVERSION_CLASS;
    wrapper.setAttribute("data-original", match.raw);
    applyConvertedAmountColor(wrapper, lightTextContext);

    setInlineConversionContent(wrapper, convertedAmount, {
      originalText: match.raw,
    });

    fragment.append(wrapper);
    cursor = match.end;
    conversionsApplied += 1;
  }

  if (conversionsApplied === 0) return 0;

  fragment.append(text.slice(cursor));
  textNode.replaceWith(fragment);

  return conversionsApplied;
}
