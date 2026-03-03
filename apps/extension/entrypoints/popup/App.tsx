import PlusIcon from "@/assets/add_outline.svg";
import SwapVerticalIcon from "@/assets/swap_vertical_outline.svg";
import "@/assets/tailwind.css";
import { ConvertorHOD } from "@/components/Convertor/Convertor";
import CurrencyBox from "@/components/CurrencyBox/CurrencyBox";
import { useCurrencyReducer } from "@/hooks/useCurrencyReducer";
import { ActionType, CurrencyCode } from "@/utils/enums";
import { browser } from "wxt/browser";
import "./App.css";

const DEFAULT_STARTING_CURRENCY = CurrencyCode["UNITED STATES DOLLAR"];

function App() {
  const [currenciesState, dispatch] = useCurrencyReducer({
    number: "100",
    currency: DEFAULT_STARTING_CURRENCY,
  });
  const currentYear = new Date().getFullYear();

  async function onOpenSettings() {
    try {
      await browser.runtime.openOptionsPage();
    } catch {
      await browser.tabs.create({
        url: browser.runtime.getURL("/options.html"),
      });
    }
  }

  return (
    <ConvertorHOD shouldDisplayHeader>
      <div className="relative flex flex-col items-center mb-2.5 mx-2.5 pb-[1.2em] py-0 bg-inherit text-[wheat]">
        {currenciesState.map((currentCurrency, i) => (
          <div
            key={currentCurrency.id}
            className="relative flex flex-col items-center w-72.5"
          >
            <CurrencyBox
              isDisabled={false}
              data={currentCurrency}
              containerStyle="px-[0.8em] py-[1.5em] rounded-xl shadow-lg outline outline-black/5 dark:bg-white-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10 gap-x-[0.5em]"
              dropDownContainerStyle="flex-[1.2] mt-[0.875em]"
              inputContainerStyle="flex flex-col gap-[0.35em] flex-3"
              amountChange={(updatedAmount) =>
                dispatch({
                  type: ActionType.AMOUNT_UPDATE,
                  payload: { id: currentCurrency.id, amount: updatedAmount },
                })
              }
              currencyChange={(updatedCurrency) =>
                dispatch({
                  type: ActionType.CURRENCY_UPDATE,
                  payload: {
                    id: currentCurrency.id,
                    currency: updatedCurrency,
                  },
                })
              }
            />
            {i !== currenciesState.length - 1 && (
              <button
                className="absolute -bottom-4 z-10 cursor-pointer"
                onClick={() =>
                  dispatch({
                    type: ActionType.CURRENCY_SWAP,
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
              type: ActionType.CURRENCY_ADD,
              payload: {},
            })
          }
        >
          <PlusIcon />
        </button>
      </div>

      <footer className="popup-options-footer">
        <span className="popup-options-muted">© {currentYear} Currency Converter</span>
        <span className="popup-options-separator"> - </span>
        <button type="button" className="popup-options-link" onClick={onOpenSettings}>
          Extension Options
        </button>
      </footer>
    </ConvertorHOD>
  );
}

export default App;
