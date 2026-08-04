import { extractCurrencyTextMatches } from "@fx-inline/currency-detection";
import { getConvertedAmountText } from "../../core/amountFormatting.js";
import {
  applyConvertedAmountColor,
  setInlineConversionContent,
} from "../../core/conversionNodes.js";
import {
  INLINE_CONVERSION_ADDON_MODE,
  INLINE_CONVERSION_CLASS,
} from "../../core/constants.js";
import { usesLightTextColorForElement } from "../../core/textColor.js";
import {
  LITTLE_HOTELIER_PLUGIN_NAMESPACE,
  LITTLE_HOTELIER_PRICING_CANDIDATES_KEY,
  LITTLE_HOTELIER_SITE_ATTR,
  LITTLE_HOTELIER_SITE_KEY,
  collectLittleHotelierPricingCandidates,
  getLittleHotelierPricingRawPrice,
} from "./shared.js";

export const LITTLE_HOTELIER_PRICING_RENDERER_POST_PLUGIN_NAME =
  "littlehotelier-pricing-renderer";

const LITTLE_HOTELIER_ADDON_CLASS = "ccx-littlehotelier-pricing-addon";
const NOOP_PERF_PHASES = {
  time(_phase, callback) {
    return callback();
  },
};

function getLittleHotelierAddonNode(hostNode) {
  for (const child of hostNode.children) {
    if (
      child instanceof HTMLSpanElement &&
      child.classList.contains(INLINE_CONVERSION_CLASS) &&
      child.getAttribute("data-ccx-mode") === INLINE_CONVERSION_ADDON_MODE &&
      child.getAttribute(LITTLE_HOTELIER_SITE_ATTR) === LITTLE_HOTELIER_SITE_KEY
    ) {
      return child;
    }
  }

  return null;
}

function getLittleHotelierAddonNodes(root) {
  if (
    !(
      root instanceof Element ||
      root instanceof Document ||
      root instanceof DocumentFragment
    )
  ) {
    return [];
  }

  const selector = `span.${INLINE_CONVERSION_CLASS}[data-ccx-mode="${INLINE_CONVERSION_ADDON_MODE}"][${LITTLE_HOTELIER_SITE_ATTR}="${LITTLE_HOTELIER_SITE_KEY}"]`;
  const addons = [];

  if (root instanceof Element && root.matches(selector)) {
    addons.push(root);
  }

  addons.push(...root.querySelectorAll(selector));
  return addons;
}

function removeStaleLittleHotelierAddons(root, currentHosts) {
  for (const addon of getLittleHotelierAddonNodes(root)) {
    if (!currentHosts.has(addon.parentElement)) {
      addon.remove();
    }
  }
}

function setLittleHotelierAddonContent(wrapper, convertedAmount, renderPreferences) {
  setInlineConversionContent(wrapper, convertedAmount, {
    originalText: "",
    renderPreferences,
  });

  const prefixNode = wrapper.firstChild;
  if (prefixNode instanceof Text) {
    prefixNode.nodeValue = "≈ ";
  }
}

function getCandidateRoots(context) {
  const consumedCandidates = context.passContext.consume(
    LITTLE_HOTELIER_PLUGIN_NAMESPACE,
    LITTLE_HOTELIER_PRICING_CANDIDATES_KEY,
  );

  if (Array.isArray(consumedCandidates) && consumedCandidates.length > 0) {
    return consumedCandidates;
  }

  return collectLittleHotelierPricingCandidates(context.root);
}

export const littleHotelierPricingRendererPostPlugin = {
  name: LITTLE_HOTELIER_PRICING_RENDERER_POST_PLUGIN_NAME,
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
    const currentHosts = new Set();

    for (const candidate of candidates) {
      const hostNode = candidate?.hostNode;
      if (!(hostNode instanceof Element)) continue;
      perfPhases.time("discoveryMs", () => {
        if (!hostNode.isConnected) return;
        if (!root.contains(hostNode)) return;
        currentHosts.add(hostNode);
      });
    }

    perfPhases.time("renderMs", () => {
      removeStaleLittleHotelierAddons(root, currentHosts);
    });

    if (!candidates.length) return 0;

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
          getLittleHotelierPricingRawPrice(hostNode) ??
          candidate.rawPrice ??
          null,
      );
      const existingAddon = perfPhases.time(
        "discoveryMs",
        () => getLittleHotelierAddonNode(hostNode),
      );

      if (!rawPrice) {
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
          existingAddon?.querySelector(".ccx-converted-amount")?.textContent ?? null;

        const wrapper = existingAddon ?? document.createElement("span");
        wrapper.className = INLINE_CONVERSION_CLASS;
        wrapper.classList.add(LITTLE_HOTELIER_ADDON_CLASS);
        wrapper.setAttribute("data-ccx-mode", INLINE_CONVERSION_ADDON_MODE);
        wrapper.setAttribute(LITTLE_HOTELIER_SITE_ATTR, LITTLE_HOTELIER_SITE_KEY);
        wrapper.setAttribute("data-original", rawPrice);
        applyConvertedAmountColor(
          wrapper,
          usesLightTextColorForElement(hostNode, lightTextCache),
        );
        setLittleHotelierAddonContent(
          wrapper,
          convertedAmount,
          clientRenderPreferences?.default ?? null,
        );

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
