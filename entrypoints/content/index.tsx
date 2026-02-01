import CurrencyBox from "@/components/CurrencyBox/CurrencyBox";
import { useCurrencyReducer } from "@/hooks/useCurrencyReducer";
import { ActionType } from "@/utils/enums";
import { createRoot, Root } from "react-dom/client";
import { ConvertorHOD } from "../../components/Convertor/Convertor";
import contentBoxStyles from "./content.css?inline";
import { DEFAULT_ALT_CURRENCY } from "@/utils/constants";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "manual",
  async main(ctx) {
    console.log("here");

    let popupRoot: HTMLDivElement | null = null;
    let shadowRoot: ShadowRoot | null = null;
    let reactRoot: Root | null = null;

    function removePopup() {
      if (popupRoot && document.body.contains(popupRoot)) {
        reactRoot?.unmount();
        document.body.removeChild(popupRoot);
        popupRoot = null;
        shadowRoot = null;
        reactRoot = null;
      }
    }

    function CurrencyConvertorPopupBox({
      number,
      currency,
    }: {
      number: string;
      currency: string;
    }) {
      const [currencies, dispatch] = useCurrencyReducer({ number, currency });

      return (
        <ConvertorHOD shouldDisplayHeader={false}>
          {currencies.map((currentCurrency) => (
            <CurrencyBox
              key={currentCurrency.id}
              //TODO: Get dropdown working
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

    function showPopup(x: number, y: number, selectedText: string) {
      removePopup();

      popupRoot = document.createElement("div");
      popupRoot.id = "popup-root";

      shadowRoot = popupRoot.attachShadow({
        mode: "open",
      });

      const contentStyleTag = document.createElement("style");
      contentStyleTag.id = "content-styles";
      contentStyleTag.textContent = contentBoxStyles;
      if (!document.getElementById("content-styles")) {
        shadowRoot.appendChild(contentStyleTag);
      }

      popupRoot.style.position = "absolute";
      popupRoot.style.top = `${y}px`;
      popupRoot.style.left = `${x}px`;
      popupRoot.style.zIndex = "9999999";

      const reactContainer = document.createElement("div");
      reactContainer.id = "popup-react-container";
      reactContainer.classList =
        "w-[18em] [box-shadow:0px_0px_3px_2px_wheat] rounded-md rounded-tl-none";
      shadowRoot.appendChild(reactContainer);

      document.body.appendChild(popupRoot);

      reactRoot = createRoot(reactContainer);
      reactRoot.render(
        <CurrencyConvertorPopupBox number={selectedText} currency={"EUR"} />,
      );
    }

    document.addEventListener("mouseup", (e) => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length > 0) {
        const range = selection!.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Position popup above the selection
        const x = rect.left + rect.width;
        const y = rect.top + rect.height + window.scrollY;

        console.log("selectedText", text);
        // if (!Number.isNaN(Number(selectedText))) {
        //   return;
        // }
        showPopup(x, y, text);
      } else {
        removePopup();
      }
    });

    // Remove popup when clicking outside
    document.addEventListener("mousedown", (e) => {
      if (popupRoot && !popupRoot.contains(e.target as Node)) {
        const selection = window.getSelection();
        if (!selection?.toString().trim()) {
          removePopup();
        }
      }
    });
  },
});
