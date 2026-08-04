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
  INLINE_CONVERSION_ADDON_MODE,
  INLINE_CONVERSION_CLASS,
} from "./constants.js";
import { pushCoreConversionEvent } from "./conversionMetadata.js";
import {
  PRICE_TEXT_CLASS_AMOUNT_ONLY,
  PRICE_TEXT_CLASS_DIRECT_CURRENCY,
} from "./priceTextClassification.js";
import { usesLightTextColor } from "./textColor.js";

const NOOP_PERF_PHASES = {
  time(_phase, callback) {
    return callback();
  },
};

function areParsedValuesEqual(left, right) {
  const delta = Math.abs(left - right);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * 4;
  return delta <= tolerance;
}

function getNearestSiblingText(
  amountRoot,
  direction,
) {
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
  amountNode,
  amountText,
  localeHint,
) {
  const amountParsed = parseCurrencyValue(amountText, localeHint);
  if (!amountParsed.valid || amountParsed.value === undefined) return null;
  const amountValue = amountParsed.value;

  const amountRoot = amountNode.parentElement;
  if (!amountRoot) return null;

  const before = getNearestSiblingText(amountRoot, -1);
  const after = getNearestSiblingText(amountRoot, 1);
  const rawCandidates = [];

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
  textNode,
  amountText,
  preferredCurrency,
  rateSnapshot,
  localeHint,
  lightTextCache,
  passContext,
  passId,
  baseCurrency,
  renderPreferences,
  perfPhases = NOOP_PERF_PHASES,
) {
  const amountRoot = perfPhases.time("discoveryMs", () => textNode.parentElement);
  if (!amountRoot) return 0;
  const shouldSkip = perfPhases.time(
    "discoveryMs",
    () =>
      Boolean(amountRoot.closest(`.${INLINE_CONVERSION_CLASS}`)) ||
      Boolean(amountRoot.closest('[aria-hidden="true"]')),
  );
  if (shouldSkip) return 0;

  const rawPrice = perfPhases.time(
    "discoveryMs",
    () => getSplitSiblingRawPrice(textNode, amountText, localeHint),
  );
  const existingAddon = perfPhases.time(
    "discoveryMs",
    () => getInlineAddonNode(amountRoot),
  );
  if (!rawPrice) {
    perfPhases.time("renderMs", () => {
      existingAddon?.remove();
    });
    return 0;
  }

  const matched = perfPhases.time("analysisMs", () => {
    const parsed = extractCurrencyTextMatches(rawPrice, localeHint);
    return parsed.find((item) => item.raw === rawPrice) || parsed[0];
  });
  if (!matched) {
    perfPhases.time("renderMs", () => {
      existingAddon?.remove();
    });
    return 0;
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
    return 0;
  }

  return perfPhases.time("renderMs", () => {
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
    setInlineConversionContent(wrapper, convertedAmount, {
      renderPreferences,
    });

    if (!existingAddon) {
      amountRoot.appendChild(wrapper);
      pushCoreConversionEvent(passContext, passId, {
        source: "split-sibling",
        rawPrice,
        convertedAmount,
        hostNode: amountRoot,
        wrapperNode: wrapper,
      });
      return 1;
    }

    if (
      previousOriginal !== rawPrice ||
      !previousConverted?.includes(convertedAmount)
    ) {
      pushCoreConversionEvent(passContext, passId, {
        source: "split-sibling",
        rawPrice,
        convertedAmount,
        hostNode: amountRoot,
        wrapperNode: wrapper,
        refreshed: true,
      });
      return 1;
    }

    return 0;
  });
}

export function decoratePricesInTextNode(
  acceptedCandidate,
  preferredCurrency,
  rateSnapshot,
  localeHint,
  lightTextCache,
  passContext,
  passId,
  baseCurrency,
  renderPreferences,
  perfPhases = NOOP_PERF_PHASES,
) {
  const { textNode, kind, text: acceptedText } = acceptedCandidate;
  const text = perfPhases.time("discoveryMs", () => textNode.nodeValue);

  if (kind === PRICE_TEXT_CLASS_AMOUNT_ONLY) {
    return decorateSplitSiblingPriceInTextNode(
      textNode,
      acceptedText,
      preferredCurrency,
      rateSnapshot,
      localeHint,
      lightTextCache,
      passContext,
      passId,
      baseCurrency,
      renderPreferences,
      perfPhases,
    );
  }

  if (kind !== PRICE_TEXT_CLASS_DIRECT_CURRENCY) return 0;

  const matches = perfPhases.time(
    "analysisMs",
    () => extractCurrencyTextMatches(acceptedText, localeHint),
  );
  if (!matches.length) return 0;

  const lightTextContext = perfPhases.time(
    "analysisMs",
    () => usesLightTextColor(textNode, lightTextCache),
  );

  let cursor = 0;
  let conversionsApplied = 0;
  const fragment = perfPhases.time(
    "renderMs",
    () => document.createDocumentFragment(),
  );

  for (const match of matches) {
    if (match.start < cursor) continue;

    perfPhases.time("renderMs", () => {
      fragment.append(text.slice(cursor, match.start));
    });

    const convertedAmount = perfPhases.time(
      "analysisMs",
      () =>
        getConvertedAmountText(
          match,
          preferredCurrency,
          rateSnapshot,
          localeHint,
          baseCurrency,
        ),
    );
    if (!convertedAmount) {
      perfPhases.time("renderMs", () => {
        fragment.append(match.raw);
      });
      cursor = match.end;
      continue;
    }

    perfPhases.time("renderMs", () => {
      const wrapper = document.createElement("span");
      wrapper.className = INLINE_CONVERSION_CLASS;
      wrapper.setAttribute("data-original", match.raw);
      applyConvertedAmountColor(wrapper, lightTextContext);

      setInlineConversionContent(wrapper, convertedAmount, {
        originalText: match.raw,
        renderPreferences,
      });

      fragment.append(wrapper);
      pushCoreConversionEvent(passContext, passId, {
        source: "text-node",
        rawPrice: match.raw,
        convertedAmount,
        hostNode: textNode.parentElement,
        wrapperNode: wrapper,
        textRange: {
          start: match.start,
          end: match.end,
        },
      });
    });
    cursor = match.end;
    conversionsApplied += 1;
  }

  if (conversionsApplied === 0) return 0;

  perfPhases.time("renderMs", () => {
    fragment.append(text.slice(cursor));
    textNode.replaceWith(fragment);
  });

  return conversionsApplied;
}
