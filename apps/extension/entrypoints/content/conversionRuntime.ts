import type { UserSettings } from "@/utils/appStorage.types";
import type { RateSnapshot } from "@/utils/rates.types";
import type { ContentConversionRuntime } from "./content.types";
import {
  FULL_CONVERSION_DEBOUNCE_MS,
  HYDRATION_RETRY_MS,
  MUTATION_SUPPRESSION_RELEASE_MS,
  PARTIAL_CONVERSION_CONTINUE_MS,
  PARTIAL_CONVERSION_DEBOUNCE_MS,
  PARTIAL_CONVERSION_TIME_BUDGET_MS,
  SETTINGS_UPDATE_CONVERSION_DELAY_MS,
} from "./conversionRuntime/constants";
import { isUserSettingsSnapshot } from "./conversionRuntime/guards";
import {
  hydrateSettingsAndRates,
  refreshSettingsAndRates,
} from "./conversionRuntime/hydration";
import { createRuntimePerfContext } from "./conversionRuntime/logging";
import { runPartialConversionPass } from "./conversionRuntime/partialPass";
import { clearTimer } from "./conversionRuntime/timers";
import { clearInlineConversions } from "./inlineConversion/conversionNodes";
import { convertVisiblePrices } from "./inlineConversion";

export type { ContentConversionRuntime } from "./content.types";

export function createContentConversionRuntime(): ContentConversionRuntime {
  const {
    perfLoggingEnabled,
    logPerf,
    roundMs,
    logSettingsStorageUpdate,
  } = createRuntimePerfContext("ccx");

  let settings: UserSettings | null = null;
  let rateSnapshot: RateSnapshot | null = null;

  let conversionDebounceTimer: number | null = null;
  let partialConversionTimer: number | null = null;
  let hydrationRetryTimer: number | null = null;
  let settingsRefreshTimer: number | null = null;
  let isApplyingInlineConversion = false;
  let suppressMutationDepth = 0;
  let isHydratingRates = false;

  const pendingMutationRoots = new Set<ParentNode>();

  function setSettings(next: UserSettings) {
    settings = next;
  }

  function setRateSnapshot(next: RateSnapshot) {
    rateSnapshot = next;
  }

  function isGlobalAutoConversionEnabled(next: UserSettings | null): boolean {
    return next?.globalAutoConversionEnabled !== false;
  }

  function isAutoConversionEnabledForCurrentPage(next: UserSettings | null): boolean {
    return isGlobalAutoConversionEnabled(next);
  }

  function getIsHydratingRates() {
    return isHydratingRates;
  }

  function setIsHydratingRates(next: boolean) {
    isHydratingRates = next;
  }

  async function refreshRuntimeSettingsAndRates(forceRefresh = false) {
    await refreshSettingsAndRates({
      forceRefresh,
      perfLoggingEnabled,
      logPerf,
      roundMs,
      setSettings,
      setRateSnapshot,
    });
  }

  async function hydrateRuntimeSettingsAndRates(forceRefresh = false) {
    await hydrateSettingsAndRates({
      forceRefresh,
      getIsHydratingRates,
      setIsHydratingRates,
      refresh: refreshRuntimeSettingsAndRates,
    });
  }

  function releaseMutationSuppression() {
    isApplyingInlineConversion = false;
    window.setTimeout(() => {
      suppressMutationDepth = Math.max(0, suppressMutationDepth - 1);
    }, MUTATION_SUPPRESSION_RELEASE_MS);
  }

  function scheduleHydrationRetry() {
    if (hydrationRetryTimer !== null) return;

    hydrationRetryTimer = window.setTimeout(() => {
      hydrationRetryTimer = null;
      scheduleInlineConversion();
    }, HYDRATION_RETRY_MS);
  }

  function scheduleInlineConversion() {
    if (conversionDebounceTimer !== null) {
      window.clearTimeout(conversionDebounceTimer);
    }

    conversionDebounceTimer = window.setTimeout(() => {
      conversionDebounceTimer = null;

      if (!settings) {
        void hydrateRuntimeSettingsAndRates()
          .then(() => {
            if (settings) {
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

      if (!isAutoConversionEnabledForCurrentPage(settings)) {
        pendingMutationRoots.clear();
        clearInlineConversions(document.body);
        return;
      }

      if (!rateSnapshot) {
        void hydrateRuntimeSettingsAndRates()
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
    }, FULL_CONVERSION_DEBOUNCE_MS);
  }

  function schedulePartialInlineConversion(delayMs = PARTIAL_CONVERSION_DEBOUNCE_MS) {
    if (partialConversionTimer !== null) {
      window.clearTimeout(partialConversionTimer);
    }

    partialConversionTimer = window.setTimeout(() => {
      partialConversionTimer = null;

      if (!pendingMutationRoots.size) return;

      if (!settings) {
        pendingMutationRoots.clear();
        scheduleInlineConversion();
        return;
      }

      if (!isAutoConversionEnabledForCurrentPage(settings)) {
        pendingMutationRoots.clear();
        return;
      }

      if (!rateSnapshot) {
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

        const {
          conversions,
          connectedRoots,
          deferredRoots,
          perfAggregate,
        } = runPartialConversionPass(
          roots,
          pendingMutationRoots,
          preferredCurrency,
          rateSnapshot,
          perfLoggingEnabled,
          PARTIAL_CONVERSION_TIME_BUDGET_MS,
        );

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
    if (settingsRefreshTimer !== null) {
      window.clearTimeout(settingsRefreshTimer);
    }

    // Delay a bit after settings writes to avoid piggybacking a page gesture window.
    settingsRefreshTimer = window.setTimeout(() => {
      settingsRefreshTimer = null;
      scheduleInlineConversion();
    }, SETTINGS_UPDATE_CONVERSION_DELAY_MS);
  }

  return {
    initialize: async () => {
      const startedAt = perfLoggingEnabled ? performance.now() : 0;
      let hydrated = false;

      try {
        await refreshRuntimeSettingsAndRates();
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
        const globalAutoConversionChanged =
          Boolean(normalizedOldSettings) &&
          isGlobalAutoConversionEnabled(normalizedNewSettings) !==
            isGlobalAutoConversionEnabled(normalizedOldSettings);
        const shouldScheduleInlineConversion =
          preferredCurrencyChanged ||
          globalAutoConversionChanged ||
          !normalizedOldSettings;
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
        await refreshRuntimeSettingsAndRates(false);
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
      pendingMutationRoots.clear();
    },
  };
}
