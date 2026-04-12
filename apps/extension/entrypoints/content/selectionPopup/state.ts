import {
  applyHydratedBootstrapState,
  createBootstrapCurrenciesState,
  createCurrencyIdFactory,
  getCurrencyStateFromCode,
} from "@/hooks/currencyStateBootstrap";
import { DEFAULT_STARTING_CURRENCY } from "@/utils/constants";
import { ActionType, CurrencyCode } from "@/utils/enums";
import type { RateSnapshot } from "@/utils/rates.types";
import type { CurrencyState, DispatchAction } from "@/utils/types";
import type { CurrencyReducerHydrationDeps } from "@/hooks/useCurrencyReducer.hydration";
import { loadCurrencyReducerHydration } from "@/hooks/useCurrencyReducer.hydration";
import {
  DEFAULT_SECONDARY_CURRENCY,
  reduceCurrencyState,
} from "@/hooks/useCurrencyReducer.state";

const createCurrencyId = createCurrencyIdFactory();

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

  let currenciesState = createBootstrapCurrenciesState({
    amount,
    sourceCurrency,
    preferredCurrency: DEFAULT_SECONDARY_CURRENCY,
    createCurrencyId,
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

    const next = applyHydratedBootstrapState({
      currenciesState,
      preferredCurrency,
      rateSnapshot,
      hydratedState,
    });

    if (!next.changed) return;

    preferredCurrency = next.preferredCurrency;
    rateSnapshot = next.rateSnapshot;
    currenciesState = next.currenciesState;
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
