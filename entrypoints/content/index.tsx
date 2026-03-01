import CurrencyBox from "@/components/CurrencyBox/CurrencyBox";
import { useCurrencyReducer } from "@/hooks/useCurrencyReducer";
import { getUserSettings, UserSettings } from "@/utils/appStorage";
import {
  convertAmountWithSnapshot,
  getRatesForUser,
  RateSnapshot,
} from "@/utils/rates";
import {
  extractCurrencyTextMatches,
  formatAmountInCurrency,
  parseCurrencyValue,
} from "@/utils/utils";
import { ActionType, CurrencyCode } from "@/utils/enums";
import { storage } from "wxt/utils/storage";
import { createRoot, Root } from "react-dom/client";
import { ConvertorHOD } from "../../components/Convertor/Convertor";
import contentBoxStyles from "./content.css?inline";

const INLINE_CONVERSION_CLASS = "ccx-inline-conversion";
const INLINE_CONVERSION_STYLE_ID = "ccx-inline-conversion-style";
const USER_SETTINGS_STORAGE_KEY = "local:user-settings";

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
  "BUTTON",
  "CODE",
  "PRE",
  "SVG",
]);

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;

  if (!parent) return true;
  if (SKIP_TAGS.has(parent.tagName)) return true;
  if (parent.closest(`.${INLINE_CONVERSION_CLASS}`)) return true;

  return false;
}

function clearInlineConversions(root: ParentNode = document.body) {
  const convertedNodes = root.querySelectorAll(`span.${INLINE_CONVERSION_CLASS}`);

  convertedNodes.forEach((node) => {
    const originalText = node.getAttribute("data-original") || node.textContent || "";
    node.replaceWith(document.createTextNode(originalText));
  });
}

function ensureInlineConversionStyles() {
  if (document.getElementById(INLINE_CONVERSION_STYLE_ID)) return;

  const styleTag = document.createElement("style");
  styleTag.id = INLINE_CONVERSION_STYLE_ID;
  styleTag.textContent = `
    .${INLINE_CONVERSION_CLASS} {
      border-radius: 4px;
      background-color: rgba(15, 23, 42, 0.12);
      color: #0f172a;
      padding: 0 0.2em;
      white-space: normal;
    }

    .${INLINE_CONVERSION_CLASS} .ccx-converted-amount {
      font-weight: 600;
      color: #1d4ed8;
      margin-left: 0.1em;
    }
  `;

  document.head.appendChild(styleTag);
}

function decoratePricesInTextNode(
  textNode: Text,
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
): boolean {
  const text = textNode.nodeValue;
  if (!text?.trim()) return false;

  const matches = extractCurrencyTextMatches(text);
  if (!matches.length) return false;

  let cursor = 0;
  let changed = false;
  const fragment = document.createDocumentFragment();

  for (const match of matches) {
    if (match.start < cursor) continue;

    fragment.append(text.slice(cursor, match.start));

    if (match.currency === preferredCurrency) {
      fragment.append(match.raw);
      cursor = match.end;
      continue;
    }

    const converted = convertAmountWithSnapshot(
      match.value,
      match.currency,
      preferredCurrency,
      rateSnapshot,
    );

    if (converted === null) {
      fragment.append(match.raw);
      cursor = match.end;
      continue;
    }

    const wrapper = document.createElement("span");
    wrapper.className = INLINE_CONVERSION_CLASS;
    wrapper.setAttribute("data-original", match.raw);

    const convertedAmount = formatAmountInCurrency(converted, preferredCurrency);
    wrapper.textContent = `${match.raw} (`;

    const convertedValueNode = document.createElement("span");
    convertedValueNode.className = "ccx-converted-amount";
    convertedValueNode.textContent = convertedAmount;

    wrapper.appendChild(convertedValueNode);
    wrapper.append(")");

    fragment.append(wrapper);
    cursor = match.end;
    changed = true;
  }

  if (!changed) return false;

  fragment.append(text.slice(cursor));
  textNode.replaceWith(fragment);

  return true;
}

