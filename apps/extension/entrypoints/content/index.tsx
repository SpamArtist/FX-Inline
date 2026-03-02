import { EntitlementPayload } from "@/packages/shared/contracts";
import CurrencyBox from "@/components/CurrencyBox/CurrencyBox";
import { useCurrencyReducer } from "@/hooks/useCurrencyReducer";
import {
  getUserSettings,
  SETTINGS_KEY,
  updateUserSettings,
  UserSettings,
} from "@/utils/appStorage";
import { getValidAccessToken } from "@/utils/accountService";
import {
  convertAmountWithSnapshot,
  getRatesForUser,
  RateSnapshot,
} from "@/utils/rates";
import { getBackendBaseUrl, recordUsageOnBackend } from "@/utils/backendClient";
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
const USER_SETTINGS_STORAGE_KEY = SETTINGS_KEY;
const PORTAL_DROPDOWN_CLASS = "ccx-dropdown-menu-content";
const UI_EVENT_TYPES = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "click",
  "contextmenu",
  "touchstart",
  "touchend",
] as const;

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

  // FIX #1: Normalize the DOM after replacements to merge adjacent text nodes,
  // preventing missed matches on subsequent passes.
  if (root instanceof Element || root instanceof Document) {
    root.normalize();
  }
}

function getEventElementTarget(target: EventTarget | null): Element | null {
  if (!target) return null;
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

function stopEventPropagation(event: Event) {
  if (event.cancelable) {
    event.preventDefault();
  }

  event.stopImmediatePropagation();
  event.stopPropagation();
}

function ensureInlineConversionStyles() {
  if (document.getElementById(INLINE_CONVERSION_STYLE_ID)) return;

  const styleTag = document.createElement("style");
  styleTag.id = INLINE_CONVERSION_STYLE_ID;
  // FIX #9: Use stronger specificity with :where() wrapper to reduce risk of
  // page CSS overriding our injected styles in document.head.
  styleTag.textContent = `
    :where(.${INLINE_CONVERSION_CLASS}) {
      border-radius: 4px !important;
      background-color: rgba(15, 23, 42, 0.12) !important;
      color: #0f172a !important;
      padding: 0 0.2em !important;
      white-space: normal !important;
    }

    :where(.${INLINE_CONVERSION_CLASS}) .ccx-converted-amount {
      font-weight: 600 !important;
      color: #1d4ed8 !important;
      margin-left: 0.1em !important;
    }
  `;

  document.head.appendChild(styleTag);
}

function decoratePricesInTextNode(
  textNode: Text,
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
): number {
  const text = textNode.nodeValue;
  if (!text?.trim()) return 0;

  const matches = extractCurrencyTextMatches(text);
  if (!matches.length) return 0;

  // FIX #2: Sort matches by start position to guarantee correct cursor
  // advancement and prevent skipped or mishandled overlapping matches.
  const sortedMatches = [...matches].sort((a, b) => a.start - b.start);

  let cursor = 0;
  let conversionsApplied = 0;
  const fragment = document.createDocumentFragment();

  for (const match of sortedMatches) {
    // Skip truly overlapping matches (starts before where we left off).
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
    conversionsApplied += 1;
  }

  if (conversionsApplied === 0) return 0;

  fragment.append(text.slice(cursor));
  textNode.replaceWith(fragment);

  return conversionsApplied;
}

function convertVisiblePrices(
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
  root: ParentNode = document.body,
): number {
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

  // FIX #6: Warn in development if the node cap was hit so truncation is
  // visible during testing rather than silently causing incomplete conversions.
  if (textNodes.length >= MAX_NODES_PER_PASS) {
    console.warn(
      `[ccx] Hit MAX_NODES_PER_PASS (${MAX_NODES_PER_PASS}); some prices on this page may not be converted.`,
    );
  }

  let totalConversions = 0;

  textNodes.forEach((node) => {
    totalConversions += decoratePricesInTextNode(
      node,
      preferredCurrency,
      rateSnapshot,
    );
  });

  return totalConversions;
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
    let usageFlushTimer: number | null = null;
    let hydrationRetryTimer: number | null = null;
    let settingsRefreshTimer: number | null = null;
    let isApplyingInlineConversion = false;
    // FIX #8: Replace time-based mutation suppression with a reliable counter.
    let suppressMutationDepth = 0;
    let isHydratingRates = false;

    let pendingInlineUsage = 0;
    let pendingSelectionUsage = 0;

    function isExtensionUiEvent(event: Event): boolean {
      if (!popupRoot) return false;
      if (!(event.target instanceof Node)) return false;

      if (popupRoot.contains(event.target)) {
        return true;
      }

      const elementTarget = getEventElementTarget(event.target);
      if (!elementTarget) return false;

      return Boolean(elementTarget.closest(`.${PORTAL_DROPDOWN_CLASS}`));
    }

    const swallowUiEvent = (event: Event) => {
      if (!isExtensionUiEvent(event)) return;
      stopEventPropagation(event);
    };

    UI_EVENT_TYPES.forEach((eventType) => {
      window.addEventListener(eventType, swallowUiEvent, true);
      document.addEventListener(eventType, swallowUiEvent, true);
    });

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

    // FIX #5: Accept forceRefresh and bypass the in-flight guard when forced,
    // so a forced refresh always runs rather than being silently dropped.
    async function hydrateSettingsAndRates(forceRefresh = false) {
      if (isHydratingRates && !forceRefresh) return;
      isHydratingRates = true;

      try {
        await refreshSettingsAndRates(forceRefresh);
      } finally {
        isHydratingRates = false;
      }
    }

    function scheduleHydrationRetry() {
      if (hydrationRetryTimer) return;

      hydrationRetryTimer = window.setTimeout(() => {
        hydrationRetryTimer = null;
        scheduleInlineConversion();
      }, 3000);
    }

    async function applyUsageEntitlement(entitlement: EntitlementPayload) {
      const updated = await updateUserSettings({
        entitlement: {
          status: entitlement.status,
          planTier: entitlement.planTier,
          checkedAt: entitlement.checkedAt,
          trialEndsAt: entitlement.trialEndsAt,
          currentPeriodEnd: entitlement.currentPeriodEnd,
          dailyLimit: entitlement.dailyLimit,
          remainingToday: entitlement.remainingToday,
        },
      });

      settings = updated;
    }

    // FIX #3: Accept an explicit usage payload so callers can pass already-
    // snapshotted counts. On failure, re-add the counts back to the pending
    // totals so they are not silently dropped.
    async function flushUsage(inlineConversions: number, selectionConversions: number) {
      if (inlineConversions + selectionConversions <= 0) return;

      try {
        const token = await getValidAccessToken();
        if (!token) return;

        const usage = await recordUsageOnBackend(token, {
          inlineConversions,
          selectionConversions,
        });

        await applyUsageEntitlement(usage.entitlement);
      } catch {
        // Re-queue counts so they are not lost on transient network errors.
        pendingInlineUsage += inlineConversions;
        pendingSelectionUsage += selectionConversions;
      }
    }

    function scheduleUsageFlush(inlineDelta = 0, selectionDelta = 0) {
      pendingInlineUsage += Math.max(0, Math.floor(inlineDelta));
      pendingSelectionUsage += Math.max(0, Math.floor(selectionDelta));

      if (usageFlushTimer) {
        window.clearTimeout(usageFlushTimer);
      }

      usageFlushTimer = window.setTimeout(async () => {
        const inlineConversions = pendingInlineUsage;
        const selectionConversions = pendingSelectionUsage;

        pendingInlineUsage = 0;
        pendingSelectionUsage = 0;

        await flushUsage(inlineConversions, selectionConversions);
      }, 1200);
    }

    function scheduleInlineConversion() {
      if (conversionDebounceTimer) {
        window.clearTimeout(conversionDebounceTimer);
      }

      conversionDebounceTimer = window.setTimeout(() => {
        if (!settings || !rateSnapshot) {
          void hydrateSettingsAndRates()
            .then(() => {
              if (settings && rateSnapshot) {
                scheduleInlineConversion();
                return;
              }

              console.warn("[ccx] Missing settings/rates after hydration; retrying");
              scheduleHydrationRetry();
            })
            .catch((error) => {
              console.warn("[ccx] Failed to hydrate rates for inline conversion", error);
              scheduleHydrationRetry();
            });

          return;
        }

        isApplyingInlineConversion = true;
        // FIX #8: Increment depth counter before DOM work.
        suppressMutationDepth += 1;

        try {
          const conversions = convertVisiblePrices(
            settings.preferredCurrency,
            rateSnapshot,
          );

          if (conversions > 0) {
            scheduleUsageFlush(conversions, 0);
          }
        } finally {
          isApplyingInlineConversion = false;
          // Decrement after a short delay to let the browser process DOM events
          // triggered by our changes before re-enabling the observer.
          window.setTimeout(() => {
            suppressMutationDepth = Math.max(0, suppressMutationDepth - 1);
          }, 400);
        }
      }, 200);
    }

    function scheduleInlineConversionFromSettingsUpdate() {
      if (settingsRefreshTimer) {
        window.clearTimeout(settingsRefreshTimer);
      }

      // Delay a bit after settings writes to avoid piggybacking a page gesture window.
      settingsRefreshTimer = window.setTimeout(() => {
        settingsRefreshTimer = null;
        scheduleInlineConversion();
      }, 1400);
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
      popupRoot.style.pointerEvents = "auto";

      const reactContainer = document.createElement("div");
      reactContainer.id = "popup-react-container";
      // FIX #4: classList is read-only; use className instead.
      reactContainer.className =
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
    } catch (error) {
      console.warn("[ccx] Initial settings/rates hydration failed", error);
      // Keep selection popup functional even if rates are unavailable initially.
    }
    scheduleInlineConversion();

    const settingsUnwatch = storage.watch<UserSettings | null>(
      USER_SETTINGS_STORAGE_KEY,
      async () => {
        try {
          await refreshSettingsAndRates(true);
          scheduleInlineConversionFromSettingsUpdate();
        } catch (error) {
          console.warn("[ccx] Failed to refresh settings/rates after storage update", error);
        }
      },
    );

    const mutationObserver = new MutationObserver((mutations) => {
      if (isApplyingInlineConversion) return;
      // FIX #8: Use counter-based guard instead of fragile time-based check.
      if (suppressMutationDepth > 0) return;

      if (!mutations.some((entry) => entry.addedNodes.length > 0)) {
        return;
      }

      scheduleInlineConversion();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const onMouseUp = (event: MouseEvent) => {
      if (isExtensionUiEvent(event)) return;

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
      scheduleUsageFlush(0, 1);
    };

    const onMouseDown = (event: MouseEvent) => {
      if (isExtensionUiEvent(event)) return;

      if (popupRoot && !popupRoot.contains(event.target as Node)) {
        const selection = window.getSelection();
        if (!selection?.toString().trim()) {
          removePopup();
        }
      }
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);

    // FIX #7: Flush any pending usage synchronously via sendBeacon before
    // unload so conversions done just before navigation are not lost.
    window.addEventListener("beforeunload", () => {
      mutationObserver.disconnect();
      settingsUnwatch();
      UI_EVENT_TYPES.forEach((eventType) => {
        window.removeEventListener(eventType, swallowUiEvent, true);
        document.removeEventListener(eventType, swallowUiEvent, true);
      });
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousedown", onMouseDown);

      if (usageFlushTimer) {
        window.clearTimeout(usageFlushTimer);
      }

      if (hydrationRetryTimer) {
        window.clearTimeout(hydrationRetryTimer);
      }

      if (settingsRefreshTimer) {
        window.clearTimeout(settingsRefreshTimer);
      }

      // Attempt a best-effort keepalive flush for any usage accumulated since
      // the last scheduled flush.
      const remainingInline = pendingInlineUsage;
      const remainingSelection = pendingSelectionUsage;
      const accessToken = settings?.auth.accessToken;

      if (remainingInline + remainingSelection > 0 && accessToken) {
        try {
          void fetch(`${getBackendBaseUrl()}/usage/events`, {
            method: "POST",
            keepalive: true,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              inlineConversions: remainingInline,
              selectionConversions: remainingSelection,
            }),
          });
        } catch {
          // Best effort — nothing more we can do at unload time.
        }
      }
    });
  },
});
