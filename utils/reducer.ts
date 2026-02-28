import currencies from "@/assets/currency.json";
import { ICurrencyState, IDispatchAction } from "@/utils/types";
import { DEFAULT_BASE_CURRENCY } from "./constants";
import { ActionType, CurrencyCode } from "./enums";

const CONVERSION_RATES = {
  EUR: 1,
  INR: 100,
  JPY: 184.47,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function reducer(
  state: ICurrencyState[],
  action: IDispatchAction,
): ICurrencyState[] {
  const _state = [...state];
  const updatedCurrencyIndex = _state.findIndex(
    (x) => x.id === action.payload?.id,
  );

  switch (action.type) {
    case ActionType.AMOUNT_UPDATE:
      {
        _state.splice(updatedCurrencyIndex, 1, {
          ..._state[updatedCurrencyIndex],
          amount: action.payload.amount as string,
        });
      }
      break;
    case ActionType.CURRENCY_UPDATE:
      {
        // TODO: Can be optimized
        const logo =
          currencies.find((x) => x.code === action.payload.currency)
            ?.logo || "";
        _state.splice(updatedCurrencyIndex, 1, {
          ..._state[updatedCurrencyIndex],
          code: action.payload.currency as CurrencyCode,
          icon: logo,
        });
      }
      break;
    case ActionType.CURRENCY_ADD:
      {
        _state.push({
          //TODO: Amount assignment is probably wrong
          amount: "100",
          ...DEFAULT_BASE_CURRENCY,
          seq: _state.length + 1,
        });
      }
      break;
    case ActionType.CURRENCY_SWAP:
      {
        _state[updatedCurrencyIndex].seq += 1;
        _state[updatedCurrencyIndex + 1].seq -= 1;
        _state.sort((a, b) => a.seq - b.seq);
      }
      break;
  }

  if (updatedCurrencyIndex === -1) return _state;

  //TODO: When currency is updated it should only change other amounts according to the changed amount
  let baseRate = Number(_state[updatedCurrencyIndex].amount);
  if (_state[updatedCurrencyIndex].code !== DEFAULT_BASE_CURRENCY.code) {
    baseRate =
      Number(_state[updatedCurrencyIndex].amount) /
      CONVERSION_RATES[
        _state[updatedCurrencyIndex].code as keyof typeof CONVERSION_RATES
      ];
  }
  return _state.map((currentState, i) => {
    if (i !== updatedCurrencyIndex) {
      return {
        ...currentState,
        amount: String(
          CONVERSION_RATES[currentState.code as keyof typeof CONVERSION_RATES] *
            baseRate,
        ),
      };
    }
    return currentState;
  });
}
