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
  INLINE_CONVERSION_ADDON_MODE,
  INLINE_CONVERSION_CLASS,
} from "../../core/constants.js";
import { usesLightTextColorForElement } from "../../core/textColor.js";
import {
  AMAZON_PLUGIN_NAMESPACE,
  AMAZON_STRUCTURED_CANDIDATES_KEY,
  collectAmazonStructuredCandidates,
  getAmazonStructuredRawPrice,
} from "./shared.js";

export const AMAZON_STRUCTURED_ADDON_PLUGIN_NAME = "amazon-structured-addon";

const AMAZON_SITE_RENDER_KEY = "amazon";
const WRAPPER_CLASS_PREF_ATTR = "data-fx-inline-pref-wrapper-classes";
const CONVERTED_CLASS_PREF_ATTR = "data-fx-inline-pref-converted-classes";

function parseClassNames(classNameText) {
  if (typeof classNameText !== "string") return [];
  return classNameText
    .split(/\s+/u)
    .map((value) => value.trim())
    .filter(Boolean);
}

function syncPreferenceClassNames(node, attributeName, classNameText) {
  const previousClassNames = parseClassNames(node.getAttribute(attributeName));
  if (previousClassNames.length) {
    node.classList.remove(...previousClassNames);
  }

  const nextClassNames = parseClassNames(classNameText);
  if (nextClassNames.length) {
    node.classList.add(...nextClassNames);
    node.setAttribute(attributeName, nextClassNames.join(" "));
    return;
  }

  node.removeAttribute(attributeName);
}

function resolveAmazonRenderPreferences(allPreferences) {
  const defaultPreferences = allPreferences?.default ?? {};
  const sitePreferences = allPreferences?.sites?.[AMAZON_SITE_RENDER_KEY] ?? {};

  const resolved = {
    ...defaultPreferences,
    ...sitePreferences,
  };

  if (resolved.showOriginalPrice === undefined) {
    resolved.showOriginalPrice = false;
  }

  return resolved;
}

function applyRenderPreferences(
  wrapper,
  rawPrice,
  convertedAmount,
  preferences,
) {
  const showOriginalPrice = preferences.showOriginalPrice === true;
  setInlineConversionContent(wrapper, convertedAmount, {
    originalText: showOriginalPrice ? rawPrice : "",
    renderPreferences: preferences,
  });

  const prefixNode = wrapper.firstChild;
  const suffixNode = wrapper.childNodes.item(2);
  const convertedNode = wrapper.querySelector(".fx-inline-converted-amount");

  if (prefixNode instanceof Text) {
    const convertedPrefix = preferences.convertedPrefix ?? "";
    const originalPrefix = showOriginalPrice ? `${rawPrice} ` : "";
    prefixNode.nodeValue = `${convertedPrefix}${originalPrefix}`;
  }

  if (suffixNode instanceof Text) {
    suffixNode.nodeValue = preferences.convertedSuffix ?? "";
  }

  syncPreferenceClassNames(
    wrapper,
    WRAPPER_CLASS_PREF_ATTR,
    preferences.wrapperClassName,
  );

  if (convertedNode instanceof HTMLSpanElement) {
    syncPreferenceClassNames(
      convertedNode,
      CONVERTED_CLASS_PREF_ATTR,
      preferences.convertedAmountClassName,
    );
  }
}

function getCandidateRoots(context) {
  const consumedCandidates = context.passContext.consume(
    AMAZON_PLUGIN_NAMESPACE,
    AMAZON_STRUCTURED_CANDIDATES_KEY,
  );

  if (Array.isArray(consumedCandidates) && consumedCandidates.length > 0) {
    return consumedCandidates;
  }

  return collectAmazonStructuredCandidates(context.root);
}

export const amazonStructuredRendererPostPlugin = {
  name: AMAZON_STRUCTURED_ADDON_PLUGIN_NAME,
  phase: "post",
  apply({
    root,
    preferredCurrency,
    rateSnapshot,
    localeHint,
    lightTextCache,
    baseCurrency,
    clientRenderPreferences,
    passContext,
  }) {
    const candidates = getCandidateRoots({
      root,
      passContext,
    });
    if (!candidates.length) return 0;

    const renderPreferences = resolveAmazonRenderPreferences(
      clientRenderPreferences,
    );

    let conversionsApplied = 0;

    for (const candidate of candidates) {
      const hostNode = candidate?.hostNode;
      if (!(hostNode instanceof Element)) continue;
      if (!hostNode.isConnected) continue;
      if (!root.contains(hostNode)) continue;
      if (hostNode.closest(`.${INLINE_CONVERSION_CLASS}`)) continue;

      const rawPrice =
        getAmazonStructuredRawPrice(hostNode) ??
        candidate.detectedRawPrice ??
        null;
      const existingAddon = getInlineAddonNode(hostNode);

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
        baseCurrency,
      );
      if (!convertedAmount) {
        existingAddon?.remove();
        continue;
      }

      const previousOriginal = existingAddon?.getAttribute("data-original") ?? null;
      const previousConverted =
        existingAddon?.querySelector(".fx-inline-converted-amount")?.textContent ?? null;

      const wrapper = existingAddon ?? document.createElement("span");
      wrapper.className = INLINE_CONVERSION_CLASS;
      wrapper.setAttribute("data-fx-inline-mode", INLINE_CONVERSION_ADDON_MODE);
      wrapper.setAttribute("data-original", rawPrice);
      if (renderPreferences.colorStrategy === "inherit") {
        wrapper.style.setProperty("--fx-inline-converted-color", "currentColor");
      } else {
        applyConvertedAmountColor(
          wrapper,
          usesLightTextColorForElement(hostNode, lightTextCache),
        );
      }
      applyRenderPreferences(wrapper, rawPrice, convertedAmount, renderPreferences);

      if (!existingAddon) {
        hostNode.appendChild(wrapper);
        conversionsApplied += 1;
        continue;
      }

      if (
        previousOriginal !== rawPrice ||
        !previousConverted?.includes(convertedAmount)
      ) {
        conversionsApplied += 1;
      }
    }

    return conversionsApplied;
  },
};
