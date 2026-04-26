import type { UserSettings } from "@/utils/appStorage.types";
import type { RateSnapshot } from "@/utils/rates.types";
import {
  getOriginFromUrl,
  isAutoConversionEnabledForOrigin,
} from "@/utils/appStorage";
import type { ContentConversionRuntime } from "./content.types";
import {
  HYDRATION_RETRY_MS,
  SETTINGS_UPDATE_CONVERSION_DELAY_MS,
} from "./conversionRuntime/constants";
import { isUserSettingsSnapshot } from "./conversionRuntime/guards";
import {
  hydrateSettingsAndRates,
  refreshSettingsAndRates,
} from "./conversionRuntime/hydration";
import { createRuntimePerfContext } from "./conversionRuntime/logging";
import { clearTimer } from "./conversionRuntime/timers";
import { createInlineRuntime } from "@fx-inline/inline-runtime";

export type { ContentConversionRuntime } from "./content.types";

function isExtensionContextInvalidatedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /extension context invalidated/i.test(error.message)
  );
}

export function createContentConversionRuntime(): ContentConversionRuntime {
  const {
    perfLoggingEnabled,
    logPerf,
    roundMs,
    logSettingsStorageUpdate,
  } = createRuntimePerfContext("fx-inline");
  const currentPageOrigin = getOriginFromUrl(window.location.href);

  let settings: UserSettings | null = null;
  let rateSnapshot: RateSnapshot | null = null;

  let hydrationRetryTimer: number | null = null;
  let settingsRefreshTimer: number | null = null;
  let isHydratingRates = false;
  let isCleanedUp = false;

  const inlineRuntime = createInlineRuntime({
    root: document.body,
    observeMutations: false,
    enabled: false,
    autoFetchRates: false,
    onPerfSample: perfLoggingEnabled
      ? (sample) => {
        logPerf("inlineConversion.full", {
          totalMs: roundMs(sample.totalMs),
          clearExistingMs: roundMs(sample.clearExistingMs),
          scanTextNodesMs: roundMs(sample.scanTextNodesMs),
          decorateNodesMs: roundMs(sample.decorateNodesMs),
          scannedTextNodes: sample.scannedTextNodes,
          conversions: sample.conversionsApplied,
          reachedNodeLimit: sample.reachedNodeLimit,
        });
      }
      : undefined,
    onError: (error) => {
      if (isExtensionContextInvalidatedError(error)) return;
      console.warn("[fx-inline] Inline runtime error", error);
    },
  });

  function setSettings(next: UserSettings) {
    settings = next;
  }

  function setRateSnapshot(next: RateSnapshot) {
    rateSnapshot = next;
  }

  function isAutoConversionEnabledForCurrentPage(next: UserSettings | null): boolean {
    if (!next) return false;
    return isAutoConversionEnabledForOrigin(next, currentPageOrigin);
  }

  function getIsHydratingRates() {
    return isHydratingRates;
  }

  function setIsHydratingRates(next: boolean) {
    isHydratingRates = next;
  }

  function applyInlineRuntimeState() {
    if (!settings) {
      inlineRuntime.setEnabled(false);
      return;
    }

    inlineRuntime.setPreferredCurrency(settings.preferredCurrency);
    inlineRuntime.setEnabled(isAutoConversionEnabledForCurrentPage(settings));

    if (rateSnapshot) {
      inlineRuntime.setRateSnapshot(rateSnapshot);
    }
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

  function scheduleHydrationRetry() {
    if (isCleanedUp) return;
    if (hydrationRetryTimer !== null) return;

    hydrationRetryTimer = window.setTimeout(() => {
      hydrationRetryTimer = null;
      if (isCleanedUp) return;
      void initialize().catch((error) => {
        if (isExtensionContextInvalidatedError(error)) return;
        console.warn("[fx-inline] Failed to retry inline runtime hydration", error);
      });
    }, HYDRATION_RETRY_MS);
  }

  function scheduleSettingsRefresh() {
    if (isCleanedUp) return;

    if (settingsRefreshTimer !== null) {
      window.clearTimeout(settingsRefreshTimer);
    }

    settingsRefreshTimer = window.setTimeout(() => {
      settingsRefreshTimer = null;
      if (isCleanedUp) return;

      void refreshRuntimeSettingsAndRates(false)
        .then(() => {
          if (isCleanedUp) return;
          applyInlineRuntimeState();
        })
        .catch((error) => {
          if (!isExtensionContextInvalidatedError(error)) {
            console.warn("[fx-inline] Failed to refresh settings/rates after settings update", error);
          }
          scheduleHydrationRetry();
        });
    }, SETTINGS_UPDATE_CONVERSION_DELAY_MS);
  }

  async function initialize() {
    if (isCleanedUp) return;

    try {
      await hydrateRuntimeSettingsAndRates();
    } catch (error) {
      if (!isExtensionContextInvalidatedError(error)) {
        console.warn("[fx-inline] Failed to hydrate settings/rates for inline runtime", error);
      }
      scheduleHydrationRetry();
      return;
    }

    if (isCleanedUp) return;

    applyInlineRuntimeState();
    inlineRuntime.start();
  }

  async function onSettingsStorageUpdate(
    newSettings?: UserSettings | null,
    oldSettings?: UserSettings | null,
  ) {
    if (isCleanedUp) return;
    const startedAt = performance.now();

    const didPreferredCurrencyChange =
      newSettings?.preferredCurrency !== oldSettings?.preferredCurrency;
    const didGlobalAutoConversionChange =
      newSettings?.globalAutoConversionEnabled !== oldSettings?.globalAutoConversionEnabled;

    const oldLocalAutoConversion =
      oldSettings?.localAutoConversionByOrigin?.[currentPageOrigin ?? ""];
    const newLocalAutoConversion =
      newSettings?.localAutoConversionByOrigin?.[currentPageOrigin ?? ""];
    const didLocalAutoConversionChange =
      oldLocalAutoConversion !== newLocalAutoConversion;

    if (
      didPreferredCurrencyChange ||
      didGlobalAutoConversionChange ||
      didLocalAutoConversionChange
    ) {
      logSettingsStorageUpdate(startedAt, {
        refreshed: true,
        missingRateSnapshot: rateSnapshot === null,
        preferredCurrencyChanged: didPreferredCurrencyChange,
      });
      scheduleSettingsRefresh();
      return;
    }

    if (isUserSettingsSnapshot(newSettings)) {
      settings = {
        ...settings,
        ...newSettings,
      } as UserSettings;
      applyInlineRuntimeState();
    }

    logSettingsStorageUpdate(startedAt, {
      refreshed: false,
      missingRateSnapshot: rateSnapshot === null,
      preferredCurrencyChanged: didPreferredCurrencyChange,
    });
  }

  function enqueueMutationRoots(roots: ParentNode[]) {
    inlineRuntime.enqueueMutationRoots(roots);
  }

  function recordSelectionConversion() {
    if (isCleanedUp) return;
    inlineRuntime.refresh();
  }

  function shouldIgnoreMutations() {
    return inlineRuntime.shouldIgnoreMutations();
  }

  function cleanup() {
    if (isCleanedUp) return;
    isCleanedUp = true;

    hydrationRetryTimer = clearTimer(hydrationRetryTimer);
    settingsRefreshTimer = clearTimer(settingsRefreshTimer);

    inlineRuntime.destroy();
  }

  return {
    initialize,
    onSettingsStorageUpdate,
    enqueueMutationRoots,
    recordSelectionConversion,
    shouldIgnoreMutations,
    cleanup,
  };
}
