import type { CurrencyCode } from "../utils/enums";
import type { RateSnapshot } from "../utils/rates.types";

export type CurrencyReducerHydrationResult = {
  preferredCurrency: CurrencyCode | null;
  rateSnapshot: RateSnapshot | null;
};

export type CurrencyReducerHydrationDeps = {
  readUserSettings?: () => Promise<{ preferredCurrency: CurrencyCode }>;
  readRates?: () => Promise<RateSnapshot>;
};

export async function loadCurrencyReducerHydration(
  deps: CurrencyReducerHydrationDeps = {},
): Promise<CurrencyReducerHydrationResult> {
  let readUserSettings = deps.readUserSettings;
  let readRates = deps.readRates;

  if (!readUserSettings || !readRates) {
    const [{ getUserSettings }, { getRates }] = await Promise.all([
      import("../utils/appStorage"),
      import("../utils/rates"),
    ]);
    readUserSettings = readUserSettings ?? getUserSettings;
    readRates = readRates ?? getRates;
  }

  try {
    const settings = await readUserSettings();
    const rateSnapshot = await readRates();

    return {
      preferredCurrency: settings.preferredCurrency,
      rateSnapshot,
    };
  } catch {
    return {
      preferredCurrency: null,
      rateSnapshot: null,
    };
  }
}
