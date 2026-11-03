import { jest } from "@jest/globals";

const getUserSettingsMock = jest.fn();
const getCachedRateSnapshotMock = jest.fn();
const recordSelectionConversionMock = jest.fn();
let popupController;
let cleanupWorker;
const removeEventListeners = [];

async function importWorkerWithMocks() {
  jest.resetModules();

  await jest.unstable_mockModule("wxt/browser", () => ({
    browser: {
      i18n: { getUILanguage: () => "en-US", getMessage: () => "" },
    },
  }));
  await jest.unstable_mockModule("@/utils/appStorage", () => ({
    SETTINGS_KEY: "userSettings",
    getUserSettings: getUserSettingsMock,
  }));
  await jest.unstable_mockModule("@/utils/rates/cache", () => ({
    getCachedRateSnapshot: getCachedRateSnapshotMock,
  }));
  await jest.unstable_mockModule("@/utils/localStorage", () => ({
    watchLocalStorageValue: () => () => {},
  }));
  await jest.unstable_mockModule(
    "../../test-dist/entrypoints/content/conversionRuntime.js",
    () => ({
      createContentConversionRuntime: () => ({
        initialize: async () => {},
        onSettingsStorageUpdate: async () => {},
        enqueueMutationRoots: () => {},
        shouldIgnoreMutations: () => true,
        recordSelectionConversion: recordSelectionConversionMock,
        cleanup: () => {},
      }),
    }),
  );
  await jest.unstable_mockModule(
    "../../test-dist/entrypoints/content/selectionPopupLoader.js",
    () => ({
      createLazySelectionPopupControllerLoader: () => ({
        getSync: () => popupController ?? null,
        get: async () => {
          if (!popupController) {
            const { createSelectionPopupController } = await import(
              "../../test-dist/entrypoints/content/selectionPopup.js"
            );
            popupController = createSelectionPopupController("", "theme.css");
          }
          return popupController;
        },
      }),
    }),
  );

  return import("../../test-dist/entrypoints/content/contentWorker.js");
}

beforeEach(() => {
  jest.clearAllMocks();
  popupController = undefined;
  cleanupWorker = undefined;
  document.body.innerHTML = "";
  document.documentElement.lang = "zh-CN";
  getUserSettingsMock.mockResolvedValue({
    scopes: { allUrls: { targetCurrencies: ["INR"] } },
  });
  getCachedRateSnapshotMock.mockResolvedValue({
    base: "USD",
    fetchedAt: Date.now(),
    rates: { USD: 1, EUR: 0.9, CNY: 7, JPY: 140, INR: 84 },
  });
});

afterEach(() => {
  cleanupWorker?.();
  for (const remove of removeEventListeners.splice(0)) remove();
  jest.restoreAllMocks();
  document.body.innerHTML = "";
  document.documentElement.lang = "en";
});

test.each([
  ["RMB 100", "CNY", 1200],
  ["100 RMB", "CNY", 1200],
  ["CN¥100", "CNY", 1200],
  ["100元", "CNY", 1200],
  ["¥100", "JPY", 60],
])("selected %s opens popup with %s source and configured target", async (text, source, convertedAmount) => {
  const { startContentWorker } = await importWorkerWithMocks();
  jest.spyOn(window, "getSelection").mockReturnValue({
    toString: () => text,
    rangeCount: 1,
    getRangeAt: () => ({
      getBoundingClientRect: () => ({ left: 10, top: 20, height: 15 }),
    }),
  });
  await startContentWorker({
    isInvalid: false,
    onInvalidated: (cleanup) => { cleanupWorker = cleanup; },
    addEventListener: (target, type, listener, options) => {
      target.addEventListener(type, listener, options);
      removeEventListeners.push(() => target.removeEventListener(type, listener, options));
    },
  });

  document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

  const startedAt = Date.now();
  while (Date.now() - startedAt < 500) {
    const labels = popupController?.getRoot()?.shadowRoot?.querySelectorAll(
      ".fx-inline-dropdown-trigger__label",
    );
    if (labels?.[1]?.textContent === "INR") break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  const shadowRoot = popupController?.getRoot()?.shadowRoot;
  expect(shadowRoot).toBeDefined();
  expect(Array.from(shadowRoot.querySelectorAll(".fx-inline-dropdown-trigger__label"),
    (label) => label.textContent)).toEqual([source, "INR"]);
  const amounts = shadowRoot.querySelectorAll(".fx-inline-currency-box__amount-display");
  expect(amounts[0].textContent).toBe(
    new Intl.NumberFormat("en-US", { style: "currency", currency: source }).format(100),
  );
  expect(amounts[1].textContent).toBe(
    new Intl.NumberFormat("en-US", { style: "currency", currency: "INR" }).format(convertedAmount),
  );
  expect(recordSelectionConversionMock).toHaveBeenCalledTimes(1);
});
