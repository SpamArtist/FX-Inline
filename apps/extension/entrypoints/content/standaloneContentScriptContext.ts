import type { ContentScriptLifecycleContext } from "./content.types";

export function createStandaloneContentScriptContext(): ContentScriptLifecycleContext {
  const invalidationCallbacks = new Set<() => void>();
  const removeEventListeners = new Set<() => void>();
  let isInvalid = false;

  function invalidate() {
    if (isInvalid) return;
    isInvalid = true;

    for (const removeEventListener of removeEventListeners) {
      removeEventListener();
    }
    removeEventListeners.clear();

    for (const callback of invalidationCallbacks) {
      callback();
    }
    invalidationCallbacks.clear();
  }

  window.addEventListener("beforeunload", invalidate, { once: true });

  return {
    get isInvalid() {
      return isInvalid;
    },
    addEventListener: (target, type, listener, options) => {
      target.addEventListener(type, listener, options);
      removeEventListeners.add(() => {
        target.removeEventListener(type, listener, options);
      });
    },
    onInvalidated: (cleanup) => {
      if (isInvalid) {
        cleanup();
        return;
      }

      invalidationCallbacks.add(cleanup);
    },
  };
}
