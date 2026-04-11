import type { SelectionPopupController } from "./content.types";

type InlineStyleModule = {
  default: string;
};

type SelectionPopupFactoryModule = {
  createSelectionPopupController: (
    contentStyleText: string,
  ) => SelectionPopupController;
};

export type SelectionPopupLoaderDeps = {
  importSelectionPopupFactory?: () => Promise<SelectionPopupFactoryModule>;
  importContentStyles?: () => Promise<InlineStyleModule>;
  importConverterThemeStyles?: () => Promise<InlineStyleModule>;
};

export type LazySelectionPopupControllerLoader = {
  getSync: () => SelectionPopupController | null;
  get: () => Promise<SelectionPopupController>;
};

function importSelectionPopupFactory(): Promise<SelectionPopupFactoryModule> {
  return import("./selectionPopup");
}

function importContentStyles(): Promise<InlineStyleModule> {
  return import("./content.css?inline");
}

function importConverterThemeStyles(): Promise<InlineStyleModule> {
  return import("@/styles/converter-theme.css?inline");
}

export function createLazySelectionPopupControllerLoader(
  deps: SelectionPopupLoaderDeps = {},
): LazySelectionPopupControllerLoader {
  const loadPopupFactory = deps.importSelectionPopupFactory ?? importSelectionPopupFactory;
  const loadContentStyles = deps.importContentStyles ?? importContentStyles;
  const loadConverterThemeStyles =
    deps.importConverterThemeStyles ?? importConverterThemeStyles;

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
          loadConverterThemeStyles(),
        ]).then(([selectionPopupModule, contentStylesModule, converterThemeStylesModule]) => {
          popupController = selectionPopupModule.createSelectionPopupController(
            `${converterThemeStylesModule.default}\n${contentStylesModule.default}`,
          );

          return popupController;
        });
      }

      return pendingPopupController;
    },
  };
}
