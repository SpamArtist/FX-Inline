import { CurrencyCode } from "@/utils/enums";
import { convertAmountWithSnapshot } from "@/utils/rateMath";
import type { CurrencyTextMatch } from "@/utils/currencyUtils.types";
import type { RateSnapshot } from "@/utils/rates.types";
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

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;
  return (
    !parent ||
    SKIP_TAGS.has(parent.tagName) ||
    Boolean(parent.closest(`.${INLINE_CONVERSION_CLASS}`))
  );
}

function getOriginalText(node: Element): string {
  return node.getAttribute("data-original") || node.textContent || "";
}

function replaceWithOriginalText(node: Element, fallbackText?: string) {
  node.replaceWith(document.createTextNode(fallbackText ?? getOriginalText(node)));
}

function applyConvertedAmountColor(wrapper: HTMLSpanElement, useLightColor: boolean) {
  wrapper.style.setProperty(
    "--ccx-converted-color",
    useLightColor ? "#93c5fd" : "#355aa8",
  );
}

function clearInlineConversions(root: ParentNode = document.body) {
  const convertedNodes = root.querySelectorAll(`span.${INLINE_CONVERSION_CLASS}`);
  if (!convertedNodes.length) return 0;

  for (const node of convertedNodes) {
    replaceWithOriginalText(node);
  }

  if (root instanceof Element || root instanceof Document) {
    root.normalize();
  }

  return convertedNodes.length;
}

function getConvertedAmountText(
  match: Pick<CurrencyTextMatch, "raw" | "value" | "rangeEndValue" | "currency">,
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
  const formattedConverted = formatAmountInCurrency(converted, preferredCurrency, {
    localeHint,
    compactLargeValues: true,
    compactThreshold,
  });
  let convertedAmount = convertedUsesCompact ? `~${formattedConverted}` : formattedConverted;

  if (match.rangeEndValue !== undefined) {
    const convertedRangeEnd = convertAmountWithSnapshot(
      match.rangeEndValue,
      match.currency,
      preferredCurrency,
      rateSnapshot,
    );

    if (convertedRangeEnd === null) return null;

    const rangeEndUsesCompact = Math.abs(convertedRangeEnd) >= compactThreshold;
    const formattedRangeEnd = formatAmountInCurrency(convertedRangeEnd, preferredCurrency, {
      localeHint,
      compactLargeValues: true,
      compactThreshold,
    });
    const rangeApproximationPrefix =
      convertedUsesCompact || rangeEndUsesCompact ? "~" : "";
    convertedAmount =
      `${rangeApproximationPrefix}${formattedConverted}–${formattedRangeEnd}`;
  }

  return convertedAmount;
}

function refreshExistingInlineConversions(
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
  root: ParentNode,
  localeHint: string | null,
): number {
  const convertedNodes = root.querySelectorAll(`span.${INLINE_CONVERSION_CLASS}`);
  if (!convertedNodes.length) return 0;

  let refreshedConversions = 0;

  for (const node of convertedNodes) {
    const originalText = getOriginalText(node);
    if (!originalText.trim()) {
      replaceWithOriginalText(node, originalText);
      continue;
    }

    const parsed = extractCurrencyTextMatches(originalText, localeHint);
    const matched = parsed.find((item) => item.raw === originalText) || parsed[0];

    if (!matched) {
      replaceWithOriginalText(node, originalText);
      continue;
    }

    const convertedAmount = getConvertedAmountText(
      matched,
      preferredCurrency,
      rateSnapshot,
      localeHint,
    );

    if (!convertedAmount) {
      replaceWithOriginalText(node, originalText);
      continue;
    }

    node.textContent = `${originalText} (`;

    const convertedValueNode = document.createElement("span");
    convertedValueNode.className = "ccx-converted-amount";
    convertedValueNode.textContent = convertedAmount;

    node.appendChild(convertedValueNode);
    node.append(")");
    refreshedConversions += 1;
  }

  return refreshedConversions;
}

function parseRgbChannels(input: string): [number, number, number] | null {
  const matched = input.match(
    /rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,\/]+[\d.]+)?\s*\)/i,
  );
  if (!matched) return null;

  const r = Number(matched[1]);
  const g = Number(matched[2]);
  const b = Number(matched[3]);

  if (![r, g, b].every((value) => Number.isFinite(value) && value >= 0 && value <= 255)) {
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
  return 0.2126 * toLinearRgb(r) + 0.7152 * toLinearRgb(g) + 0.0722 * toLinearRgb(b);
}

function usesLightTextColor(
  node: Text,
  lightTextCache?: WeakMap<Element, boolean>,
): boolean {
  const parent = node.parentElement;
  if (!parent) return false;

  if (lightTextCache?.has(parent)) {
    return lightTextCache.get(parent) ?? false;
  }

  const color = window.getComputedStyle(parent).color;
  const rgb = parseRgbChannels(color);
  if (!rgb) {
    lightTextCache?.set(parent, false);
    return false;
  }

  const isLightText = relativeLuminance(rgb) >= 0.6;
  lightTextCache?.set(parent, isLightText);
  return isLightText;
}

function ensureInlineConversionStyles() {
  let styleTag = document.getElementById(INLINE_CONVERSION_STYLE_ID) as
    | HTMLStyleElement
    | null;

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

  const sortedMatches = [...matches].sort((a, b) => a.start - b.start);

  let cursor = 0;
  let conversionsApplied = 0;
  const fragment = document.createDocumentFragment();

  for (const match of sortedMatches) {
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

    wrapper.textContent = `${match.raw} (`;

    const convertedValueNode = document.createElement("span");
    convertedValueNode.className = "ccx-converted-amount";
    convertedValueNode.textContent = convertedAmount;

    wrapper.appendChild(convertedValueNode);
    wrapper.append(")");

    fragment.append(wrapper);
    cursor = match.end;
    conversionsApplied += 1;
  }

  if (conversionsApplied === 0) return 0;

  fragment.append(text.slice(cursor));
  textNode.replaceWith(fragment);

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

  textNodes.forEach((node) => {
    totalConversions += decoratePricesInTextNode(
      node,
      preferredCurrency,
      rateSnapshot,
      localeHint,
      lightTextCache,
    );
  });

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
