import CurrencyBox from "@/components/CurrencyBox/CurrencyBox";
import { useCurrencyReducer } from "@/hooks/useCurrencyReducer";
import { createRoot, Root } from "react-dom/client";
import { ConvertorHOD } from "../../components/Convertor/Convertor";
import contentBoxStyles from './content.css?inline';

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "manual",
  async main(ctx) {
    console.log('here');

    let popupRoot: HTMLDivElement | null = null;
    let reactRoot: Root | null = null;

    const contentStyleTag = document.createElement('style');
    contentStyleTag.id = 'content-styles';
    contentStyleTag.textContent = contentBoxStyles;
    if (!document.getElementById('content-styles')) {
      document.head.appendChild(contentStyleTag);
    }

    function removePopup() {
      if (popupRoot && document.body.contains(popupRoot)) {
        reactRoot?.unmount();
        document.body.removeChild(popupRoot);
        popupRoot = null;
        reactRoot = null;
      }
    }

    function PopupCurrencies() {
      const [currencies, dispatch] = useCurrencyReducer();

      return (
        <ConvertorHOD>
          {currencies.map((currentCurrency) => (
            <div key={currentCurrency.id} className='relative flex flex-col items-center w-72.5'>
              <CurrencyBox
                key={currentCurrency.id}
                data={currentCurrency}
                amountChange={(updatedAmount) => dispatch({
                  type: 'amount-update',
                  payload: { id: currentCurrency.id, amount: updatedAmount },
                })}
                currencyChange={(updatedCurrency) => dispatch({
                  type: 'currency-update',
                  payload: { id: currentCurrency.id, currencyCode: updatedCurrency }
                })}
              />
            </div>
          ))}
        </ConvertorHOD>
      )
    }

    function showPopup(x: number, y: number, selectedText: string) {
      removePopup();

      popupRoot = document.createElement('div');
      popupRoot.id = 'popup-root';
      popupRoot.style.position = 'absolute';
      popupRoot.style.top = `${y}px`;
      popupRoot.style.left = `${x}px`;
      popupRoot.style.zIndex = '999999999999';

      document.body.appendChild(popupRoot);

      reactRoot = createRoot(popupRoot);
      reactRoot.render((
        <PopupCurrencies />
      ));
    }

    document.addEventListener("mouseup", (e) => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length > 0) {
        const range = selection!.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Position popup above the selection
        const x = rect.left + rect.width / 2;
        const y = rect.top + window.scrollY - 10;

        showPopup(x, y, text);
      } else {
        // removePopup();
      }
    });

    // Remove popup when clicking outside
    document.addEventListener("mousedown", (e) => {
      if (popupRoot && !popupRoot.contains(e.target as Node)) {
        const selection = window.getSelection();
        if (!selection?.toString().trim()) {
          // removePopup();
        }
      }
    });
  },
});
