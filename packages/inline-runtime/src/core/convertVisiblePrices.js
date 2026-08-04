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
const PERF_PHASES = ["setupMs", "discoveryMs", "analysisMs", "renderMs"];

function createPerfPhaseTimer(capturePerf) {
  const durations = {
    setupMs: 0,
    discoveryMs: 0,
    analysisMs: 0,
    renderMs: 0,
  };
  let activePhase = null;
  let lastMark = 0;

  function time(phase, callback) {
    if (!capturePerf) return callback();

    const startedAt = performance.now();
    if (activePhase) {
      durations[activePhase] += startedAt - lastMark;
    }

    const previousPhase = activePhase;
    activePhase = phase;
    lastMark = startedAt;

    try {
      return callback();
    } finally {
      const finishedAt = performance.now();
      durations[phase] += finishedAt - lastMark;
      activePhase = previousPhase;
      lastMark = finishedAt;
    }
  }

  function total() {
    return PERF_PHASES.reduce((sum, phase) => sum + durations[phase], 0);
  }

  return {
    durations,
    time,
    total,
  };
}

export function convertVisiblePrices(
  preferredCurrency,
  rateSnapshot,
  root = document.body,
  options,
) {
  const capturePerf = Boolean(options?.onPerfSample);
  const perfPhases = createPerfPhaseTimer(capturePerf);
  let passContext = null;
  let passContextCleared = false;

  try {
    passContext = perfPhases.time("setupMs", () => createInlinePassContext());
    const passId = passContext.passId;

    const {
      localeHint,
      baseCurrency,
      renderPreferences,
      maxNodesPerPass,
      lightTextCache,
      parentEligibilityCache,
      pluginContext,
      prePlugins,
    } = perfPhases.time("setupMs", () => {
      ensureInlineConversionStyles();
      const resolvedLocaleHint = document.documentElement?.lang || null;
      const resolvedBaseCurrency = options?.baseCurrency ?? null;
      const resolvedRenderPreferences =
        options?.clientRenderPreferences?.default ?? null;
      const resolvedMaxNodesPerPass = options?.maxNodesPerPass ?? 15000;
      const resolvedLightTextCache = new WeakMap();
      const resolvedParentEligibilityCache = new WeakMap();
      const resolvedPluginContext = {
        root,
        preferredCurrency,
        rateSnapshot,
        baseCurrency: resolvedBaseCurrency,
        localeHint: resolvedLocaleHint,
        lightTextCache: resolvedLightTextCache,
        passId,
        passContext,
        perfPhases,
        clientRenderPreferences: options?.clientRenderPreferences ?? null,
        onPluginError: options?.onPluginError,
      };
      const resolvedIncludeDefaultPrePlugins =
        options?.includeDefaultPrePlugins !== false;
      const resolvedPrePlugins = resolvedIncludeDefaultPrePlugins
        ? [...DEFAULT_PRE_PLUGINS, ...(options?.prePlugins ?? [])]
        : (options?.prePlugins ?? []);

      return {
        localeHint: resolvedLocaleHint,
        baseCurrency: resolvedBaseCurrency,
        renderPreferences: resolvedRenderPreferences,
        maxNodesPerPass: resolvedMaxNodesPerPass,
        lightTextCache: resolvedLightTextCache,
        parentEligibilityCache: resolvedParentEligibilityCache,
        pluginContext: resolvedPluginContext,
        prePlugins: resolvedPrePlugins,
      };
    });
    let refreshedConversions = 0;

    perfPhases.time("setupMs", () => {
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
    });

    let totalConversions = refreshedConversions;

    const prePluginConversions = perfPhases.time(
      "discoveryMs",
      () =>
        runInlineConversionPlugins(
          prePlugins,
          pluginContext,
          INLINE_PLUGIN_PHASE_PRE,
        ),
    );
    totalConversions += prePluginConversions;

    const acceptedTextCandidates = [];
    let visitedTextNodes = 0;

    perfPhases.time("discoveryMs", () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

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
    });

    if (
      acceptedTextCandidates.length >= maxNodesPerPass &&
      options?.onNodeLimitReached
    ) {
      perfPhases.time("discoveryMs", () => {
        options.onNodeLimitReached(maxNodesPerPass);
      });
    }

    let textNodeConversions = 0;
    perfPhases.time("analysisMs", () => {
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
          perfPhases,
        );
      }
    });
    totalConversions += textNodeConversions;

    const structuredConversions = perfPhases.time(
      "discoveryMs",
      () =>
        decorateStructuredSiblingSymbolPrices(
          root,
          preferredCurrency,
          rateSnapshot,
          localeHint,
          lightTextCache,
          passContext,
          passId,
          baseCurrency,
          renderPreferences,
          perfPhases,
        ),
    );
    totalConversions += structuredConversions;

    const postPlugins = perfPhases.time("setupMs", () => {
      const includeDefaultPostPlugins =
        options?.includeDefaultPostPlugins !== false;
      return includeDefaultPostPlugins
        ? [...DEFAULT_POST_PLUGINS, ...(options?.postPlugins ?? [])]
        : (options?.postPlugins ?? []);
    });

    perfPhases.time("setupMs", () => {
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
    });

    const postPluginConversions = perfPhases.time(
      "renderMs",
      () =>
        runInlineConversionPlugins(
          postPlugins,
          pluginContext,
          INLINE_PLUGIN_PHASE_POST,
        ),
    );
    totalConversions += postPluginConversions;

    perfPhases.time("setupMs", () => {
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
    });

    perfPhases.time("setupMs", () => {
      passContext.clear();
      passContextCleared = true;
    });

    if (capturePerf && options?.onPerfSample) {
      const phaseDurations = perfPhases.durations;

      options.onPerfSample({
        setupMs: phaseDurations.setupMs,
        discoveryMs: phaseDurations.discoveryMs,
        analysisMs: phaseDurations.analysisMs,
        renderMs: phaseDurations.renderMs,
        totalMs: perfPhases.total(),
        visitedTextNodes,
        acceptedCandidates: acceptedTextCandidates.length,
        scannedTextNodes: acceptedTextCandidates.length,
        conversionsApplied: totalConversions,
        maxNodesPerPass,
        reachedNodeLimit: acceptedTextCandidates.length >= maxNodesPerPass,
      });
    }

    return totalConversions;
  } finally {
    if (passContext && !passContextCleared) {
      perfPhases.time("setupMs", () => {
        passContext.clear();
      });
    }
  }
}
