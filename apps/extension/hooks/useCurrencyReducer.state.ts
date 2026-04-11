import { DEFAULT_STARTING_CURRENCY } from "../utils/constants";
import { ActionType, CurrencyCode } from "../utils/enums";
import { convertAmountWithSnapshot, formatConvertedAmount } from "../utils/rateMath";
import type { RateSnapshot } from "../utils/rates.types";
import type { CurrencyState, DispatchAction } from "../utils/types";

export const DEFAULT_SECONDARY_CURRENCY = CurrencyCode["UNITED STATES DOLLAR"];

const VALID_CURRENCY_CODES: ReadonlySet<string> = new Set(
  Object.values(CurrencyCode),
);

type CurrencyStateFromCode = Pick<CurrencyState, "code" | "icon">;

export type CurrencyStateResolver = (code: CurrencyCode) => CurrencyStateFromCode;

export type CurrencyReducerContext = {
  preferredCurrency: CurrencyCode;
  rateSnapshot: RateSnapshot | null;
  createCurrencyId: () => string;
  getCurrencyStateFromCode: CurrencyStateResolver;
};

export type InitialCurrencyStateParams = {
  amount: string;
  sourceCurrency: CurrencyCode;
  preferredCurrency: CurrencyCode;
  createCurrencyId: () => string;
  getCurrencyStateFromCode: CurrencyStateResolver;
};

export function resolveAltCurrency(
  baseCurrency: CurrencyCode,
  preferredCurrency: CurrencyCode,
): CurrencyCode {
  return preferredCurrency !== baseCurrency
    ? preferredCurrency
    : baseCurrency === DEFAULT_STARTING_CURRENCY
    ? DEFAULT_SECONDARY_CURRENCY
    : DEFAULT_STARTING_CURRENCY;
}

export function createInitialCurrenciesState({
  amount,
  sourceCurrency,
  preferredCurrency,
  createCurrencyId,
  getCurrencyStateFromCode,
}: InitialCurrencyStateParams): CurrencyState[] {
  const altCurrency = resolveAltCurrency(sourceCurrency, preferredCurrency);

  return [
    {
      id: createCurrencyId(),
      ...getCurrencyStateFromCode(sourceCurrency),
      seq: 1,
      amount,
    },
    {
      id: createCurrencyId(),
      ...getCurrencyStateFromCode(altCurrency),
      seq: 2,
      amount,
    },
  ];
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

export function recalculateFromIndex(
  state: CurrencyState[],
  updatedCurrencyIndex: number,
  snapshot: RateSnapshot | null,
): CurrencyState[] {
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
  state: CurrencyState[],
  index: number,
  nextItem: CurrencyState,
): CurrencyState[] {
  const next = [...state];
  next[index] = nextItem;
  return next;
}

export function applyPreferredCurrencyPreference(
  state: CurrencyState[],
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot | null,
  getCurrencyStateFromCode: CurrencyStateResolver,
): CurrencyState[] {
  if (state.length < 2) return state;

  const nextCurrency = resolveAltCurrency(state[0].code, preferredCurrency);
  if (state[1].code === nextCurrency) return state;

  const next = [...state];

  next[1] = {
    ...next[1],
    ...getCurrencyStateFromCode(nextCurrency),
    code: nextCurrency,
  };

  return recalculateFromIndex(next, 0, rateSnapshot);
}

export function reduceCurrencyState(
  state: CurrencyState[],
  action: DispatchAction,
  context: CurrencyReducerContext,
): CurrencyState[] {
  const {
    preferredCurrency,
    rateSnapshot,
    createCurrencyId,
    getCurrencyStateFromCode,
  } = context;

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

    case ActionType.CURRENCY_SWAP: {
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
    }

    default:
      return state;
  }
}
