import { CurrencyCode } from "@/utils/enums";
import { convertAmountWithSnapshot } from "@/utils/rateMath";
import type { CurrencyTextMatch } from "@/utils/currencyUtils.types";
import type { RateSnapshot } from "@/utils/rates.types";
import { CURRENCY_SYMBOLS } from "@/utils/constants";
import type { InlineConversionPerfSample } from "./content.types";
import {
  extractCurrencyTextMatches,
  formatAmountInCurrency,
  hasThousandMagnitudeHint,
  mayContainCurrencyToken,
} from "@/utils/utils";

export const INLINE_CONVERSION_CLASS = "ccx-inline-conversion";
const INLINE_CONVERSION_STYLE_ID = "ccx-inline-conversion-style";
const INLINE_COMPACT_THRESHOLD = 100_000;
const INLINE_CONVERSION_ADDON_MODE = "addon";
const AMAZON_HIDDEN_PRICE_ROOT_SELECTOR = 'span[aria-hidden="true"]';
const AMAZON_PRICE_SYMBOL_SELECTOR = ".a-price-symbol";
const AMAZON_PRICE_WHOLE_SELECTOR = ".a-price-whole";
const AMAZON_PRICE_DECIMAL_SELECTOR = ".a-price-decimal";
const AMAZON_PRICE_FRACTION_SELECTOR = ".a-price-fraction";
const ARIA_HIDDEN_SELECTOR = '[aria-hidden="true"]';
const INLINE_CONVERSION_CSS = `
  :where(.${INLINE_CONVERSION_CLASS}) {
    border-radius: 0 !important;
    background-color: transparent !important;
    color: inherit !important;
    padding: 0 !important;
    white-space: normal !important;
  }

  :where(.${INLINE_CONVERSION_CLASS}) .ccx-converted-amount {
    font-weight: 600 !important;
    color: var(--ccx-converted-color, currentColor) !important;
    background-color: transparent !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin-left: 0.1em !important;
  }
`;

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
  "BUTTON",
  "CODE",
  "PRE",
  "SVG",
]);
const RGB_CHANNEL_REGEX =
  /rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,\/]+[\d.]+)?\s*\)/i;
const DIGIT_REGEX = /\d/u;

const EDITABLE_CONTEXT_SELECTOR = [
  "input",
  "textarea",
  "select",
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
].join(",");
const NON_VISIBLE_TEXT_CONTEXT_SELECTOR = [
  "[hidden]",
  ".a-offscreen",
  ".sr-only",
  ".sr_only",
  ".sronly",
  ".srOnly",
  ".screen-reader-text",
  ".screenreader-only",
  ".visually-hidden",
  '[class*="srOnly"]',
  '[class*="sr-only"]',
  '[class*="screen-reader"]',
  '[class*="visually-hidden"]',
].join(",");

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (SKIP_TAGS.has(parent.tagName)) return true;
  if (parent.isContentEditable) return true;
  if (parent.closest(EDITABLE_CONTEXT_SELECTOR)) return true;
  if (parent.closest(NON_VISIBLE_TEXT_CONTEXT_SELECTOR)) return true;
  if (parent.closest(`.${INLINE_CONVERSION_CLASS}`)) return true;

  return false;
}

function getOriginalText(node: Element): string {
  return node.getAttribute("data-original") || node.textContent || "";
}

function replaceWithOriginalText(node: Element, fallbackText?: string) {
  node.replaceWith(
    document.createTextNode(fallbackText ?? getOriginalText(node)),
  );
}

function isInlineConversionAddon(node: Element): boolean {
  return node.getAttribute("data-ccx-mode") === INLINE_CONVERSION_ADDON_MODE;
}

function setInlineConversionContent(
  wrapper: HTMLSpanElement,
  convertedAmount: string,
  options?: {
    originalText?: string;
  },
) {
  wrapper.textContent =
    options?.originalText === undefined ? " (" : `${options.originalText} (`;

  const convertedValueNode = document.createElement("span");
  convertedValueNode.className = "ccx-converted-amount";
  convertedValueNode.textContent = convertedAmount;

  wrapper.appendChild(convertedValueNode);
  wrapper.append(")");
}

function applyConvertedAmountColor(
  wrapper: HTMLSpanElement,
  useLightColor: boolean,
) {
  wrapper.style.setProperty(
    "--ccx-converted-color",
    useLightColor ? "#93c5fd" : "#355aa8",
  );
}

function clearInlineConversions(root: ParentNode = document.body) {
  const convertedNodes = root.querySelectorAll(
    `span.${INLINE_CONVERSION_CLASS}`,
  );
  if (!convertedNodes.length) return 0;

  for (const node of convertedNodes) {
    if (isInlineConversionAddon(node)) {
      node.remove();
      continue;
    }

    replaceWithOriginalText(node);
  }

  if (root instanceof Element || root instanceof Document) {
    root.normalize();
  }

  return convertedNodes.length;
}

