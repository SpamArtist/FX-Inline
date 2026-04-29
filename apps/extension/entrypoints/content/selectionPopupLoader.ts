import { browser } from "wxt/browser";
import type { SelectionPopupController } from "./content.types";

type InlineStyleModule = {
  default: string;
};

type SelectionPopupFactoryModule = {
  createSelectionPopupController: (
    contentStyleText: string,
    themeStylesheetUrl: string,
  ) => SelectionPopupController;
};

export type SelectionPopupLoaderDeps = {
  importSelectionPopupFactory?: () => Promise<SelectionPopupFactoryModule>;
  importContentStyles?: () => Promise<InlineStyleModule>;
  resolveThemeStylesheetUrl?: () => string;
};

export type LazySelectionPopupControllerLoader = {
  getSync: () => SelectionPopupController | null;
  get: () => Promise<SelectionPopupController>;
};

const SHARED_THEME_STYLESHEET_PATH = "/theme.css";

function importSelectionPopupFactory(): Promise<SelectionPopupFactoryModule> {
  return import("./selectionPopup");
}

function importContentStyles(): Promise<InlineStyleModule> {
  return import("./content.css?inline");
}

function resolveThemeStylesheetUrl(): string {
  return browser.runtime.getURL(SHARED_THEME_STYLESHEET_PATH);
}

export function createLazySelectionPopupControllerLoader(
  deps: SelectionPopupLoaderDeps = {},
): LazySelectionPopupControllerLoader {
  const loadPopupFactory = deps.importSelectionPopupFactory ?? importSelectionPopupFactory;
  const loadContentStyles = deps.importContentStyles ?? importContentStyles;
  const getThemeStylesheetUrl =
    deps.resolveThemeStylesheetUrl ?? resolveThemeStylesheetUrl;

  let popupController: SelectionPopupController | null = null;
  let pendingPopupController: Promise<SelectionPopupController> | null = null;

  return {
    getSync: () => popupController,
    get: async () => {
      if (popupController) return popupController;

      if (!pendingPopupController) {
        pendingPopupController = Promise.all([
          loadPopupFactory(),
          loadContentStyles(),
        ]).then(([selectionPopupModule, contentStylesModule]) => {
          popupController = selectionPopupModule.createSelectionPopupController(
            contentStylesModule.default,
            getThemeStylesheetUrl(),
          );

          return popupController;
        });
      }

      return pendingPopupController;
    },
  };
}
