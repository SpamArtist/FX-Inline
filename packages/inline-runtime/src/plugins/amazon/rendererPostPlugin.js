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
const NOOP_PERF_PHASES = {
  time(_phase, callback) {
    return callback();
  },
};

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
    perfPhases = NOOP_PERF_PHASES,
  }) {
    const candidates = perfPhases.time(
      "discoveryMs",
      () =>
        getCandidateRoots({
          root,
          passContext,
        }),
    );
    if (!candidates.length) return 0;

    const renderPreferences = perfPhases.time(
      "setupMs",
      () => resolveAmazonRenderPreferences(clientRenderPreferences),
    );

    let conversionsApplied = 0;

    for (const candidate of candidates) {
      const hostNode = candidate?.hostNode;
      if (!(hostNode instanceof Element)) continue;
      const isEligible = perfPhases.time(
        "discoveryMs",
        () =>
          hostNode.isConnected &&
          root.contains(hostNode) &&
          !hostNode.closest(`.${INLINE_CONVERSION_CLASS}`),
      );
      if (!isEligible) continue;

      const rawPrice = perfPhases.time(
        "discoveryMs",
        () =>
          getAmazonStructuredRawPrice(hostNode) ??
          candidate.detectedRawPrice ??
          null,
      );
      const existingAddon = perfPhases.time(
        "discoveryMs",
        () => getInlineAddonNode(hostNode),
      );

      if (!rawPrice || !mayContainCurrencyToken(rawPrice)) {
        perfPhases.time("renderMs", () => {
          existingAddon?.remove();
        });
        continue;
      }

      const matched = perfPhases.time("analysisMs", () => {
        const parsed = extractCurrencyTextMatches(rawPrice, localeHint);
        return parsed.find((item) => item.raw === rawPrice) || parsed[0];
      });
      if (!matched) {
        perfPhases.time("renderMs", () => {
          existingAddon?.remove();
        });
        continue;
      }

      const convertedAmount = perfPhases.time(
        "analysisMs",
        () =>
          getConvertedAmountText(
            matched,
            preferredCurrency,
            rateSnapshot,
            localeHint,
            baseCurrency,
          ),
      );
      if (!convertedAmount) {
        perfPhases.time("renderMs", () => {
          existingAddon?.remove();
        });
        continue;
      }

      conversionsApplied += perfPhases.time("renderMs", () => {
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
          return 1;
        }

        if (
          previousOriginal !== rawPrice ||
          !previousConverted?.includes(convertedAmount)
        ) {
          return 1;
        }

        return 0;
      });
    }

    return conversionsApplied;
  },
};
