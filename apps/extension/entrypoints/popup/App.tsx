import { ConvertorHOD } from "@/components/Convertor/Convertor";
import CurrencyBox from "@/components/CurrencyBox/CurrencyBox";
import { useCurrencyReducer } from "@/hooks/useCurrencyReducer";
import { DEFAULT_STARTING_CURRENCY } from "@/utils/constants";
import { ActionType } from "@/utils/enums";
import { ArrowLeftRight, Cog } from "lucide-react";
import { browser } from "wxt/browser";
import "./App.css";

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

  const sourceCurrency = currenciesState[0];
  const targetCurrency = currenciesState[1];

  function onSwapCurrencies() {
    if (!sourceCurrency?.id) return;

    dispatch({
      type: ActionType.CURRENCY_SWAP,
      payload: {
        id: sourceCurrency.id,
      },
    });
  }

  return (
    <main className="ccx-popup-page">
      <ConvertorHOD
        variant="popup"
        headerActions={(
          <button
            type="button"
            className="ccx-settings-button"
            onClick={onOpenSettings}
            aria-label="Open extension options"
            title="Open extension options"
          >
            <Cog size={16} aria-hidden />
          </button>
        )}
      >
        {sourceCurrency && targetCurrency ? (
          <div className="ccx-converter-layout ccx-popup-layout">
            <button
              type="button"
              className="ccx-converter-swap"
              onClick={onSwapCurrencies}
              aria-label="Swap currencies"
              title="Swap currencies"
            >
              <ArrowLeftRight size={16} aria-hidden />
            </button>

            <CurrencyBox
              variant="popup"
              isCurrencySelectable
              amountPresentationMode="displayThenEdit"
              data={sourceCurrency}
              amountChange={(updatedAmount) =>
                dispatch({
                  type: ActionType.AMOUNT_UPDATE,
                  payload: { id: sourceCurrency.id, amount: updatedAmount },
                })
              }
              currencyChange={(updatedCurrency) =>
                dispatch({
                  type: ActionType.CURRENCY_UPDATE,
                  payload: {
                    id: sourceCurrency.id,
                    currency: updatedCurrency,
                  },
                })
              }
            />

            <div className="ccx-converter-divider" aria-hidden />

            <CurrencyBox
              variant="popup"
              isCurrencySelectable
              amountPresentationMode="displayThenEdit"
              data={targetCurrency}
              amountChange={(updatedAmount) =>
                dispatch({
                  type: ActionType.AMOUNT_UPDATE,
                  payload: { id: targetCurrency.id, amount: updatedAmount },
                })
              }
              currencyChange={(updatedCurrency) =>
                dispatch({
                  type: ActionType.CURRENCY_UPDATE,
                  payload: {
                    id: targetCurrency.id,
                    currency: updatedCurrency,
                  },
                })
              }
            />
          </div>
        ) : null}
        <p className="ccx-popup-meta">© {currentYear} FX Inline</p>
      </ConvertorHOD>
    </main>
  );
}

export default App;
