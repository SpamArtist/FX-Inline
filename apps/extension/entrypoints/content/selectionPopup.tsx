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

  return (
    <ConvertorHOD shouldDisplayHeader={false}>
      {currencies.map((currentCurrency) => (
        <CurrencyBox
          key={currentCurrency.id}
          isDisabled
          containerStyle="px-[0.8em] border-[none] outline-[none] gap-x-[0.5em]"
          dropDownContainerStyle="flex-[1] mt-[1.5em] max-w-[4.286em]"
          inputContainerStyle="flex flex-col flex-[1.2] gap-[0.35em]"
          data={currentCurrency}
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
      ))}
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
    reactContainer.className =
      "w-[18em] [box-shadow:0px_0px_3px_2px_wheat] rounded-md rounded-tl-none";
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
