import currencies from "@/assets/currency.json";
import { CURRENCY_CODE_MAP, DEFAULT_STARTING_CURRENCY } from "@/utils/constants";
import { CurrencyCode } from "@/utils/enums";
import type { RateSnapshot } from "@/utils/rates.types";
import type { CurrencyState, DispatchAction } from "@/utils/types";
import { useCallback, useEffect, useState } from "react";
import { loadCurrencyReducerHydration } from "./useCurrencyReducer.hydration";
import {
  DEFAULT_SECONDARY_CURRENCY,
  applyPreferredCurrencyPreference,
  createInitialCurrenciesState,
  recalculateFromIndex,
  reduceCurrencyState,
} from "./useCurrencyReducer.state";

const CURRENCY_LIST_BY_CODE = new Map(
  currencies.map((currency) => [currency.code as CurrencyCode, currency]),
);

let currencyIdCounter = 0;

function createCurrencyId() {
  currencyIdCounter += 1;
  return `currency-${currencyIdCounter}`;
}

function getCurrencyStateFromCode(code: CurrencyCode) {
  const currencyFromMap = CURRENCY_CODE_MAP[code];
  if (currencyFromMap) return currencyFromMap;

  return { code, icon: CURRENCY_LIST_BY_CODE.get(code)?.logo || "" };
}

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
    return createInitialCurrenciesState({
      amount: number,
      sourceCurrency: currency,
      preferredCurrency: DEFAULT_SECONDARY_CURRENCY,
      createCurrencyId,
      getCurrencyStateFromCode,
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

  useEffect(() => {
    setCurrenciesState((current) =>
      applyPreferredCurrencyPreference(
        current,
        preferredCurrency,
        rateSnapshot,
        getCurrencyStateFromCode,
      ),
    );
  }, [preferredCurrency, rateSnapshot]);

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
