import currencies from "@/assets/currency.json";
import { CURRENCY_CODE_MAP, DEFAULT_STARTING_CURRENCY } from "@/utils/constants";
import { ActionType, CurrencyCode } from "@/utils/enums";
import type { RateSnapshot } from "@/utils/rates.types";
import type { CurrencyState, DispatchAction } from "@/utils/types";
import type { CurrencyReducerHydrationDeps } from "@/hooks/useCurrencyReducer.hydration";
import { loadCurrencyReducerHydration } from "@/hooks/useCurrencyReducer.hydration";
import {
  DEFAULT_SECONDARY_CURRENCY,
  applyPreferredCurrencyPreference,
  createCurrencyIdFactory,
  createInitialCurrenciesState,
  recalculateFromIndex,
  reduceCurrencyState,
} from "@/hooks/useCurrencyReducer.state";

type CurrencyListEntry = {
  code: CurrencyCode;
  logo: string;
};

const CURRENCY_LIST_BY_CODE = new Map<CurrencyCode, CurrencyListEntry>(
  (currencies as CurrencyListEntry[]).map((currency) => [currency.code, currency]),
);

function getCurrencyStateFromCode(code: CurrencyCode) {
  const currencyFromMap = CURRENCY_CODE_MAP[code];
  if (currencyFromMap) return currencyFromMap;

  return { code, icon: CURRENCY_LIST_BY_CODE.get(code)?.logo || "" };
}

function createAmountUpdateAction(
  id: string,
  amount: string,
): DispatchAction {
  return {
    type: ActionType.AMOUNT_UPDATE,
    payload: {
      id,
      amount,
    },
  };
}

export type SelectionPopupStateSnapshot = {
  currencies: CurrencyState[];
  preferredCurrency: CurrencyCode;
  rateSnapshot: RateSnapshot | null;
};

export type SelectionPopupStateListener = (
  snapshot: SelectionPopupStateSnapshot,
) => void;

export type SelectionPopupStateStore = {
  getSnapshot: () => SelectionPopupStateSnapshot;
  subscribe: (listener: SelectionPopupStateListener) => () => void;
  dispatch: (action: DispatchAction) => void;
  updateAmount: (id: string, amount: string) => void;
  destroy: () => void;
};

export type CreateSelectionPopupStateStoreParams = {
  amount: string;
  sourceCurrency: CurrencyCode;
  hydrationDeps?: CurrencyReducerHydrationDeps;
};

export function createSelectionPopupStateStore({
  amount,
  sourceCurrency,
  hydrationDeps,
}: CreateSelectionPopupStateStoreParams): SelectionPopupStateStore {
  let preferredCurrency = DEFAULT_STARTING_CURRENCY;
  let rateSnapshot: RateSnapshot | null = null;
  const createCurrencyId = createCurrencyIdFactory();

  let currenciesState = createInitialCurrenciesState({
    amount,
    sourceCurrency,
    preferredCurrency: DEFAULT_SECONDARY_CURRENCY,
    createCurrencyId,
    getCurrencyStateFromCode,
  });

  const listeners = new Set<SelectionPopupStateListener>();
  let destroyed = false;

  function getSnapshot(): SelectionPopupStateSnapshot {
    return {
      currencies: currenciesState,
      preferredCurrency,
      rateSnapshot,
    };
  }

  function notify() {
    if (destroyed) return;

    const snapshot = getSnapshot();
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function dispatch(action: DispatchAction) {
    if (destroyed) return;

    const nextState = reduceCurrencyState(currenciesState, action, {
      preferredCurrency,
      rateSnapshot,
      createCurrencyId,
      getCurrencyStateFromCode,
    });

    if (nextState === currenciesState) return;
    currenciesState = nextState;
    notify();
  }

  const hydrate = async () => {
    const hydratedState = await loadCurrencyReducerHydration(hydrationDeps);
    if (destroyed) return;

    const preferredCurrencyChanged =
      Boolean(hydratedState.preferredCurrency) &&
      hydratedState.preferredCurrency !== preferredCurrency;
    const hasRateSnapshot = hydratedState.rateSnapshot !== null;

    if (preferredCurrencyChanged && hydratedState.preferredCurrency) {
      preferredCurrency = hydratedState.preferredCurrency;
    }

    if (!preferredCurrencyChanged && !hasRateSnapshot) return;

    if (hasRateSnapshot) {
      rateSnapshot = hydratedState.rateSnapshot;
    }

    if (hasRateSnapshot) {
      currenciesState = recalculateFromIndex(currenciesState, 0, rateSnapshot);
    }

    currenciesState = applyPreferredCurrencyPreference(
      currenciesState,
      preferredCurrency,
      rateSnapshot,
      getCurrencyStateFromCode,
    );

    notify();
  };

  void hydrate();

  return {
    getSnapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch,
    updateAmount: (id, nextAmount) => {
      dispatch(createAmountUpdateAction(id, nextAmount));
    },
    destroy: () => {
      destroyed = true;
      listeners.clear();
    },
  };
}
