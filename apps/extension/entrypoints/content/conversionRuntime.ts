import { EntitlementPayload } from "@/packages/shared/contracts";
import { getValidAccessToken } from "@/utils/accountService";
import type { UserSettings } from "@/utils/appStorage";
import { getUserSettings, updateUserSettings } from "@/utils/appStorage";
import { recordUsageOnBackend } from "@/utils/backendClient";
import { CurrencyCode } from "@/utils/enums";
import { RateSnapshot, getRatesForUser } from "@/utils/rates";
import { convertVisiblePrices } from "./inlineConversion";
import {
  addInlinePerfSample,
  createInlineConversionPerfAggregate,
  createPerfLogger,
} from "./perfLogger";

export type PendingUsageSnapshot = {
  inlineConversions: number;
  selectionConversions: number;
};

const PARTIAL_CONVERSION_DEBOUNCE_MS = 120;
const PARTIAL_CONVERSION_CONTINUE_MS = 28;
const PARTIAL_CONVERSION_TIME_BUDGET_MS = 16;

function isUserSettingsSnapshot(value: unknown): value is UserSettings {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<UserSettings>;
  if (typeof candidate.preferredCurrency !== "string") return false;
  if (!candidate.auth || typeof candidate.auth !== "object") return false;
  if (!candidate.entitlement || typeof candidate.entitlement !== "object") return false;

  return true;
}

function areAuthSessionsEqual(a: UserSettings["auth"], b: UserSettings["auth"]): boolean {
  return (
    a.email === b.email &&
    a.accessToken === b.accessToken &&
    a.refreshToken === b.refreshToken &&
    a.accessTokenExpiresAt === b.accessTokenExpiresAt &&
    a.refreshTokenExpiresAt === b.refreshTokenExpiresAt
  );
}

function hasPaidAccessFromEntitlement(entitlement: UserSettings["entitlement"]): boolean {
  return entitlement.status === "paid" || entitlement.status === "trial";
}

export type ContentConversionRuntime = {
  initialize: () => Promise<void>;
  onSettingsStorageUpdate: (
    newSettings?: UserSettings | null,
    oldSettings?: UserSettings | null,
  ) => Promise<void>;
  enqueueMutationRoots: (roots: ParentNode[]) => void;
  recordSelectionConversion: () => void;
  shouldIgnoreMutations: () => boolean;
  getAccessTokenForUsage: () => string | null;
  getPendingUsageSnapshot: () => PendingUsageSnapshot;
  cleanup: () => void;
};

