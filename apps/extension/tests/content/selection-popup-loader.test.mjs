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
  const importConverterThemeStyles = jest
    .fn()
    .mockResolvedValue({ default: "theme styles" });

  const loader = createLazySelectionPopupControllerLoader({
    importSelectionPopupFactory,
    importContentStyles,
    importConverterThemeStyles,
  });

  expect(loader.getSync()).toBeNull();

  const first = await loader.get();
  const second = await loader.get();

  expect(first).toBe(popupController);
  expect(second).toBe(popupController);
  expect(loader.getSync()).toBe(popupController);

  expect(importSelectionPopupFactory).toHaveBeenCalledTimes(1);
  expect(importContentStyles).toHaveBeenCalledTimes(1);
  expect(importConverterThemeStyles).toHaveBeenCalledTimes(1);

  expect(createSelectionPopupController).toHaveBeenCalledTimes(1);
  expect(createSelectionPopupController).toHaveBeenCalledWith(
    "theme styles\ncontent styles",
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
  const importConverterThemeStyles = jest
    .fn()
    .mockResolvedValue({ default: "theme styles" });

  const loader = createLazySelectionPopupControllerLoader({
    importSelectionPopupFactory,
    importContentStyles,
    importConverterThemeStyles,
  });

  const firstPromise = loader.get();
  const secondPromise = loader.get();

  expect(importSelectionPopupFactory).toHaveBeenCalledTimes(1);
  expect(importContentStyles).toHaveBeenCalledTimes(1);
  expect(importConverterThemeStyles).toHaveBeenCalledTimes(1);

  resolveFactory({ createSelectionPopupController });

  const [first, second] = await Promise.all([firstPromise, secondPromise]);

  expect(first).toBe(popupController);
  expect(second).toBe(popupController);
  expect(createSelectionPopupController).toHaveBeenCalledTimes(1);
});
