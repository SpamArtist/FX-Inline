import type { UserSettings } from "@/utils/appStorage.types";
import { getUserSettings } from "@/utils/appStorage";
import type { ContentConversionRuntime } from "./content.types";
import type { RateSnapshot } from "@/utils/rates.types";
import { getRates } from "@/utils/rates";
import { convertVisiblePrices } from "./inlineConversion";
import {
  addInlinePerfSample,
  createInlineConversionPerfAggregate,
  createPerfLogger,
} from "./perfLogger";

const PARTIAL_CONVERSION_DEBOUNCE_MS = 120;
const PARTIAL_CONVERSION_CONTINUE_MS = 28;
const PARTIAL_CONVERSION_TIME_BUDGET_MS = 16;

function isUserSettingsSnapshot(
  value: UserSettings | null | undefined,
): value is UserSettings {
  return typeof value?.preferredCurrency === "string";
}

export type { ContentConversionRuntime } from "./content.types";

export function createContentConversionRuntime(): ContentConversionRuntime {
  const perfLogger = createPerfLogger("ccx");
  const perfLoggingEnabled = perfLogger.enabled;
  const logPerf = perfLogger.log;
  const roundMs = perfLogger.roundMs;

  let settings: Awaited<ReturnType<typeof getUserSettings>> | null = null;
  let rateSnapshot: RateSnapshot | null = null;

  let conversionDebounceTimer: number | null = null;
  let partialConversionTimer: number | null = null;
  let hydrationRetryTimer: number | null = null;
  let settingsRefreshTimer: number | null = null;
  let isApplyingInlineConversion = false;
  let suppressMutationDepth = 0;
  let isHydratingRates = false;

  const pendingMutationRoots = new Set<ParentNode>();

  function releaseMutationSuppression() {
    isApplyingInlineConversion = false;
    window.setTimeout(() => {
      suppressMutationDepth = Math.max(0, suppressMutationDepth - 1);
    }, 400);
  }

  function clearTimer(timer: number | null): number | null {
    if (timer) {
      window.clearTimeout(timer);
    }

    return null;
  }

  function logSettingsStorageUpdate(
    startedAt: number,
    payload: {
      refreshed: boolean;
      missingRateSnapshot: boolean;
      preferredCurrencyChanged: boolean;
    },
  ) {
    if (!perfLoggingEnabled) return;

    logPerf("onSettingsStorageUpdate", {
      ...payload,
      durationMs: roundMs(performance.now() - startedAt),
    });
  }

  async function refreshSettingsAndRates(forceRefresh = false) {
    const startedAt = perfLoggingEnabled ? performance.now() : 0;

    settings = await getUserSettings();
    rateSnapshot = await getRates({ forceRefresh });

    if (perfLoggingEnabled) {
      logPerf("refreshSettingsAndRates", {
        forceRefresh,
        preferredCurrency: settings.preferredCurrency,
        rateSource: rateSnapshot.source ?? "unavailable",
        durationMs: roundMs(performance.now() - startedAt),
      });
    }
  }

  async function hydrateSettingsAndRates(forceRefresh = false) {
    if (isHydratingRates && !forceRefresh) return;
    isHydratingRates = true;

    try {
      await refreshSettingsAndRates(forceRefresh);
    } finally {
      isHydratingRates = false;
    }
  }

  function scheduleHydrationRetry() {
    if (hydrationRetryTimer) return;

    hydrationRetryTimer = window.setTimeout(() => {
      hydrationRetryTimer = null;
      scheduleInlineConversion();
    }, 3000);
  }

  function scheduleInlineConversion() {
    if (conversionDebounceTimer) {
      window.clearTimeout(conversionDebounceTimer);
    }

    conversionDebounceTimer = window.setTimeout(() => {
      if (!settings || !rateSnapshot) {
        void hydrateSettingsAndRates()
          .then(() => {
            if (settings && rateSnapshot) {
              scheduleInlineConversion();
              return;
            }

            console.warn("[ccx] Missing settings/rates after hydration; retrying");
            scheduleHydrationRetry();
          })
          .catch((error) => {
            console.warn("[ccx] Failed to hydrate rates for inline conversion", error);
            scheduleHydrationRetry();
          });

        return;
      }

      isApplyingInlineConversion = true;
      suppressMutationDepth += 1;

      try {
        const preferredCurrency = settings.preferredCurrency;
        convertVisiblePrices(
          preferredCurrency,
          rateSnapshot,
          document.body,
          {
            clearExisting: false,
            refreshExisting: true,
            ...(perfLoggingEnabled
              ? {
                onPerfSample: (sample) => {
                  logPerf("inlineConversion.full", {
                    preferredCurrency,
                    conversions: sample.conversionsApplied,
                    pendingMutationRoots: pendingMutationRoots.size,
                    totalMs: roundMs(sample.totalMs),
                    clearExistingMs: roundMs(sample.clearExistingMs),
                    scanTextNodesMs: roundMs(sample.scanTextNodesMs),
                    decorateNodesMs: roundMs(sample.decorateNodesMs),
                    scannedTextNodes: sample.scannedTextNodes,
                    reachedNodeLimit: sample.reachedNodeLimit,
                  });
                },
              }
              : {}),
          },
        );
      } finally {
        releaseMutationSuppression();
      }
    }, 200);
  }

  function schedulePartialInlineConversion(delayMs = PARTIAL_CONVERSION_DEBOUNCE_MS) {
    if (partialConversionTimer) {
      window.clearTimeout(partialConversionTimer);
    }

    partialConversionTimer = window.setTimeout(() => {
      partialConversionTimer = null;

      if (!pendingMutationRoots.size) return;

      if (!settings || !rateSnapshot) {
        pendingMutationRoots.clear();
        scheduleInlineConversion();
        return;
      }

      const roots = Array.from(pendingMutationRoots);
      pendingMutationRoots.clear();

      isApplyingInlineConversion = true;
      suppressMutationDepth += 1;

      try {
        const preferredCurrency = settings.preferredCurrency;
        let conversions = 0;
        let connectedRoots = 0;
        let deferredRoots = 0;
        const passStartedAt = performance.now();
        const perfAggregate = perfLoggingEnabled
          ? createInlineConversionPerfAggregate()
          : null;

        for (let index = 0; index < roots.length; index += 1) {
          if (
            connectedRoots > 0 &&
            performance.now() - passStartedAt >= PARTIAL_CONVERSION_TIME_BUDGET_MS
          ) {
            for (let remainderIndex = index; remainderIndex < roots.length; remainderIndex += 1) {
              pendingMutationRoots.add(roots[remainderIndex]);
              deferredRoots += 1;
            }

            break;
          }

          const root = roots[index];
          if (!(root instanceof Node) || !root.isConnected) continue;
          connectedRoots += 1;

          conversions += convertVisiblePrices(preferredCurrency, rateSnapshot, root, {
            clearExisting: false,
            maxNodesPerPass: 4000,
            onPerfSample: perfAggregate
              ? (sample) => {
                  addInlinePerfSample(perfAggregate, sample);
                }
              : undefined,
          });
        }

        if (deferredRoots > 0) {
          schedulePartialInlineConversion(PARTIAL_CONVERSION_CONTINUE_MS);
        }

        if (perfAggregate) {
          logPerf("inlineConversion.partial", {
            preferredCurrency,
            rootsQueued: roots.length,
            rootsProcessed: connectedRoots,
            rootsDeferred: deferredRoots,
            conversions,
            totalMs: roundMs(perfAggregate.totalMs),
            clearExistingMs: roundMs(perfAggregate.clearExistingMs),
            scanTextNodesMs: roundMs(perfAggregate.scanTextNodesMs),
            decorateNodesMs: roundMs(perfAggregate.decorateNodesMs),
            scannedTextNodes: perfAggregate.scannedTextNodes,
            reachedNodeLimitPasses: perfAggregate.reachedNodeLimitPasses,
          });
        }
      } finally {
        releaseMutationSuppression();
      }
    }, delayMs);
  }

  function scheduleInlineConversionFromSettingsUpdate() {
    if (settingsRefreshTimer) {
      window.clearTimeout(settingsRefreshTimer);
    }

    // Delay a bit after settings writes to avoid piggybacking a page gesture window.
    settingsRefreshTimer = window.setTimeout(() => {
      settingsRefreshTimer = null;
      scheduleInlineConversion();
    }, 1400);
  }

  return {
    initialize: async () => {
      const startedAt = perfLoggingEnabled ? performance.now() : 0;
      let hydrated = false;

      try {
        await refreshSettingsAndRates();
        hydrated = true;
      } catch (error) {
        console.warn("[ccx] Initial settings/rates hydration failed", error);
        // Keep selection popup functional even if rates are unavailable initially.
      } finally {
        if (perfLoggingEnabled) {
          logPerf("initialize", {
            hydrated,
            durationMs: roundMs(performance.now() - startedAt),
          });
        }
      }

      scheduleInlineConversion();
    },
    onSettingsStorageUpdate: async (newSettings, oldSettings) => {
      const startedAt = perfLoggingEnabled ? performance.now() : 0;
      let refreshed = false;
      let preferredCurrencyChanged = false;
      let missingRateSnapshot = false;
      const normalizedNewSettings = isUserSettingsSnapshot(newSettings)
        ? newSettings
        : null;
      const normalizedOldSettings = isUserSettingsSnapshot(oldSettings)
        ? oldSettings
        : null;

      if (normalizedNewSettings && normalizedOldSettings) {
        settings = normalizedNewSettings;
        preferredCurrencyChanged =
          normalizedNewSettings.preferredCurrency !== normalizedOldSettings.preferredCurrency;
      }

      if (normalizedNewSettings) {
        settings = normalizedNewSettings;
        const shouldScheduleInlineConversion =
          preferredCurrencyChanged || !normalizedOldSettings;
        preferredCurrencyChanged = shouldScheduleInlineConversion;

        if (rateSnapshot) {
          if (shouldScheduleInlineConversion) {
            scheduleInlineConversionFromSettingsUpdate();
          }

          logSettingsStorageUpdate(startedAt, {
            refreshed: false,
            missingRateSnapshot: false,
            preferredCurrencyChanged: shouldScheduleInlineConversion,
          });
          return;
        }
      }

      missingRateSnapshot = true;

      try {
        await refreshSettingsAndRates(false);
        refreshed = true;
        scheduleInlineConversionFromSettingsUpdate();
      } catch (error) {
        console.warn("[ccx] Failed to refresh settings/rates after storage update", error);
      } finally {
        logSettingsStorageUpdate(startedAt, {
          refreshed,
          missingRateSnapshot,
          preferredCurrencyChanged,
        });
      }
    },
    enqueueMutationRoots: (roots) => {
      if (!roots.length) return;

      for (const root of roots) {
        pendingMutationRoots.add(root);
      }

      schedulePartialInlineConversion();
    },
    recordSelectionConversion: () => {},
    shouldIgnoreMutations: () => {
      return isApplyingInlineConversion || suppressMutationDepth > 0;
    },
    cleanup: () => {
      conversionDebounceTimer = clearTimer(conversionDebounceTimer);
      partialConversionTimer = clearTimer(partialConversionTimer);
      hydrationRetryTimer = clearTimer(hydrationRetryTimer);
      settingsRefreshTimer = clearTimer(settingsRefreshTimer);
    },
  };
}
