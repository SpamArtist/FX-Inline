import CurrencyBox from "@/components/CurrencyBox/CurrencyBox";
import { ConvertorHOD } from "@/components/Convertor/Convertor";
import { useCurrencyReducer } from "@/hooks/useCurrencyReducer";
import { ActionType, CurrencyCode } from "@/utils/enums";
import { createRoot, Root } from "react-dom/client";

type SelectionPopupController = {
  showPopup: (x: number, y: number, amount: string, currency: CurrencyCode) => void;
  removePopup: () => void;
  containsTarget: (target: Node) => boolean;
  getRoot: () => HTMLDivElement | null;
  destroy: () => void;
};

function CurrencyConvertorPopupBox({
  number,
  currency,
}: {
  number: string;
  currency: CurrencyCode;
}) {
  const [currencies, dispatch] = useCurrencyReducer({ number, currency });
  const sourceCurrency = currencies[0];
  const targetCurrency = currencies[1];

  return (
    <ConvertorHOD variant="selection">
      {sourceCurrency && targetCurrency ? (
        <div className="ccx-converter-layout ccx-converter-layout--selection">
          <CurrencyBox
            variant="selection"
            isCurrencySelectable={false}
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
            variant="selection"
            isCurrencySelectable={false}
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
    </ConvertorHOD>
  );
}

export function createSelectionPopupController(
  contentStyleText: string,
): SelectionPopupController {
  let popupRoot: HTMLDivElement | null = null;
  let reactRoot: Root | null = null;

  function removePopup() {
    if (popupRoot && document.body.contains(popupRoot)) {
      reactRoot?.unmount();
      document.body.removeChild(popupRoot);
      popupRoot = null;
      reactRoot = null;
    }
  }

  function showPopup(
    x: number,
    y: number,
    amount: string,
    currency: CurrencyCode,
  ) {
    removePopup();

    popupRoot = document.createElement("div");
    popupRoot.id = "popup-root";

    const shadowRoot = popupRoot.attachShadow({
      mode: "open",
    });

    const contentStyleTag = document.createElement("style");
    contentStyleTag.id = "content-styles";
    contentStyleTag.textContent = contentStyleText;
    shadowRoot.appendChild(contentStyleTag);

    popupRoot.style.position = "absolute";
    popupRoot.style.top = `${y}px`;
    popupRoot.style.left = `${x}px`;
    popupRoot.style.zIndex = "9999999";
    popupRoot.style.pointerEvents = "auto";

    const reactContainer = document.createElement("div");
    reactContainer.id = "popup-react-container";
    reactContainer.className = "ccx-selection-popup-host";
    shadowRoot.appendChild(reactContainer);

    document.body.appendChild(popupRoot);

    reactRoot = createRoot(reactContainer);
    reactRoot.render(
      <CurrencyConvertorPopupBox number={amount} currency={currency} />,
    );
  }

  return {
    showPopup,
    removePopup,
    containsTarget: (target) => Boolean(popupRoot?.contains(target)),
    getRoot: () => popupRoot,
    destroy: () => removePopup(),
  };
}
