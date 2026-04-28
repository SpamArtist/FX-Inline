import { jest } from "@jest/globals";

const getUserSettingsMock = jest.fn();
const getRatesMock = jest.fn();

function createRateSnapshot(overrides = {}) {
  const base = {
    base: "USD",
    fetchedAt: Date.now(),
    rates: {
      USD: 1,
      EUR: 0.9,
      INR: 80,
    },
  };

  return {
    ...base,
    ...overrides,
    rates: {
      ...base.rates,
      ...(overrides.rates || {}),
    },
  };
}

function createUserSettings(targetCurrency) {
  return {
    schemaVersion: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    scopes: {
      allUrls: {
        enabled: true,
        domain: "",
        pageUrl: "",
        targetCurrencies: [targetCurrency],
        convertedCurrencyPosition: "right",
        displayStyle: "brackets",
        highlightColor: "#fff1a8",
        extraSettings: {},
      },
      domains: {},
      pages: {},
    },
  };
}

async function importSelectionPopupModuleWithMocks() {
  jest.resetModules();

  await jest.unstable_mockModule("../../test-dist/utils/appStorage.js", () => ({
    getUserSettings: getUserSettingsMock,
  }));

  await jest.unstable_mockModule("../../test-dist/utils/rates/index.js", () => ({
    getRates: getRatesMock,
  }));

  return import("../../test-dist/entrypoints/content/selectionPopup.js");
}

async function flushMicrotasks(turns = 6) {
  for (let index = 0; index < turns; index += 1) {
    await Promise.resolve();
  }
}

async function waitForCondition(assertion, timeoutMs = 250) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      assertion();
      return;
    } catch {
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
    }
  }

  assertion();
}

function getShadowRoot(controller) {
  const popupRoot = controller.getRoot();
  if (!popupRoot) {
    throw new Error("Expected popup root to be available");
  }

  const shadowRoot = popupRoot.shadowRoot;
  if (!shadowRoot) {
    throw new Error("Expected popup shadow root to be available");
  }

  return shadowRoot;
}

async function waitForPopupContent(controller) {
  await waitForCondition(() => {
    const shadowRoot = getShadowRoot(controller);
    const host = shadowRoot.querySelector(".fx-inline-selection-popup-host");
    const shell = shadowRoot.querySelector(".fx-inline-shell");
    const amountDisplay = shadowRoot.querySelector(".fx-inline-currency-box__amount-display");

    expect(host).not.toBeNull();
    expect(shell).not.toBeNull();
    expect(amountDisplay).not.toBeNull();
  });
}

function createController(createSelectionPopupController) {
  return createSelectionPopupController(
    ".mock-style { color: red; }",
    "chrome-extension://extension-id/theme.css",
  );
}

