import currencies from "@/assets/currency.json";

const BASE_CURRENCY = "EUR";

// interface CurrencyState {
//   id: string,
//   currency: string,
//   amount: string
// }

export const INITIAL_STATE = [
  {
    id: "1",
    currency: "EUR",
    logo: "🇪🇺",
    seq: 1,
    amount: "1",
  },
  {
    id: "2",
    currency: "INR",
    logo: "🇮🇳",
    seq: 2,
    amount: "100",
  },
  // {
  //   id: '3',
  //   currency: 'JPY',
  //   logo: '🇯🇵',
  //   seq: 3,
  //   amount: '184.47'
  // }
];

const CONVERSION_RATES = {
  EUR: 1,
  INR: 100,
  JPY: 184.47,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function reducer(
  state: typeof INITIAL_STATE,
  action: any,
): typeof INITIAL_STATE {
  const _state = [...state];
  const updatedCurrencyIndex = _state.findIndex(
    (x) => x.id === action.payload?.id,
  );

  switch (action.type) {
    case "amount-update":
      {
        _state.splice(updatedCurrencyIndex, 1, {
          ..._state[updatedCurrencyIndex],
          amount: action.payload.amount,
        });
      }
      break;
    case "currency-update":
      {
        // TODO: Can be optimized
        const logo =
          currencies.find((x) => x.code === action.payload.currencyCode)
            ?.logo || "";
        _state.splice(updatedCurrencyIndex, 1, {
          ..._state[updatedCurrencyIndex],
          currency: action.payload.currencyCode,
          logo,
        });
      }
      break;
    case "currency-add":
      {
        _state.push({
          ...INITIAL_STATE[0],
          seq: _state.length + 1,
          id: (_state.length + 1).toString(),
        });
      }
      break;
    case "currency-swap":
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
  if (_state[updatedCurrencyIndex].currency !== BASE_CURRENCY) {
    baseRate =
      Number(_state[updatedCurrencyIndex].amount) /
      CONVERSION_RATES[
        _state[updatedCurrencyIndex].currency as keyof typeof CONVERSION_RATES
      ];
  }
  return _state.map((currentState, i) => {
    if (i !== updatedCurrencyIndex) {
      return {
        ...currentState,
        amount: String(
          CONVERSION_RATES[
            currentState.currency as keyof typeof CONVERSION_RATES
          ] * baseRate,
        ),
      };
    }
    return currentState;
  });
}
