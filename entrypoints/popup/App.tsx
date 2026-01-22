import PlusIcon from "@/assets/add_outline.svg";
import SwapVerticalIcon from "@/assets/swap_vertical_outline.svg";
import "@/assets/tailwind.css";
import { ConvertorHOD } from "@/components/Convertor/Convertor";
import CurrencyBox from "@/components/CurrencyBox/CurrencyBox";
import { useCurrencyReducer } from "@/hooks/useCurrencyReducer";
import "./App.css";

function App() {
  const [currencies, dispatch] = useCurrencyReducer();
  return (
    <ConvertorHOD>
      {currencies.map((currentCurrency, i) => (
        <div
          key={currentCurrency.id}
          className="relative flex flex-col items-center w-72.5"
        >
          <CurrencyBox
            key={currentCurrency.id}
            data={currentCurrency}
            amountChange={(updatedAmount) =>
              dispatch({
                type: "amount-update",
                payload: { id: currentCurrency.id, amount: updatedAmount },
              })
            }
            currencyChange={(updatedCurrency) =>
              dispatch({
                type: "currency-update",
                payload: {
                  id: currentCurrency.id,
                  currencyCode: updatedCurrency,
                },
              })
            }
          />
          {i !== currencies.length - 1 && (
            <button
              className="absolute -bottom-4 z-10 cursor-pointer"
              onClick={() =>
                dispatch({
                  type: "currency-swap",
                  payload: {
                    id: currentCurrency.id,
                  },
                })
              }
            >
              <SwapVerticalIcon />
            </button>
          )}
        </div>
      ))}
      <button
        className="absolute -bottom-4 z-10 cursor-pointer"
        onClick={() =>
          dispatch({
            type: "currency-add",
          })
        }
      >
        <PlusIcon />
      </button>
    </ConvertorHOD>
  );
}

export default App;
