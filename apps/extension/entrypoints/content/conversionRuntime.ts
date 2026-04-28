import type { UserSettings } from "@/utils/appStorage.types";
import type { RateSnapshot } from "@/utils/rates.types";
import { getUserSettings } from "@/utils/appStorage";
import {
  getPrimaryTargetCurrency,
  resolveInlineRuntimeSettingsForUrl,
} from "@/utils/inlineRuntimeSettings";
import type { ResolvedInlineRuntimeSettings } from "@/utils/inlineRuntimeSettings.types";
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
import {
  getContentRuntimeSitePluginOptions,
  mergeContentRuntimeClientRenderPreferences,
} from "./sitePlugins";
import { createInlineRuntime } from "@fx-inline/inline-runtime/extension";

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
  let settings: UserSettings | null = null;
  let resolvedSettings: ResolvedInlineRuntimeSettings | null = null;
  let rateSnapshot: RateSnapshot | null = null;

  let hydrationRetryTimer: number | null = null;
  let settingsRefreshTimer: number | null = null;
  let isHydratingRates = false;
  let isCleanedUp = false;
  const loggedUnsupportedSettingKeys = new Set<string>();
  const sitePluginOptions = getContentRuntimeSitePluginOptions(
    window.location.href,
  );

  const inlineRuntime = createInlineRuntime({
    root: document.body,
    observeMutations: false,
    enabled: false,
    autoFetchRates: false,
    ...sitePluginOptions,
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
    resolvedSettings = resolveInlineRuntimeSettingsForUrl(next, window.location.href);
  }

  function setRateSnapshot(next: RateSnapshot) {
    rateSnapshot = next;
  }

  function getIsHydratingRates() {
    return isHydratingRates;
  }

  function setIsHydratingRates(next: boolean) {
    isHydratingRates = next;
  }

  function applyInlineRuntimeState() {
    if (!settings || !resolvedSettings) {
      inlineRuntime.setEnabled(false);
      return;
    }

    logUnsupportedRuntimeSettings(resolvedSettings);

    const pageSettings = resolvedSettings.settings;
    inlineRuntime.setPreferredCurrency(getPrimaryTargetCurrency(pageSettings));
    inlineRuntime.setClientRenderPreferences(
      mergeContentRuntimeClientRenderPreferences(
        {
          default: {
            convertedCurrencyPosition: pageSettings.convertedCurrencyPosition,
            displayStyle: pageSettings.displayStyle,
            highlightColor: pageSettings.highlightColor,
          },
        },
        sitePluginOptions.clientRenderPreferences,
      ) ?? null,
    );
    inlineRuntime.setEnabled(pageSettings.enabled);

    if (rateSnapshot) {
      inlineRuntime.setRateSnapshot(rateSnapshot);
    }
  }

  function logUnsupportedRuntimeSettings(next: ResolvedInlineRuntimeSettings) {
    for (const settingKey of next.unsupportedSettingKeys) {
      if (loggedUnsupportedSettingKeys.has(settingKey)) continue;
      loggedUnsupportedSettingKeys.add(settingKey);
      console.error(
        `[fx-inline] Inline runtime setting "${settingKey}" is not implemented; skipping it for ${next.scopeType}:${next.scopeId}.`,
      );
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

    const nextSettings = isUserSettingsSnapshot(newSettings)
      ? newSettings
      : await getUserSettings();
    const previousResolved = oldSettings
      ? resolveInlineRuntimeSettingsForUrl(oldSettings, window.location.href)
      : null;
    const nextResolved = resolveInlineRuntimeSettingsForUrl(
      nextSettings,
      window.location.href,
    );
    const didResolvedSettingsChange =
      JSON.stringify(previousResolved?.settings ?? null) !==
      JSON.stringify(nextResolved.settings);

    if (didResolvedSettingsChange) {
      logSettingsStorageUpdate(startedAt, {
        refreshed: true,
        missingRateSnapshot: rateSnapshot === null,
        preferredCurrencyChanged:
          getPrimaryTargetCurrency(previousResolved?.settings ?? nextResolved.settings) !==
          getPrimaryTargetCurrency(nextResolved.settings),
      });
      settings = nextSettings;
      resolvedSettings = nextResolved;
      scheduleSettingsRefresh();
      return;
    }

    settings = nextSettings;
    resolvedSettings = nextResolved;
    applyInlineRuntimeState();

    logSettingsStorageUpdate(startedAt, {
      refreshed: false,
      missingRateSnapshot: rateSnapshot === null,
      preferredCurrencyChanged: false,
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
