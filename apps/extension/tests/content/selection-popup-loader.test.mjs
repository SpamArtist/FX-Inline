import { jest } from "@jest/globals";
import { createLazySelectionPopupControllerLoader } from "../../test-dist/entrypoints/content/selectionPopupLoader.js";

function createStubPopupController() {
  return {
    showPopup: () => {},
    removePopup: () => {},
    containsTarget: () => false,
    getRoot: () => null,
    destroy: () => {},
  };
}

test("lazy loader imports modules only on first get and caches the popup controller", async () => {
  const popupController = createStubPopupController();
  const createSelectionPopupController = jest.fn(() => popupController);

  const importSelectionPopupFactory = jest
    .fn()
    .mockResolvedValue({ createSelectionPopupController });
  const importContentStyles = jest
    .fn()
    .mockResolvedValue({ default: "content styles" });
  const resolveThemeStylesheetUrl = jest
    .fn()
    .mockReturnValue("chrome-extension://extension-id/theme.css");

  const loader = createLazySelectionPopupControllerLoader({
    importSelectionPopupFactory,
    importContentStyles,
    resolveThemeStylesheetUrl,
  });

  expect(loader.getSync()).toBeNull();

  const first = await loader.get();
  const second = await loader.get();

  expect(first).toBe(popupController);
  expect(second).toBe(popupController);
  expect(loader.getSync()).toBe(popupController);

  expect(importSelectionPopupFactory).toHaveBeenCalledTimes(1);
  expect(importContentStyles).toHaveBeenCalledTimes(1);
  expect(resolveThemeStylesheetUrl).toHaveBeenCalledTimes(1);

  expect(createSelectionPopupController).toHaveBeenCalledTimes(1);
  expect(createSelectionPopupController).toHaveBeenCalledWith(
    "content styles",
    "chrome-extension://extension-id/theme.css",
  );
});

test("lazy loader deduplicates concurrent get calls", async () => {
  const popupController = createStubPopupController();
  const createSelectionPopupController = jest.fn(() => popupController);

  let resolveFactory;
  const importSelectionPopupFactory = jest.fn(
    () =>
      new Promise((resolve) => {
        resolveFactory = resolve;
      }),
  );

  const importContentStyles = jest
    .fn()
    .mockResolvedValue({ default: "content styles" });
  const resolveThemeStylesheetUrl = jest
    .fn()
    .mockReturnValue("chrome-extension://extension-id/theme.css");

  const loader = createLazySelectionPopupControllerLoader({
    importSelectionPopupFactory,
    importContentStyles,
    resolveThemeStylesheetUrl,
  });

  const firstPromise = loader.get();
  const secondPromise = loader.get();

  expect(importSelectionPopupFactory).toHaveBeenCalledTimes(1);
  expect(importContentStyles).toHaveBeenCalledTimes(1);
  expect(resolveThemeStylesheetUrl).toHaveBeenCalledTimes(0);

  resolveFactory({ createSelectionPopupController });

  const [first, second] = await Promise.all([firstPromise, secondPromise]);

  expect(first).toBe(popupController);
  expect(second).toBe(popupController);
  expect(createSelectionPopupController).toHaveBeenCalledTimes(1);
  expect(resolveThemeStylesheetUrl).toHaveBeenCalledTimes(1);
});
