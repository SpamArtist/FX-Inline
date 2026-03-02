import { SETTINGS_KEY } from "@/utils/appStorage";
import { getBackendBaseUrl } from "@/utils/backendClient";
import { CurrencyCode } from "@/utils/enums";
import { collectMutationConversionRoots } from "@/utils/mutationRoots";
import { parseCurrencyValue } from "@/utils/utils";
import { storage } from "wxt/utils/storage";
import { createContentConversionRuntime } from "./conversionRuntime";
import { createSelectionPopupController } from "./selectionPopup";
import contentBoxStyles from "./content.css?inline";

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

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "manual",
  async main() {
    const popupController = createSelectionPopupController(contentBoxStyles);
    const conversionRuntime = createContentConversionRuntime();
    const usageEventsUrl = `${getBackendBaseUrl()}/usage/events`;

    function isExtensionUiEvent(event: Event): boolean {
      if (!(event.target instanceof Node)) return false;

      if (popupController.containsTarget(event.target)) {
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

    await conversionRuntime.initialize();

    const settingsUnwatch = storage.watch(
      USER_SETTINGS_STORAGE_KEY,
      conversionRuntime.onSettingsStorageUpdate,
    );

    const mutationObserver = new MutationObserver((mutations) => {
      if (conversionRuntime.shouldIgnoreMutations()) return;

      const roots = collectMutationConversionRoots(mutations, popupController.getRoot());
      if (!roots.length) return;

      conversionRuntime.enqueueMutationRoots(roots);
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
        popupController.removePopup();
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      const x = rect.left + window.scrollX;
      const y = rect.top + rect.height + window.scrollY;

      const { valid: isValid, value, currency } = parseCurrencyValue(text, {
        localeHint: document.documentElement?.lang || null,
      });
      if (!isValid || value === undefined) {
        popupController.removePopup();
        return;
      }

      const sourceCurrency = currency ?? CurrencyCode["UNITED STATES DOLLAR"];
      popupController.showPopup(x, y, value.toString(), sourceCurrency);
      conversionRuntime.recordSelectionConversion();
    };

    const onMouseDown = (event: MouseEvent) => {
      if (isExtensionUiEvent(event)) return;

      const popupRoot = popupController.getRoot();
      if (popupRoot && !popupController.containsTarget(event.target as Node)) {
        const selection = window.getSelection();
        if (!selection?.toString().trim()) {
          popupController.removePopup();
        }
      }
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);

    window.addEventListener("beforeunload", () => {
      mutationObserver.disconnect();
      settingsUnwatch();
      popupController.destroy();
      conversionRuntime.cleanup();
      UI_EVENT_TYPES.forEach((eventType) => {
        window.removeEventListener(eventType, swallowUiEvent, true);
        document.removeEventListener(eventType, swallowUiEvent, true);
      });
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousedown", onMouseDown);

      // Best-effort usage flush that survives navigation.
      const { inlineConversions, selectionConversions } =
        conversionRuntime.getPendingUsageSnapshot();
      const accessToken = conversionRuntime.getAccessTokenForUsage();

      if (inlineConversions + selectionConversions > 0 && accessToken) {
        try {
          void fetch(usageEventsUrl, {
            method: "POST",
            keepalive: true,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              inlineConversions,
              selectionConversions,
            }),
          });
        } catch {
          // Best effort — nothing more we can do at unload time.
        }
      }
    });
  },
});
