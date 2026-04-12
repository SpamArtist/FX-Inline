import currencies from "@/assets/currency.json";
import { CURRENCY_CODE_MAP } from "@/utils/constants";
import type { CurrencyCode } from "@/utils/enums";
import type { RateSnapshot } from "@/utils/rates.types";
import type { CurrencyState } from "@/utils/types";
import {
  applyPreferredCurrencyPreference,
  createInitialCurrenciesState,
  recalculateFromIndex,
} from "./useCurrencyReducer.state";
import type { CurrencyReducerHydrationResult } from "./useCurrencyReducer.hydration";

type CurrencyListEntry = {
  code: CurrencyCode;
  logo: string;
};

const CURRENCY_LIST_BY_CODE = new Map<CurrencyCode, CurrencyListEntry>(
  (currencies as CurrencyListEntry[]).map((currency) => [currency.code, currency]),
);

export function createCurrencyIdFactory() {
  let currencyIdCounter = 0;

  return function createCurrencyId() {
    currencyIdCounter += 1;
    return `currency-${currencyIdCounter}`;
  };
}

export function getCurrencyStateFromCode(code: CurrencyCode) {
  const currencyFromMap = CURRENCY_CODE_MAP[code];
  if (currencyFromMap) return currencyFromMap;

  return { code, icon: CURRENCY_LIST_BY_CODE.get(code)?.logo || "" };
}

export function createBootstrapCurrenciesState(params: {
  amount: string;
  sourceCurrency: CurrencyCode;
  preferredCurrency: CurrencyCode;
  createCurrencyId: () => string;
}): CurrencyState[] {
  return createInitialCurrenciesState({
    ...params,
    getCurrencyStateFromCode,
  });
}

export function applyHydratedBootstrapState(params: {
  currenciesState: CurrencyState[];
  preferredCurrency: CurrencyCode;
  rateSnapshot: RateSnapshot | null;
  hydratedState: CurrencyReducerHydrationResult;
}): {
  currenciesState: CurrencyState[];
  preferredCurrency: CurrencyCode;
  rateSnapshot: RateSnapshot | null;
  changed: boolean;
} {
  const { hydratedState } = params;
  const hasHydratedPreferredCurrency = Boolean(hydratedState.preferredCurrency);
  const hasHydratedRateSnapshot = hydratedState.rateSnapshot !== null;
  let nextPreferredCurrency = params.preferredCurrency;
  let nextRateSnapshot = params.rateSnapshot;
  let nextCurrenciesState = params.currenciesState;

  if (hasHydratedPreferredCurrency && hydratedState.preferredCurrency) {
    nextPreferredCurrency = hydratedState.preferredCurrency;
  }

  if (hasHydratedRateSnapshot) {
    nextRateSnapshot = hydratedState.rateSnapshot;
    nextCurrenciesState = recalculateFromIndex(nextCurrenciesState, 0, nextRateSnapshot);
  }

  if (hasHydratedPreferredCurrency || hasHydratedRateSnapshot) {
    nextCurrenciesState = applyPreferredCurrencyPreference(
      nextCurrenciesState,
      nextPreferredCurrency,
      nextRateSnapshot,
      getCurrencyStateFromCode,
    );
  }

  return {
    currenciesState: nextCurrenciesState,
    preferredCurrency: nextPreferredCurrency,
    rateSnapshot: nextRateSnapshot,
    changed: hasHydratedPreferredCurrency || hasHydratedRateSnapshot,
  };
}

