import {
  setCoreConversionSummary,
} from "./conversionMetadata.js";
import {
  clearInlineConversions,
  refreshExistingInlineConversions,
} from "./conversionNodes.js";
import { shouldSkipTextNode } from "./domGuards.js";
import { createInlinePassContext } from "./passContext.js";
import {
  INLINE_PLUGIN_PHASE_POST,
  INLINE_PLUGIN_PHASE_PRE,
  runInlineConversionPlugins,
} from "./pluginRunner.js";
import { ensureInlineConversionStyles } from "./styles.js";
import { decorateStructuredSiblingSymbolPrices } from "./structuredDecorators.js";
import { decoratePricesInTextNode } from "./textNodeDecorator.js";
import {
  PRICE_TEXT_CLASS_UNRELATED,
  classifyPriceText,
} from "./priceTextClassification.js";
import {
  amazonStructuredAddonPlugin,
  amazonStructuredDetectorPrePlugin,
} from "../plugins/amazon/structuredAddonPlugin.js";

const DEFAULT_PRE_PLUGINS = [amazonStructuredDetectorPrePlugin];
const DEFAULT_POST_PLUGINS = [amazonStructuredAddonPlugin];

export function convertVisiblePrices(
  preferredCurrency,
  rateSnapshot,
  root = document.body,
  options,
) {
  const passContext = createInlinePassContext();
  const passId = passContext.passId;

  try {
    ensureInlineConversionStyles();
    const localeHint = document.documentElement?.lang || null;
    const baseCurrency = options?.baseCurrency ?? null;
    const renderPreferences = options?.clientRenderPreferences?.default ?? null;
    let refreshedConversions = 0;

    if (options?.clearExisting !== false) {
      clearInlineConversions(root);
    } else if (options?.refreshExisting) {
      refreshedConversions = refreshExistingInlineConversions(
        preferredCurrency,
        rateSnapshot,
        root,
        localeHint,
        {
          baseCurrency,
          renderPreferences,
        },
      );
    }

    const maxNodesPerPass = options?.maxNodesPerPass ?? 15000;
    const lightTextCache = new WeakMap();
    const parentEligibilityCache = new WeakMap();
    const pluginContext = {
      root,
      preferredCurrency,
      rateSnapshot,
      baseCurrency,
      localeHint,
      lightTextCache,
      passId,
      passContext,
      clientRenderPreferences: options?.clientRenderPreferences ?? null,
      onPluginError: options?.onPluginError,
    };

    const includeDefaultPrePlugins = options?.includeDefaultPrePlugins !== false;
    const prePlugins = includeDefaultPrePlugins
      ? [...DEFAULT_PRE_PLUGINS, ...(options?.prePlugins ?? [])]
      : (options?.prePlugins ?? []);

    let totalConversions = refreshedConversions;

    const prePluginConversions = runInlineConversionPlugins(
      prePlugins,
      pluginContext,
      INLINE_PLUGIN_PHASE_PRE,
    );
    totalConversions += prePluginConversions;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    const acceptedTextCandidates = [];
    let visitedTextNodes = 0;

    while (
      acceptedTextCandidates.length < maxNodesPerPass &&
      walker.nextNode()
    ) {
      const textNode = walker.currentNode;
      visitedTextNodes += 1;
      const classification = classifyPriceText(textNode.nodeValue);
      if (classification.kind === PRICE_TEXT_CLASS_UNRELATED) continue;
      if (shouldSkipTextNode(textNode, parentEligibilityCache)) continue;
      acceptedTextCandidates.push({
        textNode,
        kind: classification.kind,
        text: classification.text,
      });
    }
    if (
      acceptedTextCandidates.length >= maxNodesPerPass &&
      options?.onNodeLimitReached
    ) {
      options.onNodeLimitReached(maxNodesPerPass);
    }

    let textNodeConversions = 0;
    for (const candidate of acceptedTextCandidates) {
      textNodeConversions += decoratePricesInTextNode(
        candidate,
        preferredCurrency,
        rateSnapshot,
        localeHint,
        lightTextCache,
        passContext,
        passId,
        baseCurrency,
        renderPreferences,
      );
    }
    totalConversions += textNodeConversions;

    const structuredConversions = decorateStructuredSiblingSymbolPrices(
      root,
      preferredCurrency,
      rateSnapshot,
      localeHint,
      lightTextCache,
      passContext,
      passId,
      baseCurrency,
      renderPreferences,
    );
    totalConversions += structuredConversions;

    const includeDefaultPostPlugins = options?.includeDefaultPostPlugins !== false;
    const postPlugins = includeDefaultPostPlugins
      ? [...DEFAULT_POST_PLUGINS, ...(options?.postPlugins ?? [])]
      : (options?.postPlugins ?? []);

    setCoreConversionSummary(passContext, passId, {
      stage: "before-post-plugins",
      refreshedConversions,
      prePluginConversions,
      textNodeConversions,
      structuredConversions,
      coreConversionsApplied: textNodeConversions + structuredConversions,
      visitedTextNodes,
      acceptedCandidates: acceptedTextCandidates.length,
      scannedTextNodes: acceptedTextCandidates.length,
      maxNodesPerPass,
      reachedNodeLimit: acceptedTextCandidates.length >= maxNodesPerPass,
    });

    const postPluginConversions = runInlineConversionPlugins(
      postPlugins,
      pluginContext,
      INLINE_PLUGIN_PHASE_POST,
    );
    totalConversions += postPluginConversions;

    setCoreConversionSummary(passContext, passId, {
      stage: "complete",
      refreshedConversions,
      prePluginConversions,
      textNodeConversions,
      structuredConversions,
      postPluginConversions,
      totalConversionsApplied: totalConversions,
      visitedTextNodes,
      acceptedCandidates: acceptedTextCandidates.length,
      scannedTextNodes: acceptedTextCandidates.length,
      maxNodesPerPass,
      reachedNodeLimit: acceptedTextCandidates.length >= maxNodesPerPass,
    });

    return totalConversions;
  } finally {
    passContext.clear();
  }
}
