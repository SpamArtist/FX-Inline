import { DEFAULT_STARTING_CURRENCY } from "@/utils/constants";
import { CurrencyCode } from "@/utils/enums";
import type { RateSnapshot } from "@/utils/rates.types";
import type { CurrencyState, DispatchAction } from "@/utils/types";
import { useCallback, useEffect, useState } from "react";
import {
  applyHydratedBootstrapState,
  createBootstrapCurrenciesState,
  createCurrencyIdFactory,
  getCurrencyStateFromCode,
} from "./currencyStateBootstrap";
import { loadCurrencyReducerHydration } from "./useCurrencyReducer.hydration";
import {
  DEFAULT_SECONDARY_CURRENCY,
  recalculateFromIndex,
  reduceCurrencyState,
} from "./useCurrencyReducer.state";

const createCurrencyId = createCurrencyIdFactory();

export const useCurrencyReducer = ({
  number,
  currency,
}: {
  number: string;
  currency: CurrencyCode;
}) => {
  const [rateSnapshot, setRateSnapshot] = useState<RateSnapshot | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState<CurrencyCode>(
    DEFAULT_STARTING_CURRENCY,
  );

  const [currenciesState, setCurrenciesState] = useState<CurrencyState[]>(() => {
    return createBootstrapCurrenciesState({
      amount: number,
      sourceCurrency: currency,
      preferredCurrency: DEFAULT_SECONDARY_CURRENCY,
      createCurrencyId,
    });
  });

  useEffect(() => {
    let canceled = false;

    const loadSettingsAndRates = async () => {
      const hydratedState = await loadCurrencyReducerHydration();

      if (canceled) return;

      if (hydratedState.preferredCurrency) {
        setPreferredCurrency(hydratedState.preferredCurrency);
      }
      setRateSnapshot(hydratedState.rateSnapshot);

      setCurrenciesState((current) => {
        const next = applyHydratedBootstrapState({
          currenciesState: current,
          preferredCurrency,
          rateSnapshot,
          hydratedState,
        });
        return next.changed ? next.currenciesState : current;
      });
    };

    loadSettingsAndRates();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!rateSnapshot) return;

    setCurrenciesState((current) => recalculateFromIndex(current, 0, rateSnapshot));
  }, [rateSnapshot]);

  const dispatch = useCallback(
    (action: DispatchAction) => {
      setCurrenciesState((state) =>
        reduceCurrencyState(state, action, {
          preferredCurrency,
          rateSnapshot,
          createCurrencyId,
          getCurrencyStateFromCode,
        }),
      );
    },
    [preferredCurrency, rateSnapshot],
  );

  return [currenciesState, dispatch] as const;
};