function convertVisiblePrices(
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
  root: ParentNode = document.body,
) {
  ensureInlineConversionStyles();
  clearInlineConversions(root);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  const textNodes: Text[] = [];
  const MAX_NODES_PER_PASS = 1200;

  while (walker.nextNode() && textNodes.length < MAX_NODES_PER_PASS) {
    const textNode = walker.currentNode as Text;
    if (shouldSkipTextNode(textNode)) continue;
    textNodes.push(textNode);
  }

  textNodes.forEach((node) => {
    decoratePricesInTextNode(node, preferredCurrency, rateSnapshot);
  });
}

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "manual",
  async main() {
    let popupRoot: HTMLDivElement | null = null;
    let shadowRoot: ShadowRoot | null = null;
    let reactRoot: Root | null = null;

    let settings: UserSettings | null = null;
    let rateSnapshot: RateSnapshot | null = null;

    let conversionDebounceTimer: number | null = null;
    let isApplyingInlineConversion = false;
    let suppressMutationsUntil = 0;

    function removePopup() {
      if (popupRoot && document.body.contains(popupRoot)) {
        reactRoot?.unmount();
        document.body.removeChild(popupRoot);
        popupRoot = null;
        shadowRoot = null;
        reactRoot = null;
      }
    }

    async function refreshSettingsAndRates(forceRefresh = false) {
      settings = await getUserSettings();
      rateSnapshot = await getRatesForUser(settings, { forceRefresh });
    }

    function scheduleInlineConversion() {
      if (conversionDebounceTimer) {
        window.clearTimeout(conversionDebounceTimer);
      }

      conversionDebounceTimer = window.setTimeout(() => {
        if (!settings || !rateSnapshot) return;
        isApplyingInlineConversion = true;

        try {
          convertVisiblePrices(settings.preferredCurrency, rateSnapshot);
        } finally {
          isApplyingInlineConversion = false;
          suppressMutationsUntil = Date.now() + 400;
        }
      }, 200);
    }

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

    function showPopup(
      x: number,
      y: number,
      amount: string,
      currency: CurrencyCode,
    ) {
      removePopup();

      popupRoot = document.createElement("div");
      popupRoot.id = "popup-root";

      shadowRoot = popupRoot.attachShadow({
        mode: "open",
      });

      const contentStyleTag = document.createElement("style");
      contentStyleTag.id = "content-styles";
      contentStyleTag.textContent = contentBoxStyles;
      shadowRoot.appendChild(contentStyleTag);

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
        <CurrencyConvertorPopupBox number={amount} currency={currency} />,
      );
    }

    try {
      await refreshSettingsAndRates();
      scheduleInlineConversion();
    } catch {
      // Keep selection popup functional even if rates are unavailable initially.
    }

    const settingsUnwatch = storage.watch<UserSettings | null>(
      USER_SETTINGS_STORAGE_KEY,
      async () => {
        try {
          await refreshSettingsAndRates(true);
          scheduleInlineConversion();
        } catch {
          // no-op
        }
      },
    );

    const mutationObserver = new MutationObserver((mutations) => {
      if (isApplyingInlineConversion) return;
      if (Date.now() < suppressMutationsUntil) return;

      if (!mutations.some((entry) => entry.addedNodes.length > 0)) {
        return;
      }

      scheduleInlineConversion();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    document.addEventListener("mouseup", (event) => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (!text?.length || !selection?.rangeCount) {
        removePopup();
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      const x = rect.left + window.scrollX;
      const y = rect.top + rect.height + window.scrollY;

      const { valid: isValid, value, currency } = parseCurrencyValue(text);
      if (!isValid || value === undefined) {
        removePopup();
        return;
      }

      const sourceCurrency = currency ?? CurrencyCode["UNITED STATES DOLLAR"];
      showPopup(x, y, value.toString(), sourceCurrency);
    });

    document.addEventListener("mousedown", (event) => {
      if (popupRoot && !popupRoot.contains(event.target as Node)) {
        const selection = window.getSelection();
        if (!selection?.toString().trim()) {
          removePopup();
        }
      }
    });

    window.addEventListener("beforeunload", () => {
      mutationObserver.disconnect();
      settingsUnwatch();
    });
  },
});
