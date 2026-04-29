import type { CurrencyCode } from "../utils/enums";
import type { UserSettings } from "../utils/appStorage.types";
import { getPrimaryTargetCurrency } from "../utils/inlineRuntimeSettings";
import type { RateSnapshot } from "../utils/rates.types";

export type CurrencyReducerHydrationResult = {
  preferredCurrency: CurrencyCode | null;
  rateSnapshot: RateSnapshot | null;
};

export type CurrencyReducerHydrationDeps = {
  readUserSettings?: () => Promise<UserSettings>;
  readRates?: () => Promise<RateSnapshot | null>;
};

export async function loadCurrencyReducerHydration(
  deps: CurrencyReducerHydrationDeps = {},
): Promise<CurrencyReducerHydrationResult> {
  let readUserSettings = deps.readUserSettings;
  let readRates = deps.readRates;

  if (!readUserSettings || !readRates) {
    const [{ getUserSettings }, { getCachedRateSnapshot }] = await Promise.all([
      import("../utils/appStorage"),
      import("../utils/rates/cache"),
    ]);
    readUserSettings = readUserSettings ?? getUserSettings;
    readRates = readRates ?? getCachedRateSnapshot;
  }

  try {
    const settings = await readUserSettings();
    const rateSnapshot = await readRates();

    return {
      preferredCurrency: getPrimaryTargetCurrency(settings.scopes.allUrls),
      rateSnapshot,
    };
  } catch {
    return {
      preferredCurrency: null,
      rateSnapshot: null,
    };
  }
}
