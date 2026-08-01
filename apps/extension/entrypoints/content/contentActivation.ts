import type {
  ContentActivationController,
  ContentActivationControllerDeps,
  ContentScriptLifecycleContext,
  ContentWorkerStartOptions,
  CurrencyActivationScanResult,
  CurrencyActivationScanOptions,
  ExtensionRuntimeUrlGlobal,
} from "./content.types";
import {
  appendActivationScanText,
  hasCurrencyActivationSignal,
} from "./activationSignal";
import { setContentWorkerStartupOptions } from "./contentWorkerStartup";

const ACTIVATION_MUTATION_DEBOUNCE_MS = 250;
const DEFAULT_SCAN_TEXT_NODE_LIMIT = 15_000;
const DEFAULT_SCAN_CHARACTER_LIMIT = 20_000;
const DEFAULT_MUTATION_SCAN_TEXT_NODE_LIMIT = 1_000;
const DEFAULT_MUTATION_SCAN_CHARACTER_LIMIT = 20_000;
const CHANGED_TEXT_CONTEXT_SIDE_LIMIT = 4;
const CHANGED_TEXT_CONTEXT_ANCESTOR_LIMIT = 4;
const SUPPORTED_CONTENT_PROTOCOLS = new Set(["http:", "https:"]);
const SKIPPED_TEXT_PARENT_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "SELECT",
  "OPTION",
  "SVG",
  "CANVAS",
]);

type AddedChangedArea = {
  type: "addedNodes";
  nodes: Node[];
};

type CharacterDataChangedArea = {
  type: "characterData";
  node: Node;
};

type MutationActivationChangedArea =
  | AddedChangedArea
  | CharacterDataChangedArea;

type ActivationScanBudget = {
  maxTextNodes: number;
  maxCharacters: number;
  scannedTextNodes: number;
  scannedCharacters: number;
};

function getDefaultSelectionText(): string {
  return window.getSelection()?.toString() ?? "";
}

function createDefaultMutationObserver(
  callback: MutationCallback,
): MutationObserver {
  return new MutationObserver(callback);
}

function getExtensionResourceUrl(path: string): string {
  const runtimeGlobal = globalThis as ExtensionRuntimeUrlGlobal;
  const getUrl =
    runtimeGlobal.chrome?.runtime?.getURL ??
    runtimeGlobal.browser?.runtime?.getURL;

  if (!getUrl) {
    throw new Error("FX Inline cannot resolve extension resource URLs.");
  }

  return getUrl(path);
}

async function importContentWorker(
  options: ContentWorkerStartOptions = {},
): Promise<void> {
  setContentWorkerStartupOptions(options);
  await import(/* @vite-ignore */ getExtensionResourceUrl("content-worker.js"));
}

function isSkippedTextParent(parent: Node | null): boolean {
  if (!(parent instanceof Element)) return false;
  if (SKIPPED_TEXT_PARENT_TAGS.has(parent.tagName)) return true;

  return Boolean(parent.closest(".ccx-inline-conversion, [data-fx-inline-ignore]"));
}

function getOwnerDocument(node: Node): Document | null {
  if (node instanceof Document) return node;
  return node.ownerDocument;
}

function isEligibleActivationTextNode(node: Node): node is Text {
  return node instanceof Text && !isSkippedTextParent(node.parentNode);
}

