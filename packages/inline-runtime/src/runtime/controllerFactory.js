import {
  clearInlineConversions,
  suppressInlineConversions,
} from "../core/conversionNodes.js";
import { convertVisiblePrices } from "../core/convertVisiblePrices.js";
import { runPartialConversionPass } from "../core/partialPass.js";
import { collectMutationConversionRoots } from "../mutationRoots.js";
import {
  FULL_CONVERSION_DEBOUNCE_MS,
  MUTATION_SUPPRESSION_RELEASE_MS,
  PARTIAL_CONVERSION_CONTINUE_MS,
  PARTIAL_CONVERSION_DEBOUNCE_MS,
  PARTIAL_CONVERSION_MAX_NODES_PER_PASS,
  PARTIAL_CONVERSION_TIME_BUDGET_MS,
} from "./constants.js";

function clearTimer(timerRef) {
  if (timerRef.value !== null) {
    clearTimeout(timerRef.value);
    timerRef.value = null;
  }
}

function isTruthyNode(value) {
  return value instanceof Node;
}

export function createInlineRuntimeController(options = {}, loadRates) {
  let root = options.root ?? document.body;
  let baseCurrency = options.baseCurrency ?? null;
  let preferredCurrency = options.preferredCurrency ?? null;
  let rateSnapshot = options.rateSnapshot ?? null;
  let clientRenderPreferences = options.clientRenderPreferences ?? null;
  let enabled = options.enabled ?? true;
  let observeMutations = options.observeMutations ?? true;
  const autoFetchRates = options.autoFetchRates ?? false;

  let isRunning = false;
  let isApplyingInlineConversion = false;
  let suppressMutationDepth = 0;
  let isDestroyed = false;

  const pendingMutationRoots = new Set();

  const fullTimer = { value: null };
  const partialTimer = { value: null };

  let mutationObserver = null;

  function shouldIgnoreMutations() {
    return isApplyingInlineConversion || suppressMutationDepth > 0;
  }

  async function ensureRateSnapshot(forceRefresh = false) {
    if (rateSnapshot && !forceRefresh) return rateSnapshot;

    if (!autoFetchRates) {
      throw new Error(
        "FX Inline runtime missing rate snapshot. Provide `rateSnapshot` or enable `autoFetchRates`.",
      );
    }

    const ratesLoader = options.loadRates ?? loadRates;
    if (!ratesLoader) {
      throw new Error(
        "FX Inline runtime cannot auto-fetch rates without a rate loader.",
      );
    }

    rateSnapshot = await ratesLoader({ forceRefresh });
    return rateSnapshot;
  }

  function releaseMutationSuppression() {
    isApplyingInlineConversion = false;
    window.setTimeout(() => {
      if (isDestroyed) return;
      suppressMutationDepth = Math.max(0, suppressMutationDepth - 1);
    }, MUTATION_SUPPRESSION_RELEASE_MS);
  }

  async function runFullConversion(forceRatesRefresh = false) {
    if (!isRunning || isDestroyed) return;

    if (!root) {
      throw new Error("FX Inline runtime missing root node.");
    }

    if (!enabled) {
      pendingMutationRoots.clear();
      suppressInlineConversions(root);
      return;
    }

    if (!preferredCurrency) {
      throw new Error("FX Inline runtime missing preferred currency.");
    }

    const snapshot = await ensureRateSnapshot(forceRatesRefresh);

    isApplyingInlineConversion = true;
    suppressMutationDepth += 1;

    try {
      convertVisiblePrices(preferredCurrency, snapshot, root, {
        clearExisting: false,
        refreshExisting: true,
        onNodeLimitReached: options.onNodeLimitReached,
        includeDefaultPrePlugins: options.includeDefaultPrePlugins,
        prePlugins: options.prePlugins,
        postPlugins: options.postPlugins,
        includeDefaultPostPlugins: options.includeDefaultPostPlugins,
        clientRenderPreferences,
        baseCurrency,
        onPluginError: options.onPluginError,
      });
    } finally {
      releaseMutationSuppression();
    }
  }

  async function scheduleFullConversion(delayMs = FULL_CONVERSION_DEBOUNCE_MS, forceRatesRefresh = false) {
    if (!isRunning || isDestroyed) return;

    clearTimer(fullTimer);
    fullTimer.value = window.setTimeout(() => {
      fullTimer.value = null;
      void runFullConversion(forceRatesRefresh).catch((error) => {
        options.onError?.(error);
      });
    }, delayMs);
  }

  function schedulePartialConversion(delayMs = PARTIAL_CONVERSION_DEBOUNCE_MS) {
    if (!isRunning || isDestroyed) return;

    clearTimer(partialTimer);
    partialTimer.value = window.setTimeout(() => {
      partialTimer.value = null;
      if (!isRunning || isDestroyed) return;

      if (!pendingMutationRoots.size) return;

      if (!enabled) {
        pendingMutationRoots.clear();
        return;
      }

      if (!rateSnapshot || !preferredCurrency) {
        pendingMutationRoots.clear();
        void scheduleFullConversion();
        return;
      }

      const roots = Array.from(pendingMutationRoots);
      pendingMutationRoots.clear();

      isApplyingInlineConversion = true;
      suppressMutationDepth += 1;

      try {
        const {
          deferredRoots,
        } = runPartialConversionPass(
          roots,
          pendingMutationRoots,
          preferredCurrency,
          rateSnapshot,
          {
            timeBudgetMs: PARTIAL_CONVERSION_TIME_BUDGET_MS,
            maxNodesPerPass: PARTIAL_CONVERSION_MAX_NODES_PER_PASS,
            includeDefaultPrePlugins: options.includeDefaultPrePlugins,
            prePlugins: options.prePlugins,
            postPlugins: options.postPlugins,
            includeDefaultPostPlugins: options.includeDefaultPostPlugins,
            clientRenderPreferences,
            baseCurrency,
            onPluginError: options.onPluginError,
          },
        );

        if (deferredRoots > 0) {
          schedulePartialConversion(PARTIAL_CONVERSION_CONTINUE_MS);
        }
      } finally {
        releaseMutationSuppression();
      }
    }, delayMs);
  }

  function enqueueMutationRoots(roots) {
    if (!isRunning || isDestroyed) return;

    for (const rootNode of roots) {
      if (!isTruthyNode(rootNode)) continue;
      pendingMutationRoots.add(rootNode);
    }

    if (!pendingMutationRoots.size) return;
    schedulePartialConversion();
  }

  function handleMutations(mutations) {
    if (shouldIgnoreMutations()) return;

    const roots = collectMutationConversionRoots(mutations, options.shouldExcludeMutationRoot);
    if (!roots.length) return;
    enqueueMutationRoots(roots);
  }

  function start() {
    if (isDestroyed) {
      throw new Error("FX Inline runtime controller is destroyed.");
    }

    if (isRunning) return;

    if (!root) {
      root = document.body;
    }

    if (!root) {
      throw new Error("FX Inline runtime cannot start without a root node.");
    }

    isRunning = true;

    if (observeMutations) {
      mutationObserver = new MutationObserver(handleMutations);
      mutationObserver.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    void scheduleFullConversion();
  }

  function stop() {
    if (!isRunning) return;

    isRunning = false;
    pendingMutationRoots.clear();

    clearTimer(fullTimer);
    clearTimer(partialTimer);

    mutationObserver?.disconnect();
    mutationObserver = null;
  }

  function refresh(refreshOptions = {}) {
    if (refreshOptions.clearExisting) {
      clearInlineConversions(root);
    }

    if (refreshOptions.forceRatesRefresh && autoFetchRates) {
      rateSnapshot = null;
    }

    void scheduleFullConversion(0, Boolean(refreshOptions.forceRatesRefresh));
  }

  function setPreferredCurrency(nextCurrency) {
    preferredCurrency = nextCurrency;
    if (isRunning) {
      void scheduleFullConversion();
    }
  }

  function setBaseCurrency(nextCurrency) {
    baseCurrency = nextCurrency;
    if (isRunning) {
      void scheduleFullConversion();
    }
  }

  function setRateSnapshot(snapshot) {
    rateSnapshot = snapshot;
    if (isRunning) {
      void scheduleFullConversion();
    }
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);

    if (!enabled && root) {
      pendingMutationRoots.clear();
      suppressInlineConversions(root);
      return;
    }

    if (enabled && isRunning) {
      void scheduleFullConversion();
    }
  }

  function setClientRenderPreferences(nextPreferences) {
    clientRenderPreferences = nextPreferences ?? null;
    if (isRunning) {
      void scheduleFullConversion();
    }
  }

  function setRoot(nextRoot) {
    if (!(nextRoot instanceof Node)) {
      throw new Error("FX Inline runtime root must be a Node.");
    }

    const wasRunning = isRunning;
    if (wasRunning) {
      stop();
    }

    root = nextRoot;

    if (wasRunning) {
      start();
    }
  }

  function setObserveMutations(nextObserveMutations) {
    observeMutations = Boolean(nextObserveMutations);

    if (!isRunning) return;

    mutationObserver?.disconnect();
    mutationObserver = null;

    if (observeMutations) {
      mutationObserver = new MutationObserver(handleMutations);
      mutationObserver.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }

  function destroy() {
    if (isDestroyed) return;
    stop();
    isDestroyed = true;
  }

  return {
    start,
    stop,
    refresh,
    setBaseCurrency,
    setPreferredCurrency,
    setRateSnapshot,
    setEnabled,
    setClientRenderPreferences,
    destroy,
    enqueueMutationRoots,
    shouldIgnoreMutations,
    setRoot,
    setObserveMutations,
  };
}