beforeEach(() => {
  jest.clearAllMocks();

  getUserSettingsMock.mockResolvedValue(createUserSettings("EUR"));
  getRatesMock.mockResolvedValue(createRateSnapshot());

  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

test("showPopup renders popup shell, styles, and placement", async () => {
  const { createSelectionPopupController } = await importSelectionPopupModuleWithMocks();
  const controller = createController(createSelectionPopupController);

  controller.showPopup(123, 456, "100", "EUR");
  await waitForPopupContent(controller);

  const popupRoot = controller.getRoot();
  expect(popupRoot).not.toBeNull();
  expect(popupRoot?.id).toBe("popup-root");
  expect(popupRoot?.style.position).toBe("absolute");
  expect(popupRoot?.style.left).toBe("123px");
  expect(popupRoot?.style.top).toBe("456px");

  const shadowRoot = getShadowRoot(controller);
  const themeStylesheet = shadowRoot.querySelector("#fx-inline-theme-stylesheet");
  expect(themeStylesheet?.getAttribute("rel")).toBe("stylesheet");
  expect(themeStylesheet?.getAttribute("href")).toBe(
    "chrome-extension://extension-id/theme.css",
  );

  const styleTag = shadowRoot.querySelector("#content-styles");
  expect(styleTag?.textContent).toContain(".mock-style");

  const host = shadowRoot.querySelector(".fx-inline-selection-popup-host");
  expect(host).not.toBeNull();
  expect(host?.querySelector(".fx-inline-shell")).not.toBeNull();
  expect(host?.querySelectorAll(".fx-inline-currency-box")).toHaveLength(2);
});

test("removePopup and destroy are idempotent and clean up the DOM", async () => {
  const { createSelectionPopupController } = await importSelectionPopupModuleWithMocks();
  const controller = createController(createSelectionPopupController);

  controller.showPopup(10, 20, "20", "EUR");
  await waitForPopupContent(controller);

  expect(document.querySelectorAll("#popup-root")).toHaveLength(1);

  controller.removePopup();
  controller.removePopup();
  expect(controller.getRoot()).toBeNull();
  expect(document.querySelectorAll("#popup-root")).toHaveLength(0);

  controller.showPopup(10, 20, "20", "EUR");
  await waitForPopupContent(controller);
  expect(document.querySelectorAll("#popup-root")).toHaveLength(1);

  controller.destroy();
  controller.destroy();
  expect(controller.getRoot()).toBeNull();
  expect(document.querySelectorAll("#popup-root")).toHaveLength(0);
});

test("containsTarget and repeated showPopup replace the popup root", async () => {
  const { createSelectionPopupController } = await importSelectionPopupModuleWithMocks();
  const controller = createController(createSelectionPopupController);

  controller.showPopup(10, 20, "20", "EUR");
  await waitForPopupContent(controller);

  const firstPopupRoot = controller.getRoot();
  expect(firstPopupRoot).not.toBeNull();
  expect(firstPopupRoot && controller.containsTarget(firstPopupRoot)).toBe(true);

  const firstShadowRoot = getShadowRoot(controller);
  const firstAmountButton = firstShadowRoot.querySelector(".fx-inline-currency-box__amount-display");
  expect(firstAmountButton).not.toBeNull();
  if (!firstAmountButton) {
    throw new Error("Expected amount display button");
  }

  expect(controller.containsTarget(firstAmountButton)).toBe(false);

  controller.showPopup(30, 40, "30", "EUR");
  await waitForPopupContent(controller);

  expect(document.querySelectorAll("#popup-root")).toHaveLength(1);
  const secondPopupRoot = controller.getRoot();
  expect(secondPopupRoot).not.toBeNull();
  expect(secondPopupRoot).not.toBe(firstPopupRoot);
});

test("amount edit interactions commit on blur and Enter, and revert on Escape", async () => {
  const { createSelectionPopupController } = await importSelectionPopupModuleWithMocks();
  const controller = createController(createSelectionPopupController);

  controller.showPopup(10, 20, "15", "EUR");
  await waitForPopupContent(controller);

  const shadowRoot = getShadowRoot(controller);
  const sourceRow = shadowRoot.querySelectorAll(".fx-inline-currency-box")[0];
  expect(sourceRow).not.toBeUndefined();
  if (!sourceRow) {
    throw new Error("Expected source currency row");
  }

  const sourceAmountDisplay = sourceRow.querySelector(".fx-inline-currency-box__amount-display");
  expect(sourceAmountDisplay).not.toBeNull();
  if (!sourceAmountDisplay) {
    throw new Error("Expected source amount display button");
  }

  sourceAmountDisplay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await flushMicrotasks();

  const sourceAmountInput = sourceRow.querySelector(".fx-inline-currency-box__amount-input");
  expect(sourceAmountInput).not.toBeNull();
  if (!(sourceAmountInput instanceof HTMLInputElement)) {
    throw new Error("Expected source amount input");
  }

  sourceAmountInput.value = "200";
  sourceAmountInput.dispatchEvent(new Event("input", { bubbles: true }));
  sourceAmountInput.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  await flushMicrotasks();

  const displayAfterBlur = sourceRow.querySelector(".fx-inline-currency-box__amount-display");
  expect(displayAfterBlur?.textContent).not.toBe(sourceAmountDisplay.textContent);

  displayAfterBlur?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await flushMicrotasks();

  const inputAfterBlur = sourceRow.querySelector(".fx-inline-currency-box__amount-input");
  if (!(inputAfterBlur instanceof HTMLInputElement)) {
    throw new Error("Expected source amount input after blur edit");
  }

  inputAfterBlur.value = "300";
  inputAfterBlur.dispatchEvent(new Event("input", { bubbles: true }));
  inputAfterBlur.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  inputAfterBlur.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  await flushMicrotasks();

  let stableDisplayText = "";
  await waitForCondition(() => {
    const displayAfterEnter = sourceRow.querySelector(".fx-inline-currency-box__amount-display");
    expect(displayAfterEnter).not.toBeNull();
    stableDisplayText = displayAfterEnter?.textContent || "";
    expect(stableDisplayText.length).toBeGreaterThan(0);
  });

  sourceRow
    .querySelector(".fx-inline-currency-box__amount-display")
    ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await flushMicrotasks();

  const inputAfterEnter = sourceRow.querySelector(".fx-inline-currency-box__amount-input");
  if (!(inputAfterEnter instanceof HTMLInputElement)) {
    throw new Error("Expected source amount input after enter edit");
  }

  inputAfterEnter.value = "999";
  inputAfterEnter.dispatchEvent(new Event("input", { bubbles: true }));
  inputAfterEnter.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await waitForCondition(() => {
    const displayAfterEscape = sourceRow.querySelector(".fx-inline-currency-box__amount-display");
    expect(displayAfterEscape).not.toBeNull();
    expect(displayAfterEscape?.textContent).toBe(stableDisplayText);
  });
});

test("hydration updates preferred currency row after popup mount", async () => {
  getUserSettingsMock.mockResolvedValue(createUserSettings("INR"));
  getRatesMock.mockResolvedValue(
    createRateSnapshot({
      rates: {
        USD: 1,
        EUR: 0.5,
        INR: 80,
      },
    }),
  );

  const { createSelectionPopupController } = await importSelectionPopupModuleWithMocks();
  const controller = createController(createSelectionPopupController);

  controller.showPopup(10, 20, "5", "EUR");

  await waitForCondition(() => {
    const shadowRoot = getShadowRoot(controller);
    const labels = Array.from(
      shadowRoot.querySelectorAll(".fx-inline-dropdown-trigger__label"),
    ).map((node) => node.textContent?.trim());

    expect(labels).toContain("INR");
  });
});