function getConvertedAmountText(
  match: Pick<
    CurrencyTextMatch,
    "raw" | "value" | "rangeEndValue" | "currency"
  >,
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
  localeHint: string | null,
): string | null {
  const isZeroValue =
    match.value === 0 &&
    (match.rangeEndValue === undefined || match.rangeEndValue === 0);
  if (isZeroValue) return null;
  if (match.currency === preferredCurrency) return null;

  const converted = convertAmountWithSnapshot(
    match.value,
    match.currency,
    preferredCurrency,
    rateSnapshot,
  );

  if (converted === null) return null;

  const compactThreshold = hasThousandMagnitudeHint(match.raw)
    ? 1_000
    : INLINE_COMPACT_THRESHOLD;
  const convertedUsesCompact = Math.abs(converted) >= compactThreshold;
  const formattedConverted = formatAmountInCurrency(
    converted,
    preferredCurrency,
    {
      localeHint,
      compactLargeValues: true,
      compactThreshold,
    },
  );
  let convertedAmount = convertedUsesCompact
    ? `~${formattedConverted}`
    : formattedConverted;

  if (match.rangeEndValue !== undefined) {
    const convertedRangeEnd = convertAmountWithSnapshot(
      match.rangeEndValue,
      match.currency,
      preferredCurrency,
      rateSnapshot,
    );

    if (convertedRangeEnd === null) return null;

    const rangeEndUsesCompact = Math.abs(convertedRangeEnd) >= compactThreshold;
    const formattedRangeEnd = formatAmountInCurrency(
      convertedRangeEnd,
      preferredCurrency,
      {
        localeHint,
        compactLargeValues: true,
        compactThreshold,
      },
    );
    const rangeApproximationPrefix =
      convertedUsesCompact || rangeEndUsesCompact ? "~" : "";
    convertedAmount = `${rangeApproximationPrefix}${formattedConverted}–${formattedRangeEnd}`;
  }

  return convertedAmount;
}

function refreshExistingInlineConversions(
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
  root: ParentNode,
  localeHint: string | null,
): number {
  const convertedNodes = root.querySelectorAll(
    `span.${INLINE_CONVERSION_CLASS}`,
  );
  if (!convertedNodes.length) return 0;

  let refreshedConversions = 0;

  for (const node of convertedNodes) {
    const isAddon = isInlineConversionAddon(node);
    const originalText = getOriginalText(node);
    if (!originalText.trim()) {
      if (isAddon) {
        node.remove();
      } else {
        replaceWithOriginalText(node, originalText);
      }
      continue;
    }

    const parsed = extractCurrencyTextMatches(originalText, localeHint);
    const matched =
      parsed.find((item) => item.raw === originalText) || parsed[0];

    if (!matched) {
      if (isAddon) {
        node.remove();
      } else {
        replaceWithOriginalText(node, originalText);
      }
      continue;
    }

    const convertedAmount = getConvertedAmountText(
      matched,
      preferredCurrency,
      rateSnapshot,
      localeHint,
    );

    if (!convertedAmount) {
      if (isAddon) {
        node.remove();
      } else {
        replaceWithOriginalText(node, originalText);
      }
      continue;
    }

    if (!(node instanceof HTMLSpanElement)) continue;

    setInlineConversionContent(node, convertedAmount, {
      originalText: isAddon ? undefined : originalText,
    });
    refreshedConversions += 1;
  }

  return refreshedConversions;
}

function parseRgbChannels(input: string): [number, number, number] | null {
  const matched = input.match(RGB_CHANNEL_REGEX);
  if (!matched) return null;

  const r = Number(matched[1]);
  const g = Number(matched[2]);
  const b = Number(matched[3]);

  if (
    !Number.isFinite(r) ||
    !Number.isFinite(g) ||
    !Number.isFinite(b) ||
    r < 0 ||
    r > 255 ||
    g < 0 ||
    g > 255 ||
    b < 0 ||
    b > 255
  ) {
    return null;
  }

  return [r, g, b];
}

function toLinearRgb(channel: number): number {
  const normalized = channel / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }

  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return (
    0.2126 * toLinearRgb(r) + 0.7152 * toLinearRgb(g) + 0.0722 * toLinearRgb(b)
  );
}

function usesLightTextColor(
  node: Text,
  lightTextCache?: WeakMap<Element, boolean>,
): boolean {
  const parent = node.parentElement;
  if (!parent) return false;

  return usesLightTextColorForElement(parent, lightTextCache);
}

function usesLightTextColorForElement(
  target: Element,
  lightTextCache?: WeakMap<Element, boolean>,
): boolean {
  if (lightTextCache?.has(target)) {
    return lightTextCache.get(target) ?? false;
  }

  const color = window.getComputedStyle(target).color;
  const rgb = parseRgbChannels(color);
  if (!rgb) {
    lightTextCache?.set(target, false);
    return false;
  }

  const isLightText = relativeLuminance(rgb) >= 0.6;
  lightTextCache?.set(target, isLightText);
  return isLightText;
}

