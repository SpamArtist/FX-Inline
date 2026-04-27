import { extractCurrencyTextMatches } from "@fx-inline/currency-detection";
import {
  INLINE_CONVERSION_ADDON_MODE,
  INLINE_CONVERSION_CLASS,
} from "./constants.js";
import { getConvertedAmountText } from "./amountFormatting.js";

const DEFAULT_CONVERTED_CURRENCY_POSITION = "right";
const DEFAULT_DISPLAY_STYLE = "brackets";

function getRenderPreferences(preferences) {
  return {
    convertedCurrencyPosition:
      preferences?.convertedCurrencyPosition ?? DEFAULT_CONVERTED_CURRENCY_POSITION,
    displayStyle: preferences?.displayStyle ?? DEFAULT_DISPLAY_STYLE,
  };
}

function getConvertedAmountPresentation(convertedAmount, preferences) {
  const { convertedCurrencyPosition, displayStyle } =
    getRenderPreferences(preferences);

  if (convertedCurrencyPosition === "tooltip") return convertedAmount;
  return displayStyle === "brackets" ? `(${convertedAmount})` : convertedAmount;
}

export function getOriginalText(node) {
  return node.getAttribute("data-original") || node.textContent || "";
}

export function replaceWithOriginalText(node, fallbackText) {
  node.replaceWith(
    document.createTextNode(fallbackText ?? getOriginalText(node)),
  );
}

export function isInlineConversionAddon(node) {
  return node.getAttribute("data-fx-inline-mode") === INLINE_CONVERSION_ADDON_MODE;
}

function ensureInlineConversionNodeRefs(wrapper) {
  const firstChild = wrapper.firstChild;
  const secondChild = wrapper.childNodes.item(1);
  const thirdChild = wrapper.childNodes.item(2);

  const hasExpectedShape =
    wrapper.childNodes.length === 3 &&
    firstChild instanceof Text &&
    secondChild instanceof HTMLSpanElement &&
    secondChild.classList.contains("fx-inline-converted-amount") &&
    thirdChild instanceof Text;

  if (hasExpectedShape) {
    return {
      prefixNode: firstChild,
      convertedValueNode: secondChild,
      suffixNode: thirdChild,
    };
  }

  wrapper.textContent = "";

  const prefixNode = document.createTextNode("");
  const convertedValueNode = document.createElement("span");
  convertedValueNode.className = "fx-inline-converted-amount";
  const suffixNode = document.createTextNode("");

  wrapper.append(prefixNode, convertedValueNode, suffixNode);

  return {
    prefixNode,
    convertedValueNode,
    suffixNode,
  };
}

export function setInlineConversionContent(
  wrapper,
  convertedAmount,
  options,
) {
  const { prefixNode, convertedValueNode, suffixNode } =
    ensureInlineConversionNodeRefs(wrapper);
  const renderPreferences = getRenderPreferences(options?.renderPreferences);
  const position = renderPreferences.convertedCurrencyPosition;
  const originalText = options?.originalText;
  const hasOriginalText = typeof originalText === "string" && originalText.length > 0;
  const convertedText = getConvertedAmountPresentation(
    convertedAmount,
    renderPreferences,
  );

  wrapper.removeAttribute("data-fx-inline-suppressed");
  wrapper.style.removeProperty("display");
  convertedValueNode.style.removeProperty("display");
  convertedValueNode.style.removeProperty("margin-left");
  wrapper.setAttribute("data-fx-inline-position", position);
  wrapper.removeAttribute("data-fx-inline-tooltip");
  wrapper.removeAttribute("title");

  if (position === "tooltip") {
    wrapper.removeAttribute("data-fx-inline-display-style");
    wrapper.setAttribute("data-fx-inline-tooltip", convertedAmount);
    wrapper.setAttribute("title", convertedAmount);
    prefixNode.nodeValue = hasOriginalText ? originalText : " ⓘ";
    convertedValueNode.textContent = convertedAmount;
    convertedValueNode.style.setProperty("display", "none");
    suffixNode.nodeValue = "";
    return;
  }

  wrapper.setAttribute("data-fx-inline-display-style", renderPreferences.displayStyle);
  convertedValueNode.textContent = convertedText;

  if (position === "left" || position === "top") {
    prefixNode.nodeValue = hasOriginalText ? "" : " ";
    suffixNode.nodeValue = hasOriginalText ? ` ${originalText}` : "";
    return;
  }

  prefixNode.nodeValue = hasOriginalText ? `${originalText} ` : " ";
  suffixNode.nodeValue = "";
}

export function applyConvertedAmountColor(
  wrapper,
  useLightColor,
) {
  wrapper.style.setProperty(
    "--fx-inline-converted-color",
    useLightColor ? "#93c5fd" : "#355aa8",
  );
}

export function clearInlineConversions(root = document.body) {
  const convertedNodes = root.querySelectorAll(`span.${INLINE_CONVERSION_CLASS}`);
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

export function suppressInlineConversions(root = document.body) {
  const convertedNodes = root.querySelectorAll(`span.${INLINE_CONVERSION_CLASS}`);
  if (!convertedNodes.length) return 0;

  for (const node of convertedNodes) {
    if (!(node instanceof HTMLSpanElement)) continue;

    node.setAttribute("data-fx-inline-suppressed", "true");

    if (isInlineConversionAddon(node)) {
      node.style.setProperty("display", "none");
      continue;
    }

    const { prefixNode, convertedValueNode, suffixNode } =
      ensureInlineConversionNodeRefs(node);

    prefixNode.nodeValue = getOriginalText(node);
    suffixNode.nodeValue = "";
    convertedValueNode.style.setProperty("display", "none");
  }

  return convertedNodes.length;
}

export function refreshExistingInlineConversions(
  preferredCurrency,
  rateSnapshot,
  root,
  localeHint,
  options = {},
) {
  const convertedNodes = root.querySelectorAll(`span.${INLINE_CONVERSION_CLASS}`);
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
    const matched = parsed.find((item) => item.raw === originalText) || parsed[0];

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
      options.baseCurrency,
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
      renderPreferences: options.renderPreferences,
    });
    refreshedConversions += 1;
  }

  return refreshedConversions;
}

export function getInlineAddonNode(root) {
  for (const child of root.children) {
    if (
      child instanceof HTMLSpanElement &&
      child.classList.contains(INLINE_CONVERSION_CLASS) &&
      child.getAttribute("data-fx-inline-mode") === INLINE_CONVERSION_ADDON_MODE
    ) {
      return child;
    }
  }

  return null;
}