function scanTextNodeForCurrencyActivationSignal(
  node: Text,
  budget: ActivationScanBudget,
  rollingText: string,
): { result: CurrencyActivationScanResult | null; rollingText: string } {
  if (isSkippedTextParent(node.parentNode)) {
    return { result: null, rollingText };
  }

  if (
    budget.scannedTextNodes >= budget.maxTextNodes ||
    budget.scannedCharacters >= budget.maxCharacters
  ) {
    return { result: "exhausted", rollingText };
  }

  budget.scannedTextNodes += 1;
  const remainingCharacters = budget.maxCharacters - budget.scannedCharacters;
  const fullText = node.data;
  const text = fullText.slice(0, remainingCharacters);
  budget.scannedCharacters += text.length;

  if (hasCurrencyActivationSignal(text)) {
    return { result: "signal", rollingText };
  }

  const nextRollingText = appendActivationScanText(rollingText, text);
  if (hasCurrencyActivationSignal(nextRollingText)) {
    return { result: "signal", rollingText: nextRollingText };
  }

  if (fullText.length > remainingCharacters) {
    return { result: "exhausted", rollingText: nextRollingText };
  }

  return { result: null, rollingText: nextRollingText };
}

function getChangedTextContextRoot(node: Text): Node {
  let root: Node = node;
  let climbedAncestors = 0;

  while (
    root.parentNode &&
    !(root.parentNode instanceof Document) &&
    climbedAncestors < CHANGED_TEXT_CONTEXT_ANCESTOR_LIMIT
  ) {
    root = root.parentNode;
    climbedAncestors += 1;
  }

  return root;
}

function getPreviousNodeInContext(node: Node, root: Node): Node | null {
  if (node === root) return null;

  let previous = node.previousSibling;
  if (previous) {
    while (previous.lastChild) {
      previous = previous.lastChild;
    }

    return previous;
  }

  const parent = node.parentNode;
  if (!parent || parent === root) return null;

  return parent;
}

function getNextNodeInContext(node: Node, root: Node): Node | null {
  if (node.firstChild) return node.firstChild;

  let current: Node | null = node;
  while (current && current !== root) {
    if (current.nextSibling) return current.nextSibling;
    current = current.parentNode;
  }

  return null;
}

function collectChangedTextContextNodes(node: Text): Text[] {
  if (!isEligibleActivationTextNode(node)) return [];

  const root = getChangedTextContextRoot(node);
  const before: Text[] = [];
  let current: Node | null = node;

  while (before.length < CHANGED_TEXT_CONTEXT_SIDE_LIMIT) {
    current = getPreviousNodeInContext(current, root);
    if (!current) break;
    if (isEligibleActivationTextNode(current)) before.push(current);
  }

  const after: Text[] = [];
  current = node;

  while (after.length < CHANGED_TEXT_CONTEXT_SIDE_LIMIT) {
    current = getNextNodeInContext(current, root);
    if (!current) break;
    if (isEligibleActivationTextNode(current)) after.push(current);
  }

  return [...before.reverse(), node, ...after];
}

function scanChangedTextContextForCurrencyActivationSignal(
  node: Node,
  budget: ActivationScanBudget,
): CurrencyActivationScanResult {
  if (!(node instanceof Text)) return "clear";

  let rollingText = "";
  for (const textNode of collectChangedTextContextNodes(node)) {
    const scan = scanTextNodeForCurrencyActivationSignal(
      textNode,
      budget,
      rollingText,
    );
    if (scan.result) return scan.result;
    rollingText = scan.rollingText;
  }

  return "clear";
}

function scanChangedAreaNodesForCurrencyActivationSignal(
  nodes: readonly Node[],
  budget: ActivationScanBudget,
): CurrencyActivationScanResult {
  let rollingText = "";

  for (const node of nodes) {
    if (node instanceof Text) {
      const scan = scanTextNodeForCurrencyActivationSignal(node, budget, rollingText);
      if (scan.result) return scan.result;
      rollingText = scan.rollingText;
      continue;
    }

    if (node instanceof Element && isSkippedTextParent(node)) continue;

    const ownerDocument = getOwnerDocument(node);
    if (!ownerDocument) continue;

    const walker = ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let currentNode = walker.nextNode();

    while (currentNode) {
      if (currentNode instanceof Text) {
        const scan = scanTextNodeForCurrencyActivationSignal(
          currentNode,
          budget,
          rollingText,
        );
        if (scan.result) return scan.result;
        rollingText = scan.rollingText;
      }

      currentNode = walker.nextNode();
    }
  }

  return "clear";
}

