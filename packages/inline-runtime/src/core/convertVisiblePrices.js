import {
  clearInlineConversions,
  refreshExistingInlineConversions,
} from "./conversionNodes.js";
import { shouldSkipTextNode } from "./domGuards.js";
import {
  INLINE_PLUGIN_PHASE_POST,
  INLINE_PLUGIN_PHASE_PRE,
  runInlineConversionPlugins,
} from "./pluginRunner.js";
import { ensureInlineConversionStyles } from "./styles.js";
import { decorateStructuredSiblingSymbolPrices } from "./structuredDecorators.js";
import { decoratePricesInTextNode } from "./textNodeDecorator.js";
import { amazonStructuredAddonPlugin } from "../plugins/amazon/structuredAddonPlugin.js";

const DEFAULT_POST_PLUGINS = [amazonStructuredAddonPlugin];

export function convertVisiblePrices(
  preferredCurrency,
  rateSnapshot,
  root = document.body,
  options,
) {
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

  const textNodes = [];
  const maxNodesPerPass = options?.maxNodesPerPass ?? 15000;
  const lightTextCache = new WeakMap();
  const pluginContext = {
    root,
    preferredCurrency,
    rateSnapshot,
    localeHint,
    lightTextCache,
    onPluginError: options?.onPluginError,
  };

  while (walker.nextNode() && textNodes.length < maxNodesPerPass) {
    const textNode = walker.currentNode;
    if (shouldSkipTextNode(textNode)) continue;
    textNodes.push(textNode);
  }
  const scanTextNodesMs = capturePerf ? performance.now() - scanStartedAt : 0;

  if (textNodes.length >= maxNodesPerPass && options?.onNodeLimitReached) {
    options.onNodeLimitReached(maxNodesPerPass);
  }

  let totalConversions = refreshedConversions;
  const decorateStartedAt = capturePerf ? performance.now() : 0;

  totalConversions += runInlineConversionPlugins(
    options?.prePlugins,
    pluginContext,
    INLINE_PLUGIN_PHASE_PRE,
  );

  for (const node of textNodes) {
    totalConversions += decoratePricesInTextNode(
      node,
      preferredCurrency,
      rateSnapshot,
      localeHint,
      lightTextCache,
    );
  }

  totalConversions += decorateStructuredSiblingSymbolPrices(
    root,
    preferredCurrency,
    rateSnapshot,
    localeHint,
    lightTextCache,
  );

  const includeDefaultPostPlugins = options?.includeDefaultPostPlugins !== false;
  const postPlugins = includeDefaultPostPlugins
    ? [...DEFAULT_POST_PLUGINS, ...(options?.postPlugins ?? [])]
    : (options?.postPlugins ?? []);

  totalConversions += runInlineConversionPlugins(
    postPlugins,
    pluginContext,
    INLINE_PLUGIN_PHASE_POST,
  );

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
