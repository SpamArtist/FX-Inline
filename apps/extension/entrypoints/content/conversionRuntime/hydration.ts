import { getUserSettings } from "@/utils/appStorage";
import { getPrimaryTargetCurrency } from "@/utils/inlineRuntimeSettings";
import { getCachedRateSnapshot } from "@/utils/rates/cache";
import type { RateSnapshot } from "@/utils/rates.types";
import { isValidSnapshot } from "@/utils/rates/validation";
import type { PerfPayload } from "../perfLogger.types";

export type RefreshSettingsAndRatesParams = {
  forceRefresh?: boolean;
  perfLoggingEnabled: boolean;
  logPerf: (event: string, payload: PerfPayload) => void;
  roundMs: (value: number) => number;
  setSettings: (next: Awaited<ReturnType<typeof getUserSettings>>) => void;
  setRateSnapshot: (next: RateSnapshot) => void;
};

export async function refreshSettingsAndRates({
  forceRefresh = false,
  perfLoggingEnabled,
  logPerf,
  roundMs,
  setSettings,
  setRateSnapshot,
}: RefreshSettingsAndRatesParams) {
  const startedAt = perfLoggingEnabled ? performance.now() : 0;

  const settings = await getUserSettings();
  const rateSnapshot = await getCachedRateSnapshot();
  if (!isValidSnapshot(rateSnapshot)) {
    throw new Error("FX Inline missing cached rate snapshot for content runtime.");
  }

  setSettings(settings);
  setRateSnapshot(rateSnapshot);

  if (perfLoggingEnabled) {
    logPerf("refreshSettingsAndRates", {
      forceRefresh,
      preferredCurrency: getPrimaryTargetCurrency(settings.scopes.allUrls),
      rateSource: rateSnapshot.source ?? "unavailable",
      durationMs: roundMs(performance.now() - startedAt),
    });
  }
}

export type HydrateSettingsAndRatesParams = {
  forceRefresh?: boolean;
  getIsHydratingRates: () => boolean;
  setIsHydratingRates: (next: boolean) => void;
  refresh: (forceRefresh?: boolean) => Promise<void>;
};

export async function hydrateSettingsAndRates({
  forceRefresh = false,
  getIsHydratingRates,
  setIsHydratingRates,
  refresh,
}: HydrateSettingsAndRatesParams) {
  if (getIsHydratingRates() && !forceRefresh) return;
  setIsHydratingRates(true);

  try {
    await refresh(forceRefresh);
  } finally {
    setIsHydratingRates(false);
  }
}
