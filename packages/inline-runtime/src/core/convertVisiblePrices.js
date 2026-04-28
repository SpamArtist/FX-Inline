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
  const passContext = createInlinePassContext(options?.createPassId?.());
  const passId = passContext.passId;

  try {
    const capturePerf = Boolean(options?.onPerfSample);
    const totalStartedAt = capturePerf ? performance.now() : 0;

    ensureInlineConversionStyles();
    const localeHint = document.documentElement?.lang || null;
    const baseCurrency = options?.baseCurrency ?? null;
    const renderPreferences = options?.clientRenderPreferences?.default ?? null;
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
        {
          baseCurrency,
          renderPreferences,
        },
      );
      if (capturePerf) {
        clearExistingMs = performance.now() - refreshStartedAt;
      }
    }

    const maxNodesPerPass = options?.maxNodesPerPass ?? 15000;
    const lightTextCache = new WeakMap();
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
    const decorateStartedAt = capturePerf ? performance.now() : 0;

    const prePluginConversions = runInlineConversionPlugins(
      prePlugins,
      pluginContext,
      INLINE_PLUGIN_PHASE_PRE,
    );
    totalConversions += prePluginConversions;

    const scanStartedAt = capturePerf ? performance.now() : 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    const textNodes = [];

    while (walker.nextNode() && textNodes.length < maxNodesPerPass) {
      const textNode = walker.currentNode;
      if (shouldSkipTextNode(textNode)) continue;
      textNodes.push(textNode);
    }
    const scanTextNodesMs = capturePerf ? performance.now() - scanStartedAt : 0;

    if (textNodes.length >= maxNodesPerPass && options?.onNodeLimitReached) {
      options.onNodeLimitReached(maxNodesPerPass);
    }

    let textNodeConversions = 0;
    for (const node of textNodes) {
      textNodeConversions += decoratePricesInTextNode(
        node,
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
      scannedTextNodes: textNodes.length,
      maxNodesPerPass,
      reachedNodeLimit: textNodes.length >= maxNodesPerPass,
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
      scannedTextNodes: textNodes.length,
      maxNodesPerPass,
      reachedNodeLimit: textNodes.length >= maxNodesPerPass,
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
  } finally {
    passContext.clear();
  }
}
