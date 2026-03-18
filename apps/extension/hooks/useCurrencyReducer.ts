import currencies from "@/assets/currency.json";
import { getUserSettings } from "@/utils/appStorage";
import { CURRENCY_CODE_MAP, DEFAULT_STARTING_CURRENCY } from "@/utils/constants";
import { ActionType, CurrencyCode } from "@/utils/enums";
import { convertAmountWithSnapshot, formatConvertedAmount } from "@/utils/rateMath";
import type { RateSnapshot } from "@/utils/rates.types";
import { getRates } from "@/utils/rates";
import { ICurrencyState, IDispatchAction } from "@/utils/types";
import { useCallback, useEffect, useState } from "react";

const DEFAULT_SECONDARY_CURRENCY = CurrencyCode["UNITED STATES DOLLAR"];

const CURRENCY_LIST_BY_CODE = new Map(
  currencies.map((currency) => [currency.code as CurrencyCode, currency]),
);
const VALID_CURRENCY_CODES: ReadonlySet<string> = new Set(
  Object.values(CurrencyCode),
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

function resolveAltCurrency(
  baseCurrency: CurrencyCode,
  preferredCurrency: CurrencyCode,
) {
  return preferredCurrency !== baseCurrency
    ? preferredCurrency
    : baseCurrency === DEFAULT_STARTING_CURRENCY
    ? DEFAULT_SECONDARY_CURRENCY
    : DEFAULT_STARTING_CURRENCY;
}

function asCurrencyCode(value: string | undefined): CurrencyCode | null {
  return value && VALID_CURRENCY_CODES.has(value) ? (value as CurrencyCode) : null;
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

function replaceCurrencyStateAt(
  state: ICurrencyState[],
  index: number,
  nextItem: ICurrencyState,
): ICurrencyState[] {
  const next = [...state];
  next[index] = nextItem;
  return next;
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
        const rates = await getRates();

        if (canceled) return;

        setPreferredCurrency(settings.preferredCurrency);
        setRateSnapshot(rates);
      } catch {
        if (!canceled) {
          setRateSnapshot(null);
        }
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
    setCurrenciesState((current) => {
      if (current.length < 2) return current;

      const nextCurrency = resolveAltCurrency(
        current[0].code,
        preferredCurrency,
      );
      if (current[1].code === nextCurrency) return current;

      const next = [...current];

      next[1] = {
        ...next[1],
        ...getCurrencyStateFromCode(nextCurrency),
        code: nextCurrency,
      };

      return recalculateFromIndex(next, 0, rateSnapshot);
    });
  }, [preferredCurrency, rateSnapshot]);

  const dispatch = useCallback(
    (action: IDispatchAction) => {
      setCurrenciesState((state) => {
        const updatedCurrencyIndex = state.findIndex(
          (x) => x.id === action.payload?.id,
        );

        switch (action.type) {
          case ActionType.AMOUNT_UPDATE: {
            if (updatedCurrencyIndex === -1) return state;
            const nextAmount = action.payload.amount;
            if (typeof nextAmount !== "string") return state;

            const nextState = replaceCurrencyStateAt(state, updatedCurrencyIndex, {
              ...state[updatedCurrencyIndex],
              amount: nextAmount,
            });
            return recalculateFromIndex(nextState, updatedCurrencyIndex, rateSnapshot);
          }

          case ActionType.CURRENCY_UPDATE: {
            if (updatedCurrencyIndex === -1) return state;
            const nextCurrency = asCurrencyCode(action.payload.currency);
            if (!nextCurrency) return state;

            const nextState = replaceCurrencyStateAt(state, updatedCurrencyIndex, {
              ...state[updatedCurrencyIndex],
              ...getCurrencyStateFromCode(nextCurrency),
              code: nextCurrency,
            });
            return recalculateFromIndex(nextState, updatedCurrencyIndex, rateSnapshot);
          }

          case ActionType.CURRENCY_ADD: {
            const nextState = [...state];
            const newCurrency = resolveAltCurrency(
              nextState[0]?.code || DEFAULT_STARTING_CURRENCY,
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
              updatedCurrencyIndex === state.length - 1
            ) {
              return state;
            }

            const nextState = [...state];
            nextState[updatedCurrencyIndex].seq += 1;
            nextState[updatedCurrencyIndex + 1].seq -= 1;
            nextState.sort((a, b) => a.seq - b.seq);
            return nextState;

          default:
            return state;
        }
      });
    },
    [preferredCurrency, rateSnapshot],
  );

  return [currenciesState, dispatch] as const;
};