export function createContentConversionRuntime(): ContentConversionRuntime {
  const perfLogger = createPerfLogger("ccx");
  const perfLoggingEnabled = perfLogger.enabled;
  const logPerf = perfLogger.log;
  const roundMs = perfLogger.roundMs;

  let settings: Awaited<ReturnType<typeof getUserSettings>> | null = null;
  let rateSnapshot: RateSnapshot | null = null;

  let conversionDebounceTimer: number | null = null;
  let partialConversionTimer: number | null = null;
  let usageFlushTimer: number | null = null;
  let hydrationRetryTimer: number | null = null;
  let settingsRefreshTimer: number | null = null;
  let isApplyingInlineConversion = false;
  let suppressMutationDepth = 0;
  let isHydratingRates = false;

  let pendingInlineUsage = 0;
  let pendingSelectionUsage = 0;
  const pendingMutationRoots = new Set<ParentNode>();

  async function refreshSettingsAndRates(forceRefresh = false) {
    const startedAt = perfLoggingEnabled ? performance.now() : 0;

    settings = await getUserSettings();
    rateSnapshot = await getRatesForUser(settings, { forceRefresh });

    if (perfLoggingEnabled) {
      logPerf("refreshSettingsAndRates", {
        forceRefresh,
        preferredCurrency: settings.preferredCurrency,
        rateSource: rateSnapshot.source ?? "unknown",
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

  async function applyUsageEntitlement(entitlement: EntitlementPayload) {
    const updated = await updateUserSettings(
      {
        entitlement: {
          status: entitlement.status,
          planTier: entitlement.planTier,
          checkedAt: entitlement.checkedAt,
          trialEndsAt: entitlement.trialEndsAt,
          currentPeriodEnd: entitlement.currentPeriodEnd,
          dailyLimit: entitlement.dailyLimit,
          remainingToday: entitlement.remainingToday,
        },
      },
    );

    settings = updated;
  }

  async function flushUsage(inlineConversions: number, selectionConversions: number) {
    if (inlineConversions + selectionConversions <= 0) return;

    const startedAt = perfLoggingEnabled ? performance.now() : 0;
    let success = false;

    try {
      const token = await getValidAccessToken();
      if (!token) return;

      const usage = await recordUsageOnBackend(token, {
        inlineConversions,
        selectionConversions,
      });

      await applyUsageEntitlement(usage.entitlement);
      success = true;
    } catch {
      // Re-queue counts so they are not lost on transient network errors.
      pendingInlineUsage += inlineConversions;
      pendingSelectionUsage += selectionConversions;
    } finally {
      if (perfLoggingEnabled) {
        logPerf("flushUsage", {
          inlineConversions,
          selectionConversions,
          success,
          durationMs: roundMs(performance.now() - startedAt),
        });
      }
    }
  }

  function scheduleUsageFlush(inlineDelta = 0, selectionDelta = 0) {
    pendingInlineUsage += Math.max(0, Math.floor(inlineDelta));
    pendingSelectionUsage += Math.max(0, Math.floor(selectionDelta));

    if (usageFlushTimer) {
      window.clearTimeout(usageFlushTimer);
    }

    usageFlushTimer = window.setTimeout(async () => {
      const inlineConversions = pendingInlineUsage;
      const selectionConversions = pendingSelectionUsage;

      pendingInlineUsage = 0;
      pendingSelectionUsage = 0;

      await flushUsage(inlineConversions, selectionConversions);
    }, 1200);
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
        const preferredCurrency = settings.preferredCurrency as CurrencyCode;
        const conversions = convertVisiblePrices(
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

        if (conversions > 0) {
          scheduleUsageFlush(conversions, 0);
        }
      } finally {
        isApplyingInlineConversion = false;
        window.setTimeout(() => {
          suppressMutationDepth = Math.max(0, suppressMutationDepth - 1);
        }, 400);
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
        const preferredCurrency = settings.preferredCurrency as CurrencyCode;
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

        if (conversions > 0) {
          scheduleUsageFlush(conversions, 0);
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
        isApplyingInlineConversion = false;
        window.setTimeout(() => {
          suppressMutationDepth = Math.max(0, suppressMutationDepth - 1);
        }, 400);
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
      let skippedRateRefresh = false;
      let preferredCurrencyChanged = false;
      let rateRelevantChanged = true;

      if (
        isUserSettingsSnapshot(newSettings) &&
        isUserSettingsSnapshot(oldSettings)
      ) {
        settings = newSettings;

        preferredCurrencyChanged =
          newSettings.preferredCurrency !== oldSettings.preferredCurrency;
        const authChanged = !areAuthSessionsEqual(newSettings.auth, oldSettings.auth);
        const paidAccessChanged =
          hasPaidAccessFromEntitlement(newSettings.entitlement) !==
          hasPaidAccessFromEntitlement(oldSettings.entitlement);

        rateRelevantChanged = authChanged || paidAccessChanged;

        if (!rateRelevantChanged) {
          skippedRateRefresh = true;

          if (preferredCurrencyChanged) {
            scheduleInlineConversionFromSettingsUpdate();
          }

          if (perfLoggingEnabled) {
            logPerf("onSettingsStorageUpdate", {
              refreshed: false,
              skippedRateRefresh: true,
              preferredCurrencyChanged,
              rateRelevantChanged: false,
              durationMs: roundMs(performance.now() - startedAt),
            });
          }

          return;
        }
      } else if (isUserSettingsSnapshot(newSettings)) {
        settings = newSettings;
      }

      try {
        await refreshSettingsAndRates(false);
        refreshed = true;
        scheduleInlineConversionFromSettingsUpdate();
      } catch (error) {
        console.warn("[ccx] Failed to refresh settings/rates after storage update", error);
      } finally {
        if (perfLoggingEnabled) {
          logPerf("onSettingsStorageUpdate", {
            refreshed,
            skippedRateRefresh,
            preferredCurrencyChanged,
            rateRelevantChanged,
            durationMs: roundMs(performance.now() - startedAt),
          });
        }
      }
    },
    enqueueMutationRoots: (roots) => {
      if (!roots.length) return;

      for (const root of roots) {
        pendingMutationRoots.add(root);
      }

      schedulePartialInlineConversion();
    },
    recordSelectionConversion: () => {
      scheduleUsageFlush(0, 1);
    },
    shouldIgnoreMutations: () => {
      return isApplyingInlineConversion || suppressMutationDepth > 0;
    },
    getAccessTokenForUsage: () => settings?.auth.accessToken ?? null,
    getPendingUsageSnapshot: () => ({
      inlineConversions: pendingInlineUsage,
      selectionConversions: pendingSelectionUsage,
    }),
    cleanup: () => {
      if (usageFlushTimer) {
        window.clearTimeout(usageFlushTimer);
      }

      if (partialConversionTimer) {
        window.clearTimeout(partialConversionTimer);
      }

      if (hydrationRetryTimer) {
        window.clearTimeout(hydrationRetryTimer);
      }

      if (settingsRefreshTimer) {
        window.clearTimeout(settingsRefreshTimer);
      }
    },
  };
}
