import { CurrencyCode } from "@/utils/enums";
import { convertAmountWithSnapshot } from "@/utils/rateMath";
import { RateSnapshot } from "@/utils/rates";
import {
  extractCurrencyTextMatches,
  formatAmountInCurrency,
  type CurrencyTextMatch,
} from "@/utils/utils";

export const INLINE_CONVERSION_CLASS = "ccx-inline-conversion";
const INLINE_CONVERSION_STYLE_ID = "ccx-inline-conversion-style";
const INLINE_COMPACT_THRESHOLD = 1_000_000;
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

export type InlineConversionPerfSample = {
  totalMs: number;
  clearExistingMs: number;
  scanTextNodesMs: number;
  decorateNodesMs: number;
  scannedTextNodes: number;
  conversionsApplied: number;
  maxNodesPerPass: number;
  reachedNodeLimit: boolean;
};

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;

  if (!parent) return true;
  if (SKIP_TAGS.has(parent.tagName)) return true;
  if (parent.closest(`.${INLINE_CONVERSION_CLASS}`)) return true;

  return false;
}

function clearInlineConversions(root: ParentNode = document.body) {
  const convertedNodes = root.querySelectorAll(`span.${INLINE_CONVERSION_CLASS}`);
  if (!convertedNodes.length) return 0;

  convertedNodes.forEach((node) => {
    const originalText = node.getAttribute("data-original") || node.textContent || "";
    node.replaceWith(document.createTextNode(originalText));
  });

  if (root instanceof Element || root instanceof Document) {
    root.normalize();
  }

  return convertedNodes.length;
}

function getConvertedAmountText(
  match: Pick<CurrencyTextMatch, "value" | "rangeEndValue" | "currency">,
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

  const convertedUsesCompact = Math.abs(converted) >= INLINE_COMPACT_THRESHOLD;
  const formattedConverted = formatAmountInCurrency(converted, preferredCurrency, {
    localeHint,
    compactLargeValues: true,
    compactThreshold: INLINE_COMPACT_THRESHOLD,
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

    const rangeEndUsesCompact = Math.abs(convertedRangeEnd) >= INLINE_COMPACT_THRESHOLD;
    const formattedRangeEnd = formatAmountInCurrency(convertedRangeEnd, preferredCurrency, {
      localeHint,
      compactLargeValues: true,
      compactThreshold: INLINE_COMPACT_THRESHOLD,
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

  convertedNodes.forEach((node) => {
    const originalText = node.getAttribute("data-original") || node.textContent || "";
    if (!originalText.trim()) {
      node.replaceWith(document.createTextNode(originalText));
      return;
    }

    const parsed = extractCurrencyTextMatches(originalText, localeHint);
    const matched = parsed.find((item) => item.raw === originalText) || parsed[0];

    if (!matched) {
      node.replaceWith(document.createTextNode(originalText));
      return;
    }

    const convertedAmount = getConvertedAmountText(
      matched,
      preferredCurrency,
      rateSnapshot,
      localeHint,
    );

    if (!convertedAmount) {
      node.replaceWith(document.createTextNode(originalText));
      return;
    }

    node.textContent = `${originalText} (`;

    const convertedValueNode = document.createElement("span");
    convertedValueNode.className = "ccx-converted-amount";
    convertedValueNode.textContent = convertedAmount;

    node.appendChild(convertedValueNode);
    node.append(")");
    refreshedConversions += 1;
  });

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

function usesLightTextColor(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return false;

  const color = window.getComputedStyle(parent).color;
  const rgb = parseRgbChannels(color);
  if (!rgb) return false;

  return relativeLuminance(rgb) >= 0.6;
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
): number {
  const text = textNode.nodeValue;
  if (!text?.trim()) return 0;
  const lightTextContext = usesLightTextColor(textNode);

  const matches = extractCurrencyTextMatches(text, localeHint);
  if (!matches.length) return 0;

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
    if (lightTextContext) {
      wrapper.style.setProperty("--ccx-converted-color", "#93c5fd");
    } else {
      wrapper.style.setProperty("--ccx-converted-color", "#355aa8");
    }

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
