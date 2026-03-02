import { EntitlementPayload } from "@/packages/shared/contracts";
import { getValidAccessToken } from "@/utils/accountService";
import { getUserSettings, updateUserSettings } from "@/utils/appStorage";
import { recordUsageOnBackend } from "@/utils/backendClient";
import { CurrencyCode } from "@/utils/enums";
import { RateSnapshot, getRatesForUser } from "@/utils/rates";
import { convertVisiblePrices } from "./inlineConversion";

export type PendingUsageSnapshot = {
  inlineConversions: number;
  selectionConversions: number;
};

export type ContentConversionRuntime = {
  initialize: () => Promise<void>;
  onSettingsStorageUpdate: () => Promise<void>;
  enqueueMutationRoots: (roots: ParentNode[]) => void;
  recordSelectionConversion: () => void;
  shouldIgnoreMutations: () => boolean;
  getAccessTokenForUsage: () => string | null;
  getPendingUsageSnapshot: () => PendingUsageSnapshot;
  cleanup: () => void;
};

export function createContentConversionRuntime(): ContentConversionRuntime {
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
    settings = await getUserSettings();
    rateSnapshot = await getRatesForUser(settings, { forceRefresh });
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

    try {
      const token = await getValidAccessToken();
      if (!token) return;

      const usage = await recordUsageOnBackend(token, {
        inlineConversions,
        selectionConversions,
      });

      await applyUsageEntitlement(usage.entitlement);
    } catch {
      // Re-queue counts so they are not lost on transient network errors.
      pendingInlineUsage += inlineConversions;
      pendingSelectionUsage += selectionConversions;
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
        const conversions = convertVisiblePrices(preferredCurrency, rateSnapshot);

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

  function schedulePartialInlineConversion() {
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

        for (const root of roots) {
          if (!(root instanceof Node) || !root.isConnected) continue;

          conversions += convertVisiblePrices(preferredCurrency, rateSnapshot, root, {
            clearExisting: false,
            maxNodesPerPass: 4000,
          });
        }

        if (conversions > 0) {
          scheduleUsageFlush(conversions, 0);
        }
      } finally {
        isApplyingInlineConversion = false;
        window.setTimeout(() => {
          suppressMutationDepth = Math.max(0, suppressMutationDepth - 1);
        }, 400);
      }
    }, 120);
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
      try {
        await refreshSettingsAndRates();
      } catch (error) {
        console.warn("[ccx] Initial settings/rates hydration failed", error);
        // Keep selection popup functional even if rates are unavailable initially.
      }

      scheduleInlineConversion();
    },
    onSettingsStorageUpdate: async () => {
      try {
        await refreshSettingsAndRates(true);
        scheduleInlineConversionFromSettingsUpdate();
      } catch (error) {
        console.warn("[ccx] Failed to refresh settings/rates after storage update", error);
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
