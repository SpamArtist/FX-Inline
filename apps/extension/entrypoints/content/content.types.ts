import type { UserSettings } from "@/utils/appStorage.types";
import type { CurrencyCode } from "@/utils/enums";

export type InlineConversionPerfSample = {
  totalMs: number;
  clearExistingMs: number;
  scanTextNodesMs: number;
  decorateNodesMs: number;
  /** Text nodes reached by Candidate Discovery before the accepted-candidate limit stops the walk. */
  visitedTextNodes: number;
  /** Text nodes accepted after price-text classification and DOM eligibility checks. */
  acceptedCandidates: number;
  /** @deprecated Use acceptedCandidates. Kept as a compatibility alias. */
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
  recordSelectionConversion: () => void;
  shouldIgnoreMutations: () => boolean;
  cleanup: () => void;
};

export type ContentScriptLifecycleContext = {
  readonly isInvalid: boolean;
  addEventListener: (
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  onInvalidated: (cleanup: () => void) => void;
};

export type ContentWorkerStartOptions = {
  showSelectionOnStart?: boolean;
};

export type ContentWorkerLoader = (
  options?: ContentWorkerStartOptions,
) => Promise<void>;

export type ContentWorkerGlobal = typeof globalThis & {
  __FX_INLINE_CONTENT_WORKER_START_OPTIONS__?: ContentWorkerStartOptions;
};

export type ExtensionRuntimeUrlGlobal = typeof globalThis & {
  browser?: {
    runtime?: {
      getURL?: (path: string) => string;
    };
  };
  chrome?: {
    runtime?: {
      getURL?: (path: string) => string;
    };
  };
};

export type ContentActivationController = {
  start: () => void;
  dispose: () => void;
  loadWorker: (options?: ContentWorkerStartOptions) => Promise<void>;
};

export type ContentActivationControllerDeps = {
  document?: Document;
  locationHref?: string;
  importContentWorker?: ContentWorkerLoader;
  setTimeout?: Window["setTimeout"];
  clearTimeout?: Window["clearTimeout"];
  createMutationObserver?: (callback: MutationCallback) => MutationObserver;
  getSelectionText?: () => string;
};

export type CurrencyActivationScanOptions = {
  maxTextNodes?: number;
  maxCharacters?: number;
};

export type CurrencyActivationScanResult = "signal" | "clear" | "exhausted";

export type MutationRootBatcherDeps = {
  collectRoots: (mutations: MutationRecord[]) => ParentNode[];
  enqueueRoots: (roots: ParentNode[]) => void;
  shouldIgnoreMutations: () => boolean;
  debounceMs?: number;
  setTimeout?: Window["setTimeout"];
  clearTimeout?: Window["clearTimeout"];
};

export type MutationRootBatcher = {
  push: (mutations: MutationRecord[]) => void;
  flush: () => void;
  cancel: () => void;
};

export type SelectionPopupController = {
  showPopup: (x: number, y: number, amount: string, currency: CurrencyCode) => void;
  removePopup: () => void;
  containsTarget: (target: Node) => boolean;
  getRoot: () => HTMLDivElement | null;
  destroy: () => void;
};
