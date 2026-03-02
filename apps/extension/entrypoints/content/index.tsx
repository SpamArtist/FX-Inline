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
import { collectMutationConversionRoots } from "@/utils/mutationRoots";
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

  // Merge adjacent text nodes after replacements so later passes parse correctly.
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

function parseRgbChannels(input: string): [number, number, number] | null {
  const matched = input.match(
    /rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,\/]+[\d.]+)?\s*\)/i,
  );
  if (!matched) return null;

  const r = Number(matched[1]);
  const g = Number(matched[2]);
  const b = Number(matched[3]);

  if (![r, g, b].every((value) => Number.isFinite(value) && value >= 0 && value <= 255)) {
    return null;
  }

  return [r, g, b];
}

function toLinearRgb(channel: number): number {
  const normalized = channel / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }

  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * toLinearRgb(r) + 0.7152 * toLinearRgb(g) + 0.0722 * toLinearRgb(b);
}

function usesLightTextColor(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return false;

  const color = window.getComputedStyle(parent).color;
  const rgb = parseRgbChannels(color);
  if (!rgb) return false;

  return relativeLuminance(rgb) >= 0.6;
}

function ensureInlineConversionStyles() {
  let styleTag = document.getElementById(INLINE_CONVERSION_STYLE_ID) as
    | HTMLStyleElement
    | null;

  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = INLINE_CONVERSION_STYLE_ID;
    document.head.appendChild(styleTag);
  }

  styleTag.textContent = `
    :where(.${INLINE_CONVERSION_CLASS}) {
      border-radius: 0 !important;
      background-color: transparent !important;
      color: inherit !important;
      padding: 0 !important;
      white-space: normal !important;
    }

    :where(.${INLINE_CONVERSION_CLASS}) .ccx-converted-amount {
      font-weight: 600 !important;
      color: var(--ccx-converted-color, currentColor) !important;
      background-color: transparent !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      padding: 0 !important;
      margin-left: 0.1em !important;
    }
  `;
}

function decoratePricesInTextNode(
  textNode: Text,
  preferredCurrency: CurrencyCode,
  rateSnapshot: RateSnapshot,
): number {
  const text = textNode.nodeValue;
  if (!text?.trim()) return 0;
  const lightTextContext = usesLightTextColor(textNode);

  const matches = extractCurrencyTextMatches(text);
  if (!matches.length) return 0;

  // Keep a stable left-to-right order before cursor-based replacement.
  const sortedMatches = [...matches].sort((a, b) => a.start - b.start);

  let cursor = 0;
  let conversionsApplied = 0;
  const fragment = document.createDocumentFragment();

  for (const match of sortedMatches) {
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
    if (lightTextContext) {
      wrapper.style.setProperty("--ccx-converted-color", "#93c5fd");
    } else {
      wrapper.style.setProperty("--ccx-converted-color", "#355aa8");
    }

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
  options?: {
    clearExisting?: boolean;
    maxNodesPerPass?: number;
  },
): number {
  ensureInlineConversionStyles();
  if (options?.clearExisting !== false) {
    clearInlineConversions(root);
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  const textNodes: Text[] = [];
  const maxNodesPerPass = options?.maxNodesPerPass ?? 15000;

  while (walker.nextNode() && textNodes.length < maxNodesPerPass) {
    const textNode = walker.currentNode as Text;
    if (shouldSkipTextNode(textNode)) continue;
    textNodes.push(textNode);
  }

  if (import.meta.env.DEV && textNodes.length >= maxNodesPerPass) {
    console.warn(
      `[ccx] Hit MAX_NODES_PER_PASS (${maxNodesPerPass}); some prices on this page may not be converted.`,
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
    let reactRoot: Root | null = null;

    let settings: UserSettings | null = null;
    let rateSnapshot: RateSnapshot | null = null;

    let conversionDebounceTimer: number | null = null;
    let partialConversionTimer: number | null = null;
    let usageFlushTimer: number | null = null;
    let hydrationRetryTimer: number | null = null;
    let settingsRefreshTimer: number | null = null;
    let isApplyingInlineConversion = false;
    let suppressMutationDepth = 0;
    let isHydratingRates = false;

    let pendingInlineUsage = 0;
    let pendingSelectionUsage = 0;
    const usageEventsUrl = `${getBackendBaseUrl()}/usage/events`;
    const pendingMutationRoots = new Set<ParentNode>();

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
        reactRoot = null;
      }
    }

    async function refreshSettingsAndRates(forceRefresh = false) {
      settings = await getUserSettings();
      rateSnapshot = await getRatesForUser(settings, { forceRefresh });
    }

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
          window.setTimeout(() => {
            suppressMutationDepth = Math.max(0, suppressMutationDepth - 1);
          }, 400);
        }
      }, 200);
    }

    function schedulePartialInlineConversion() {
      if (partialConversionTimer) {
        window.clearTimeout(partialConversionTimer);
      }

      partialConversionTimer = window.setTimeout(() => {
        partialConversionTimer = null;

        if (!pendingMutationRoots.size) return;

        if (!settings || !rateSnapshot) {
          pendingMutationRoots.clear();
          scheduleInlineConversion();
          return;
        }

        const roots = Array.from(pendingMutationRoots);
        pendingMutationRoots.clear();

        isApplyingInlineConversion = true;
        suppressMutationDepth += 1;

        try {
          let conversions = 0;

          for (const root of roots) {
            if (!(root instanceof Node) || !root.isConnected) continue;

            conversions += convertVisiblePrices(
              settings.preferredCurrency,
              rateSnapshot,
              root,
              {
                clearExisting: false,
                maxNodesPerPass: 4000,
              },
            );
          }

          if (conversions > 0) {
            scheduleUsageFlush(conversions, 0);
          }
        } finally {
          isApplyingInlineConversion = false;
          window.setTimeout(() => {
            suppressMutationDepth = Math.max(0, suppressMutationDepth - 1);
          }, 400);
        }
      }, 120);
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

      const shadowRoot = popupRoot.attachShadow({
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
      if (suppressMutationDepth > 0) return;

      const roots = collectMutationConversionRoots(mutations, popupRoot);
      if (!roots.length) return;

      for (const root of roots) {
        pendingMutationRoots.add(root);
      }

      schedulePartialInlineConversion();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
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

      if (partialConversionTimer) {
        window.clearTimeout(partialConversionTimer);
      }

      if (hydrationRetryTimer) {
        window.clearTimeout(hydrationRetryTimer);
      }

      if (settingsRefreshTimer) {
        window.clearTimeout(settingsRefreshTimer);
      }

      // Best-effort usage flush that survives navigation.
      const remainingInline = pendingInlineUsage;
      const remainingSelection = pendingSelectionUsage;
      const accessToken = settings?.auth.accessToken;

      if (remainingInline + remainingSelection > 0 && accessToken) {
        try {
          void fetch(usageEventsUrl, {
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
