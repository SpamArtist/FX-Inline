import currencies from "@/assets/currency.json";
import { ICurrencyState, IDispatchAction } from "@/utils/types";
import { DEFAULT_BASE_CURRENCY } from "./constants";
import { ActionType, CurrencyCode } from "./enums";

const CONVERSION_RATES = {
  EUR: 1,
  INR: 100,
  JPY: 184.47,
  VND: 30734,
};

const CURRENCY_LOGO_BY_CODE = new Map(
  currencies.map((currency) => [currency.code as CurrencyCode, currency.logo || ""]),
);

function recalculateAmounts(
  state: ICurrencyState[],
  updatedCurrencyIndex: number,
): ICurrencyState[] {
  if (updatedCurrencyIndex < 0 || updatedCurrencyIndex >= state.length) {
    return state;
  }

  let baseRate = Number(state[updatedCurrencyIndex].amount);

  if (state[updatedCurrencyIndex].code !== DEFAULT_BASE_CURRENCY.code) {
    baseRate =
      Number(state[updatedCurrencyIndex].amount) /
      CONVERSION_RATES[state[updatedCurrencyIndex].code as keyof typeof CONVERSION_RATES];
  }

  return state.map((currentState, index) => {
    if (index === updatedCurrencyIndex) {
      return currentState;
    }

    return {
      ...currentState,
      amount: String(
        CONVERSION_RATES[currentState.code as keyof typeof CONVERSION_RATES] * baseRate,
      ),
    };
  });
}

export function reducer(
  state: ICurrencyState[],
  action: IDispatchAction,
): ICurrencyState[] {
  const nextState = [...state];
  const updatedCurrencyIndex = nextState.findIndex(
    (x) => x.id === action.payload?.id,
  );
  const requiresExistingIndex = new Set([
    ActionType.AMOUNT_UPDATE,
    ActionType.CURRENCY_UPDATE,
    ActionType.CURRENCY_SWAP,
  ]);

  if (requiresExistingIndex.has(action.type) && updatedCurrencyIndex === -1) {
    return nextState;
  }

  switch (action.type) {
    case ActionType.AMOUNT_UPDATE: {
      nextState.splice(updatedCurrencyIndex, 1, {
        ...nextState[updatedCurrencyIndex],
        amount: action.payload.amount as string,
      });
      break;
    }
    case ActionType.CURRENCY_UPDATE: {
      const nextCurrency = action.payload.currency as CurrencyCode;
      const logo = CURRENCY_LOGO_BY_CODE.get(nextCurrency) || "";

      nextState.splice(updatedCurrencyIndex, 1, {
        ...nextState[updatedCurrencyIndex],
        code: nextCurrency,
        icon: logo,
      });
      break;
    }
    case ActionType.CURRENCY_ADD: {
      nextState.push({
        amount: "100",
        ...DEFAULT_BASE_CURRENCY,
        seq: nextState.length + 1,
      });
      break;
    }
    case ActionType.CURRENCY_SWAP: {
      if (updatedCurrencyIndex >= nextState.length - 1) {
        return nextState;
      }

      nextState[updatedCurrencyIndex].seq += 1;
      nextState[updatedCurrencyIndex + 1].seq -= 1;
      nextState.sort((a, b) => a.seq - b.seq);
      break;
    }
    default:
      break;
  }

  if (updatedCurrencyIndex === -1) {
    return nextState;
  }

  return recalculateAmounts(nextState, updatedCurrencyIndex);
}
