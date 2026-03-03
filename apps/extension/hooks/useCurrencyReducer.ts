import currencies from "@/assets/currency.json";
import { getUserSettings } from "@/utils/appStorage";
import { CURRENCY_CODE_MAP } from "@/utils/constants";
import { ActionType, CurrencyCode } from "@/utils/enums";
import { convertAmountWithSnapshot, formatConvertedAmount } from "@/utils/rateMath";
import {
  getRatesForUser,
  RateSnapshot,
} from "@/utils/rates";
import { ICurrencyState, IDispatchAction } from "@/utils/types";
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_SECONDARY_CURRENCY = CurrencyCode.EURO;

const CURRENCY_LIST_BY_CODE = new Map(
  currencies.map((currency) => [currency.code as CurrencyCode, currency]),
);

function createCurrencyId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `currency-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getCurrencyStateFromCode(code: CurrencyCode) {
  const currencyFromMap = CURRENCY_CODE_MAP[code];
  if (currencyFromMap) {
    return currencyFromMap;
  }

  const currencyFromList = CURRENCY_LIST_BY_CODE.get(code);

  return {
    code,
    icon: currencyFromList?.logo || "",
  };
}

function resolveAltCurrency(
  baseCurrency: CurrencyCode,
  preferredCurrency: CurrencyCode,
) {
  if (preferredCurrency !== baseCurrency) {
    return preferredCurrency;
  }

  return baseCurrency === CurrencyCode["UNITED STATES DOLLAR"]
    ? DEFAULT_SECONDARY_CURRENCY
    : CurrencyCode["UNITED STATES DOLLAR"];
}

function convertAmount(
  value: string,
  sourceCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  snapshot: RateSnapshot | null,
): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return value;

  if (!snapshot) {
    return numericValue.toFixed(4);
  }

  const converted = convertAmountWithSnapshot(
    numericValue,
    sourceCurrency,
    targetCurrency,
    snapshot,
  );

  return converted === null
    ? numericValue.toFixed(4)
    : formatConvertedAmount(converted);
}

function recalculateFromIndex(
  state: ICurrencyState[],
  updatedCurrencyIndex: number,
  snapshot: RateSnapshot | null,
): ICurrencyState[] {
  if (updatedCurrencyIndex < 0 || updatedCurrencyIndex >= state.length) {
    return state;
  }

  const sourceState = state[updatedCurrencyIndex];
  const sourceAmount = Number(sourceState.amount);

  if (!Number.isFinite(sourceAmount)) {
    return state;
  }

  return state.map((current, index) => {
    if (index === updatedCurrencyIndex) return current;

    return {
      ...current,
      amount: convertAmount(
        sourceState.amount,
        sourceState.code,
        current.code,
        snapshot,
      ),
    };
  });
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
    CurrencyCode["UNITED STATES DOLLAR"],
  );

  const appliedPreferredCurrencyRef = useRef(false);

  const [currenciesState, setCurrenciesState] = useState<ICurrencyState[]>(() => {
    const altCurrency = resolveAltCurrency(currency, DEFAULT_SECONDARY_CURRENCY);

    return [
      {
        id: createCurrencyId(),
        ...getCurrencyStateFromCode(currency),
        seq: 1,
        amount: number,
      },
      {
        id: createCurrencyId(),
        ...getCurrencyStateFromCode(altCurrency),
        seq: 2,
        amount: number,
      },
    ];
  });

  useEffect(() => {
    let canceled = false;

    const loadSettingsAndRates = async () => {
      try {
        const settings = await getUserSettings();
        const rates = await getRatesForUser(settings);

        if (canceled) return;

        setPreferredCurrency(settings.preferredCurrency);
        setRateSnapshot(rates);
      } catch {
        if (canceled) return;
        setRateSnapshot(null);
      }
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
    if (appliedPreferredCurrencyRef.current) return;

    setCurrenciesState((current) => {
      if (current.length < 2) return current;

      const next = [...current];
      const nextCurrency = resolveAltCurrency(
        next[0].code,
        preferredCurrency,
      );

      next[1] = {
        ...next[1],
        ...getCurrencyStateFromCode(nextCurrency),
        code: nextCurrency,
      };

      appliedPreferredCurrencyRef.current = true;
      return recalculateFromIndex(next, 0, rateSnapshot);
    });
  }, [preferredCurrency, rateSnapshot]);

  const dispatch = useCallback(
    (action: IDispatchAction) => {
      setCurrenciesState((state) => {
        const nextState = [...state];
        const updatedCurrencyIndex = nextState.findIndex(
          (x) => x.id === action.payload?.id,
        );

        switch (action.type) {
          case ActionType.AMOUNT_UPDATE:
            if (updatedCurrencyIndex === -1) return nextState;
            nextState.splice(updatedCurrencyIndex, 1, {
              ...nextState[updatedCurrencyIndex],
              amount: action.payload.amount as string,
            });
            return recalculateFromIndex(nextState, updatedCurrencyIndex, rateSnapshot);

          case ActionType.CURRENCY_UPDATE:
            if (updatedCurrencyIndex === -1) return nextState;
            nextState.splice(updatedCurrencyIndex, 1, {
              ...nextState[updatedCurrencyIndex],
              ...getCurrencyStateFromCode(action.payload.currency as CurrencyCode),
              code: action.payload.currency as CurrencyCode,
            });
            return recalculateFromIndex(nextState, updatedCurrencyIndex, rateSnapshot);

          case ActionType.CURRENCY_ADD: {
            const newCurrency = resolveAltCurrency(
              nextState[0]?.code || CurrencyCode["UNITED STATES DOLLAR"],
              preferredCurrency,
            );

            nextState.push({
              id: createCurrencyId(),
              amount: "100",
              ...getCurrencyStateFromCode(newCurrency),
              seq: nextState.length + 1,
            });

            return recalculateFromIndex(nextState, 0, rateSnapshot);
          }

          case ActionType.CURRENCY_SWAP:
            if (
              updatedCurrencyIndex === -1 ||
              updatedCurrencyIndex === nextState.length - 1
            ) {
              return nextState;
            }

            nextState[updatedCurrencyIndex].seq += 1;
            nextState[updatedCurrencyIndex + 1].seq -= 1;
            nextState.sort((a, b) => a.seq - b.seq);
            return nextState;

          default:
            return nextState;
        }
      });
    },
    [preferredCurrency, rateSnapshot],
  );

  return [currenciesState, dispatch] as const;
};
