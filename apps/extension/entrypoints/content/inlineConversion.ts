import { CurrencyCode } from "@/utils/enums";
import { RateSnapshot, convertAmountWithSnapshot } from "@/utils/rates";
import { extractCurrencyTextMatches, formatAmountInCurrency } from "@/utils/utils";

export const INLINE_CONVERSION_CLASS = "ccx-inline-conversion";
const INLINE_CONVERSION_STYLE_ID = "ccx-inline-conversion-style";

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

  if (!parent) return true;
  if (SKIP_TAGS.has(parent.tagName)) return true;
  if (parent.closest(`.${INLINE_CONVERSION_CLASS}`)) return true;

  return false;
}

function clearInlineConversions(root: ParentNode = document.body) {
  const convertedNodes = root.querySelectorAll(`span.${INLINE_CONVERSION_CLASS}`);

  convertedNodes.forEach((node) => {
    const originalText = node.getAttribute("data-original") || node.textContent || "";
    node.replaceWith(document.createTextNode(originalText));
  });

  if (root instanceof Element || root instanceof Document) {
    root.normalize();
  }
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
  }

  styleTag.textContent = `
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
}

function decoratePricesInTextNode(
  textNode: Text,
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
): number {
  const text = textNode.nodeValue;
  if (!text?.trim()) return 0;
  const lightTextContext = usesLightTextColor(textNode);

  const matches = extractCurrencyTextMatches(text);
  if (!matches.length) return 0;

  const sortedMatches = [...matches].sort((a, b) => a.start - b.start);

  let cursor = 0;
  let conversionsApplied = 0;
  const fragment = document.createDocumentFragment();

  for (const match of sortedMatches) {
    if (match.start < cursor) continue;

    fragment.append(text.slice(cursor, match.start));

    if (match.currency === preferredCurrency) {
      fragment.append(match.raw);
      cursor = match.end;
      continue;
    }

    const converted = convertAmountWithSnapshot(
      match.value,
      match.currency,
      preferredCurrency,
      rateSnapshot,
    );

    if (converted === null) {
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

    const convertedAmount = formatAmountInCurrency(converted, preferredCurrency);
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
    maxNodesPerPass?: number;
  },
): number {
  ensureInlineConversionStyles();
  if (options?.clearExisting !== false) {
    clearInlineConversions(root);
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  const textNodes: Text[] = [];
  const maxNodesPerPass = options?.maxNodesPerPass ?? 15000;

  while (walker.nextNode() && textNodes.length < maxNodesPerPass) {
    const textNode = walker.currentNode as Text;
    if (shouldSkipTextNode(textNode)) continue;
    textNodes.push(textNode);
  }

  if (import.meta.env.DEV && textNodes.length >= maxNodesPerPass) {
    console.warn(
      `[ccx] Hit MAX_NODES_PER_PASS (${maxNodesPerPass}); some prices on this page may not be converted.`,
    );
  }

  let totalConversions = 0;

  textNodes.forEach((node) => {
    totalConversions += decoratePricesInTextNode(
      node,
      preferredCurrency,
      rateSnapshot,
    );
  });

  return totalConversions;
}
