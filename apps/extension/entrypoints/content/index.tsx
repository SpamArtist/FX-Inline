import { SETTINGS_KEY } from "@/utils/appStorage";
import { DEFAULT_STARTING_CURRENCY } from "@/utils/constants";
import { collectMutationConversionRoots } from "@/utils/mutationRoots";
import { parseCurrencyValue } from "@/utils/utils";
import { storage } from "wxt/utils/storage";
import { createContentConversionRuntime } from "./conversionRuntime";
import { createSelectionPopupController } from "./selectionPopup";
import contentBoxStyles from "./content.css?inline";
import converterThemeStyles from "@/styles/converter-theme.css?inline";

const USER_SETTINGS_STORAGE_KEY = SETTINGS_KEY;
const PORTAL_DROPDOWN_CLASS = "ccx-dropdown-menu-content";
const UI_CAPTURE_EVENT_TYPES = [
  "pointerdown",
  "mousedown",
  "click",
  "contextmenu",
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
    const popupController = createSelectionPopupController(
      `${converterThemeStyles}\n${contentBoxStyles}`,
    );
    const conversionRuntime = createContentConversionRuntime();
    let uiCaptureActive = false;

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
      if (!popupController.getRoot()) return;
      if (!isExtensionUiEvent(event)) return;
      stopEventPropagation(event);
    };

    function setUiCaptureActive(next: boolean) {
      if (uiCaptureActive === next) return;
      uiCaptureActive = next;

      for (const eventType of UI_CAPTURE_EVENT_TYPES) {
        if (next) {
          document.addEventListener(eventType, swallowUiEvent, true);
        } else {
          document.removeEventListener(eventType, swallowUiEvent, true);
        }
      }
    }

    function removePopupAndCapture() {
      popupController.removePopup();
      setUiCaptureActive(false);
    }

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
        removePopupAndCapture();
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
        removePopupAndCapture();
        return;
      }

      const sourceCurrency = currency ?? DEFAULT_STARTING_CURRENCY;
      popupController.showPopup(x, y, value.toString(), sourceCurrency);
      setUiCaptureActive(true);
      conversionRuntime.recordSelectionConversion();
    };

    const onMouseDown = (event: MouseEvent) => {
      if (isExtensionUiEvent(event)) return;
      if (!(event.target instanceof Node)) return;

      const popupRoot = popupController.getRoot();
      if (popupRoot && !popupController.containsTarget(event.target)) {
        const selection = window.getSelection();
        if (!selection?.toString().trim()) {
          removePopupAndCapture();
        }
      }
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);

    window.addEventListener("beforeunload", () => {
      mutationObserver.disconnect();
      settingsUnwatch();
      setUiCaptureActive(false);
      popupController.destroy();
      conversionRuntime.cleanup();
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousedown", onMouseDown);
    });
  },
});
