import { SETTINGS_KEY } from "@/utils/appStorage";
import { DEFAULT_STARTING_CURRENCY } from "@/utils/constants";
import { collectMutationConversionRoots } from "@/utils/mutationRoots";
import { parseCurrencyValue } from "@/utils/utils";
import { storage } from "wxt/utils/storage";
import { createContentConversionRuntime } from "./conversionRuntime";
import { createLazySelectionPopupControllerLoader } from "./selectionPopupLoader";
import {
  CONTENT_UI_CAPTURE_EVENT_TYPES,
  hasContentRuntimeUiContractTarget,
} from "./uiContracts";

const USER_SETTINGS_STORAGE_KEY = SETTINGS_KEY;

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
    const popupControllerLoader = createLazySelectionPopupControllerLoader();
    const conversionRuntime = createContentConversionRuntime();
    let uiCaptureActive = false;

    function isExtensionUiEvent(event: Event): boolean {
      const popupController = popupControllerLoader.getSync();
      return hasContentRuntimeUiContractTarget({
        target: event.target,
        containsSelectionPopupTarget: (target) =>
          popupController?.containsTarget(target) ?? false,
      });
    }

    const swallowUiEvent = (event: Event) => {
      const popupController = popupControllerLoader.getSync();
      if (!popupController?.getRoot()) return;
      if (!isExtensionUiEvent(event)) return;
      stopEventPropagation(event);
    };

    function setUiCaptureActive(next: boolean) {
      if (uiCaptureActive === next) return;
      uiCaptureActive = next;

      for (const eventType of CONTENT_UI_CAPTURE_EVENT_TYPES) {
        if (next) {
          document.addEventListener(eventType, swallowUiEvent, true);
        } else {
          document.removeEventListener(eventType, swallowUiEvent, true);
        }
      }
    }

    function removePopupAndCapture() {
      popupControllerLoader.getSync()?.removePopup();
      setUiCaptureActive(false);
    }

    await conversionRuntime.initialize();

    const settingsUnwatch = storage.watch(
      USER_SETTINGS_STORAGE_KEY,
      conversionRuntime.onSettingsStorageUpdate,
    );

    const mutationObserver = new MutationObserver((mutations) => {
      if (conversionRuntime.shouldIgnoreMutations()) return;

      const roots = collectMutationConversionRoots(
        mutations,
        popupControllerLoader.getSync()?.getRoot() ?? null,
      );
      if (!roots.length) return;

      conversionRuntime.enqueueMutationRoots(roots);
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    async function handleMouseUp(event: MouseEvent): Promise<void> {
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
      const popupController = await popupControllerLoader.get();
      popupController.showPopup(x, y, value.toString(), sourceCurrency);
      setUiCaptureActive(true);
    }

    const onMouseUp = (event: MouseEvent) => {
      void handleMouseUp(event).catch((error) => {
        console.warn("[ccx] Failed to show selection popup", error);
      });
    };

    const onMouseDown = (event: MouseEvent) => {
      if (isExtensionUiEvent(event)) return;
      if (!(event.target instanceof Node)) return;

      const popupController = popupControllerLoader.getSync();
      const popupRoot = popupController?.getRoot() ?? null;
      if (popupRoot && popupController && !popupController.containsTarget(event.target)) {
        const selection = window.getSelection();
        if (!selection?.toString().trim()) {
          removePopupAndCapture();
        }
      }
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);

    const onBeforeUnload = () => {
      mutationObserver.disconnect();
      settingsUnwatch();
      setUiCaptureActive(false);
      popupControllerLoader.getSync()?.destroy();
      conversionRuntime.cleanup();
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
  },
});