function ensureInlineConversionStyles() {
  let styleTag = document.getElementById(
    INLINE_CONVERSION_STYLE_ID,
  ) as HTMLStyleElement | null;

  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = INLINE_CONVERSION_STYLE_ID;
    document.head.appendChild(styleTag);
    styleTag.textContent = INLINE_CONVERSION_CSS;
    return;
  }

  if (styleTag.textContent !== INLINE_CONVERSION_CSS) {
    styleTag.textContent = INLINE_CONVERSION_CSS;
  }
}

function decoratePricesInTextNode(
  textNode: Text,
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
  localeHint: string | null,
  lightTextCache?: WeakMap<Element, boolean>,
): number {
  const text = textNode.nodeValue;
  if (!text?.trim()) return 0;
  if (!mayContainCurrencyToken(text)) return 0;

  const matches = extractCurrencyTextMatches(text, localeHint);
  if (!matches.length) return 0;
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

function getInlineAddonNode(root: Element): HTMLSpanElement | null {
  for (const child of root.children) {
    if (
      child instanceof HTMLSpanElement &&
      child.classList.contains(INLINE_CONVERSION_CLASS) &&
      child.getAttribute("data-ccx-mode") === INLINE_CONVERSION_ADDON_MODE
    ) {
      return child;
    }
  }

  return null;
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
    if (!CURRENCY_SYMBOLS.has(token)) continue;

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

function decorateStructuredAmazonPrices(
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

function decorateStructuredSiblingSymbolPrices(
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

export function convertVisiblePrices(
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
  root: ParentNode = document.body,
  options?: {
    clearExisting?: boolean;
    refreshExisting?: boolean;
    maxNodesPerPass?: number;
    onPerfSample?: (sample: InlineConversionPerfSample) => void;
  },
): number {
  const capturePerf = Boolean(options?.onPerfSample);
  const totalStartedAt = capturePerf ? performance.now() : 0;

  ensureInlineConversionStyles();
  const localeHint = document.documentElement?.lang || null;
  let clearExistingMs = 0;
  let refreshedConversions = 0;

  if (options?.clearExisting !== false) {
    const clearStartedAt = capturePerf ? performance.now() : 0;
    clearInlineConversions(root);
    if (capturePerf) {
      clearExistingMs = performance.now() - clearStartedAt;
    }
  } else if (options?.refreshExisting) {
    const refreshStartedAt = capturePerf ? performance.now() : 0;
    refreshedConversions = refreshExistingInlineConversions(
      preferredCurrency,
      rateSnapshot,
      root,
      localeHint,
    );
    if (capturePerf) {
      clearExistingMs = performance.now() - refreshStartedAt;
    }
  }

  const scanStartedAt = capturePerf ? performance.now() : 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  const textNodes: Text[] = [];
  const maxNodesPerPass = options?.maxNodesPerPass ?? 15000;
  const lightTextCache = new WeakMap<Element, boolean>();

  while (walker.nextNode() && textNodes.length < maxNodesPerPass) {
    const textNode = walker.currentNode as Text;
    if (shouldSkipTextNode(textNode)) continue;
    textNodes.push(textNode);
  }
  const scanTextNodesMs = capturePerf ? performance.now() - scanStartedAt : 0;

  if (import.meta.env.DEV && textNodes.length >= maxNodesPerPass) {
    console.warn(
      `[ccx] Hit MAX_NODES_PER_PASS (${maxNodesPerPass}); some prices on this page may not be converted.`,
    );
  }

  let totalConversions = refreshedConversions;
  const decorateStartedAt = capturePerf ? performance.now() : 0;

  for (const node of textNodes) {
    totalConversions += decoratePricesInTextNode(
      node,
      preferredCurrency,
      rateSnapshot,
      localeHint,
      lightTextCache,
    );
  }

  totalConversions += decorateStructuredAmazonPrices(
    root,
    preferredCurrency,
    rateSnapshot,
    localeHint,
    lightTextCache,
  );

  totalConversions += decorateStructuredSiblingSymbolPrices(
    root,
    preferredCurrency,
    rateSnapshot,
    localeHint,
    lightTextCache,
  );

  if (capturePerf && options?.onPerfSample) {
    const decorateNodesMs = performance.now() - decorateStartedAt;

    options.onPerfSample({
      totalMs: performance.now() - totalStartedAt,
      clearExistingMs,
      scanTextNodesMs,
      decorateNodesMs,
      scannedTextNodes: textNodes.length,
      conversionsApplied: totalConversions,
      maxNodesPerPass,
      reachedNodeLimit: textNodes.length >= maxNodesPerPass,
    });
  }

  return totalConversions;
}
