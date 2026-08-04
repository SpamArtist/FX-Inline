import { getUserSettings } from "@/utils/appStorage";
import { getCachedRateSnapshot } from "@/utils/rates/cache";
import type { RateSnapshot } from "@/utils/rates.types";
import { isValidSnapshot } from "@/utils/rates/validation";

export type RefreshSettingsAndRatesParams = {
  setSettings: (next: Awaited<ReturnType<typeof getUserSettings>>) => void;
  setRateSnapshot: (next: RateSnapshot) => void;
};

export async function refreshSettingsAndRates({
  setSettings,
  setRateSnapshot,
}: RefreshSettingsAndRatesParams) {
  const settings = await getUserSettings();
  const rateSnapshot = await getCachedRateSnapshot();
  if (!isValidSnapshot(rateSnapshot)) {
    throw new Error("FX Inline missing cached rate snapshot for content runtime.");
  }

  setSettings(settings);
  setRateSnapshot(rateSnapshot);
}

export type HydrateSettingsAndRatesParams = {
  forceRefresh?: boolean;
  getIsHydratingRates: () => boolean;
  setIsHydratingRates: (next: boolean) => void;
  refresh: () => Promise<void>;
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
    await refresh();
  } finally {
    setIsHydratingRates(false);
  }
}