export function isSupportedContentScriptUrl(url: string): boolean {
  try {
    return SUPPORTED_CONTENT_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function scanRootForCurrencyActivationSignal(
  root: ParentNode,
  options: CurrencyActivationScanOptions = {},
): CurrencyActivationScanResult {
  const maxTextNodes = options.maxTextNodes ?? DEFAULT_SCAN_TEXT_NODE_LIMIT;
  const maxCharacters = options.maxCharacters ?? DEFAULT_SCAN_CHARACTER_LIMIT;
  const rootNode = root as Node;
  const ownerDocument = root instanceof Document ? root : rootNode.ownerDocument;
  if (!ownerDocument) return "clear";

  const walker = ownerDocument.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
  let scannedTextNodes = 0;
  let scannedCharacters = 0;
  let rollingText = "";
  let currentNode = walker.nextNode();

  while (currentNode) {
    if (currentNode instanceof Text && !isSkippedTextParent(currentNode.parentNode)) {
      if (
        scannedTextNodes >= maxTextNodes ||
        scannedCharacters >= maxCharacters
      ) {
        return "exhausted";
      }

      scannedTextNodes += 1;
      const remainingCharacters = maxCharacters - scannedCharacters;
      const fullText = currentNode.data;
      const text = fullText.slice(0, remainingCharacters);
      scannedCharacters += text.length;

      if (hasCurrencyActivationSignal(text)) {
        return "signal";
      }

      rollingText = appendActivationScanText(rollingText, text);
      if (hasCurrencyActivationSignal(rollingText)) {
        return "signal";
      }

      if (fullText.length > remainingCharacters) {
        return "exhausted";
      }
    }

    currentNode = walker.nextNode();
  }

  return "clear";
}

export function collectMutationActivationChangedAreas(
  mutations: MutationRecord[],
): MutationActivationChangedArea[] {
  const changedAreas: MutationActivationChangedArea[] = [];

  for (const mutation of mutations) {
    if (mutation.type === "characterData") {
      changedAreas.push({ type: "characterData", node: mutation.target });
      continue;
    }

    const addedNodes = Array.from(mutation.addedNodes);
    if (addedNodes.length === 0) continue;

    changedAreas.push({
      type: "addedNodes",
      nodes: addedNodes,
    });
  }

  return changedAreas;
}

export function scanMutationChangedAreasForCurrencyActivationSignal(
  changedAreas: readonly MutationActivationChangedArea[],
  options: CurrencyActivationScanOptions = {},
): CurrencyActivationScanResult {
  const budget = {
    maxTextNodes:
      options.maxTextNodes ?? DEFAULT_MUTATION_SCAN_TEXT_NODE_LIMIT,
    maxCharacters:
      options.maxCharacters ?? DEFAULT_MUTATION_SCAN_CHARACTER_LIMIT,
    scannedTextNodes: 0,
    scannedCharacters: 0,
  };

  for (const changedArea of changedAreas) {
    if (changedArea.type === "characterData") {
      const result = scanChangedTextContextForCurrencyActivationSignal(
        changedArea.node,
        budget,
      );
      if (result !== "clear") return result;
      continue;
    }

    const result = scanChangedAreaNodesForCurrencyActivationSignal(
      changedArea.nodes,
      budget,
    );
    if (result !== "clear") return result;
  }

  return "clear";
}

export function createContentActivationController(
  ctx: ContentScriptLifecycleContext,
  deps: ContentActivationControllerDeps = {},
): ContentActivationController {
  const documentRef = deps.document ?? document;
  const locationHref = deps.locationHref ?? window.location.href;
  const loadContentWorker = deps.importContentWorker ?? importContentWorker;
  const scheduleTimeout = deps.setTimeout ?? window.setTimeout.bind(window);
  const cancelTimeout = deps.clearTimeout ?? window.clearTimeout.bind(window);
  const createObserver = deps.createMutationObserver ?? createDefaultMutationObserver;
  const getSelectionText = deps.getSelectionText ?? getDefaultSelectionText;

  let observer: MutationObserver | null = null;
  let mutationScanTimer: ReturnType<Window["setTimeout"]> | null = null;
  let pendingChangedAreas: MutationActivationChangedArea[] = [];
  let pendingWorker: Promise<void> | null = null;
  let isDisposed = false;
  let selectionListenerActive = false;

  function clearMutationTimer() {
    if (mutationScanTimer === null) return;
    cancelTimeout(mutationScanTimer);
    mutationScanTimer = null;
  }

  function deactivateShim() {
    clearMutationTimer();
    observer?.disconnect();
    observer = null;
    pendingChangedAreas = [];

    if (selectionListenerActive) {
      documentRef.removeEventListener("mouseup", handleSelectionMouseUp);
      selectionListenerActive = false;
    }
  }

  function dispose() {
    if (isDisposed) return;
    isDisposed = true;
    deactivateShim();
  }

  function startSelectionListener() {
    if (selectionListenerActive) return;
    documentRef.addEventListener("mouseup", handleSelectionMouseUp);
    selectionListenerActive = true;
  }

  function loadWorker(options: ContentWorkerStartOptions = {}): Promise<void> {
    if (pendingWorker) return pendingWorker;

    deactivateShim();

    pendingWorker = Promise.resolve()
      .then(() => {
        if (isDisposed || ctx.isInvalid) return undefined;
        return loadContentWorker(options);
      })
      .catch((error) => {
        pendingWorker = null;
        throw error;
      });

    return pendingWorker;
  }

  function flushPendingMutations() {
    mutationScanTimer = null;
    if (isDisposed || ctx.isInvalid || !pendingChangedAreas.length) return;

    const changedAreas = pendingChangedAreas;
    pendingChangedAreas = [];
    const result =
      scanMutationChangedAreasForCurrencyActivationSignal(changedAreas);

    if (result === "signal" || result === "exhausted") {
      void loadWorker().catch((error) => {
        console.warn("[fx-inline] Failed to start content worker after price detection", error);
      });
    }
  }

  function scheduleMutationScan() {
    if (mutationScanTimer !== null) return;

    mutationScanTimer = scheduleTimeout(
      flushPendingMutations,
      ACTIVATION_MUTATION_DEBOUNCE_MS,
    );
  }

  function handleMutations(mutations: MutationRecord[]) {
    if (isDisposed || ctx.isInvalid) return;
    const changedAreas = collectMutationActivationChangedAreas(mutations);
    if (!changedAreas.length) return;

    pendingChangedAreas.push(...changedAreas);
    scheduleMutationScan();
  }

  function handleSelectionMouseUp() {
    if (isDisposed || ctx.isInvalid) return;
    if (!hasCurrencyActivationSignal(getSelectionText().trim())) return;

    void loadWorker({ showSelectionOnStart: true }).catch((error) => {
      console.warn("[fx-inline] Failed to start content worker for selection", error);
    });
  }

  function start() {
    if (isDisposed || ctx.isInvalid) return;
    if (!isSupportedContentScriptUrl(locationHref)) return;

    const body = documentRef.body;
    if (!body) {
      documentRef.addEventListener("DOMContentLoaded", start, { once: true });
      return;
    }

    startSelectionListener();

    if (scanRootForCurrencyActivationSignal(body) === "signal") {
      void loadWorker().catch((error) => {
        console.warn("[fx-inline] Failed to start content worker after initial price scan", error);
      });
      return;
    }

    observer = createObserver(handleMutations);
    observer.observe(body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  ctx.onInvalidated(dispose);

  return {
    start,
    dispose,
    loadWorker,
  };
}
