import type { UserSettings } from "@/utils/appStorage.types";
import type { CurrencyCode } from "@/utils/enums";

export type InlineConversionPerfSample = {
  totalMs: number;
  clearExistingMs: number;
  scanTextNodesMs: number;
  decorateNodesMs: number;
  scannedTextNodes: number;
  conversionsApplied: number;
  maxNodesPerPass: number;
  reachedNodeLimit: boolean;
};

export type ContentConversionRuntime = {
  initialize: () => Promise<void>;
  onSettingsStorageUpdate: (
    newSettings?: UserSettings | null,
    oldSettings?: UserSettings | null,
  ) => Promise<void>;
  enqueueMutationRoots: (roots: ParentNode[]) => void;
  shouldIgnoreMutations: () => boolean;
  cleanup: () => void;
};

export type SelectionPopupController = {
  showPopup: (x: number, y: number, amount: string, currency: CurrencyCode) => void;
  removePopup: () => void;
  containsTarget: (target: Node) => boolean;
  getRoot: () => HTMLDivElement | null;
  destroy: () => void;
};
