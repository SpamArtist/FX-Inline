import { SETTINGS_KEY } from "@/utils/appStorage";
import { DEFAULT_STARTING_CURRENCY } from "@/utils/constants";
import { collectMutationConversionRoots } from "@/utils/mutationRoots";
import { parseCurrencyValue } from "@/utils/utils";
import { storage } from "wxt/utils/storage";
import { createContentConversionRuntime } from "./conversionRuntime";
import {
  type ContentScriptLifecycleContext,
  type ContentWorkerStartOptions,
} from "./content.types";
import { createMutationRootBatcher } from "./mutationBatcher";
import { createLazySelectionPopupControllerLoader } from "./selectionPopupLoader";

const USER_SETTINGS_STORAGE_KEY = SETTINGS_KEY;
const PORTAL_DROPDOWN_CLASS = "fx-inline-dropdown-menu-content";
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

function isExtensionContextInvalidatedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /extension context invalidated/i.test(error.message)
  );
}

export async function startContentWorker(
  ctx: ContentScriptLifecycleContext,
  options: ContentWorkerStartOptions = {},
): Promise<void> {
  const popupControllerLoader = createLazySelectionPopupControllerLoader();
  const conversionRuntime = createContentConversionRuntime();
  let uiCaptureActive = false;
  let isCleanedUp = false;
  let settingsUnwatch: (() => void) | null = null;

  function isExtensionUiEvent(event: Event): boolean {
    if (!(event.target instanceof Node)) return false;
    const popupController = popupControllerLoader.getSync();

    if (popupController?.containsTarget(event.target)) {
      return true;
    }

    const elementTarget = getEventElementTarget(event.target);
    if (!elementTarget) return false;

    return Boolean(elementTarget.closest(`.${PORTAL_DROPDOWN_CLASS}`));
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

    for (const eventType of UI_CAPTURE_EVENT_TYPES) {
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

  const mutationBatcher = createMutationRootBatcher({
    shouldIgnoreMutations: conversionRuntime.shouldIgnoreMutations,
    collectRoots: (mutations) =>
      collectMutationConversionRoots(
        mutations,
        popupControllerLoader.getSync()?.getRoot() ?? null,
      ),
    enqueueRoots: conversionRuntime.enqueueMutationRoots,
  });

  const mutationObserver = new MutationObserver((mutations) => {
    mutationBatcher.push(mutations);
  });

  function cleanup() {
    if (isCleanedUp) return;
    isCleanedUp = true;

    mutationObserver.disconnect();
    mutationBatcher.cancel();
    if (settingsUnwatch) {
      try {
        settingsUnwatch();
      } catch (error) {
        if (!isExtensionContextInvalidatedError(error)) {
          console.warn("[fx-inline] Failed to unwatch settings during cleanup", error);
        }
      } finally {
        settingsUnwatch = null;
      }
    }

    setUiCaptureActive(false);
    popupControllerLoader.getSync()?.destroy();
    conversionRuntime.cleanup();
  }

  ctx.onInvalidated(cleanup);

  try {
    await conversionRuntime.initialize();
  } catch (error) {
    if (ctx.isInvalid || isExtensionContextInvalidatedError(error)) {
      cleanup();
      return;
    }

    throw error;
  }

  if (ctx.isInvalid) {
    cleanup();
    return;
  }

  try {
    settingsUnwatch = storage.watch(
      USER_SETTINGS_STORAGE_KEY,
      conversionRuntime.onSettingsStorageUpdate,
    );
  } catch (error) {
    if (ctx.isInvalid || isExtensionContextInvalidatedError(error)) {
      cleanup();
      return;
    }

    throw error;
  }

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  async function showSelectionPopupFromCurrentSelection(): Promise<void> {
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
    if (ctx.isInvalid || isCleanedUp) return;
    popupController.showPopup(x, y, value.toString(), sourceCurrency);
    setUiCaptureActive(true);
    conversionRuntime.recordSelectionConversion();
  }

  async function handleMouseUp(event: MouseEvent): Promise<void> {
    if (ctx.isInvalid || isCleanedUp) return;
    if (isExtensionUiEvent(event)) return;

    await showSelectionPopupFromCurrentSelection();
  }

  const onMouseUp = (event: Event) => {
    if (!(event instanceof MouseEvent)) return;

    void handleMouseUp(event).catch((error) => {
      if (ctx.isInvalid || isExtensionContextInvalidatedError(error)) return;
      console.warn("[fx-inline] Failed to show selection popup", error);
    });
  };

  const onMouseDown = (event: Event) => {
    if (!(event instanceof MouseEvent)) return;
    if (ctx.isInvalid || isCleanedUp) return;
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

  ctx.addEventListener(document, "mouseup", onMouseUp);
  ctx.addEventListener(document, "mousedown", onMouseDown);
  ctx.addEventListener(window, "beforeunload", cleanup);

  if (options.showSelectionOnStart) {
    void showSelectionPopupFromCurrentSelection().catch((error) => {
      if (ctx.isInvalid || isExtensionContextInvalidatedError(error)) return;
      console.warn("[fx-inline] Failed to show startup selection popup", error);
    });
  }
}
