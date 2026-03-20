import CurrencyBox from "@/components/CurrencyBox/CurrencyBox";
import { ConvertorHOD } from "@/components/Convertor/Convertor";
import { useCurrencyReducer } from "@/hooks/useCurrencyReducer";
import { ActionType, CurrencyCode } from "@/utils/enums";
import type {
  SelectionPopupBoxProps,
  SelectionPopupController,
} from "./content.types";
import { createRoot, Root } from "react-dom/client";

function CurrencyConvertorPopupBox({ number, currency }: SelectionPopupBoxProps) {
  const [currencies, dispatch] = useCurrencyReducer({ number, currency });
  const sourceCurrency = currencies[0];
  const targetCurrency = currencies[1];

  function updateAmount(id: string | undefined, amount: string) {
    if (!id) return;
    dispatch({
      type: ActionType.AMOUNT_UPDATE,
      payload: { id, amount },
    });
  }

  function updateCurrency(id: string | undefined, nextCurrency: CurrencyCode) {
    if (!id) return;
    dispatch({
      type: ActionType.CURRENCY_UPDATE,
      payload: {
        id,
        currency: nextCurrency,
      },
    });
  }

  return (
    <ConvertorHOD variant="selection">
      {sourceCurrency && targetCurrency ? (
        <div className="ccx-converter-layout ccx-converter-layout--selection">
          <CurrencyBox
            variant="selection"
            isCurrencySelectable={false}
            amountPresentationMode="displayThenEdit"
            data={sourceCurrency}
            amountChange={(updatedAmount) => updateAmount(sourceCurrency.id, updatedAmount)}
            currencyChange={(updatedCurrency) =>
              updateCurrency(sourceCurrency.id, updatedCurrency)
            }
          />

          <div className="ccx-converter-divider" aria-hidden />

          <CurrencyBox
            variant="selection"
            isCurrencySelectable={false}
            amountPresentationMode="displayThenEdit"
            data={targetCurrency}
            amountChange={(updatedAmount) => updateAmount(targetCurrency.id, updatedAmount)}
            currencyChange={(updatedCurrency) =>
              updateCurrency(targetCurrency.id, updatedCurrency)
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
    if (!popupRoot || !document.body.contains(popupRoot)) return;

    reactRoot?.unmount();
    document.body.removeChild(popupRoot);
    popupRoot = null;
    reactRoot = null;
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
