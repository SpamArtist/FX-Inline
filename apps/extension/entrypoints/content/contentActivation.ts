import type {
  ContentActivationController,
  ContentActivationControllerDeps,
  ContentScriptLifecycleContext,
  ContentWorkerStartOptions,
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
const TEXT_CONTEXT_ANCESTOR_LIMIT = 4;
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

function getElementTextWithinLimit(
  element: Element,
  maxCharacters: number,
): string {
  const text = element.textContent ?? "";
  return text.length > maxCharacters ? text.slice(0, maxCharacters) : text;
}

function getNodeTextWithinLimit(
  node: Node,
  maxCharacters: number,
): string | null {
  if (node instanceof Text) {
    if (isSkippedTextParent(node.parentNode)) return null;
    return node.data.slice(0, maxCharacters);
  }

  if (node instanceof Element) {
    if (isSkippedTextParent(node)) return null;
    return getElementTextWithinLimit(node, maxCharacters);
  }

  return null;
}

function ancestorTextHasCurrencyActivationSignal(
  element: Element,
  maxCharacters: number,
): boolean {
  let currentElement: Element | null = element;
  let checkedAncestors = 0;

  while (
    currentElement &&
    checkedAncestors < TEXT_CONTEXT_ANCESTOR_LIMIT &&
    !isSkippedTextParent(currentElement)
  ) {
    if (
      hasCurrencyActivationSignal(
        getElementTextWithinLimit(currentElement, maxCharacters),
      )
    ) {
      return true;
    }

    currentElement = currentElement.parentElement;
    checkedAncestors += 1;
  }

  return false;
}

export function isSupportedContentScriptUrl(url: string): boolean {
  try {
    return SUPPORTED_CONTENT_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function nodeHasCurrencyActivationSignal(
  node: Node,
  options: CurrencyActivationScanOptions = {},
): boolean {
  const maxCharacters = options.maxCharacters ?? DEFAULT_SCAN_CHARACTER_LIMIT;

  if (node instanceof Text) {
    if (isSkippedTextParent(node.parentNode)) return false;
    if (hasCurrencyActivationSignal(node.data.slice(0, maxCharacters))) {
      return true;
    }

    return node.parentElement
      ? ancestorTextHasCurrencyActivationSignal(node.parentElement, maxCharacters)
      : false;
  }

  if (node instanceof Element) {
    if (isSkippedTextParent(node)) return false;
    if (hasCurrencyActivationSignal(getElementTextWithinLimit(node, maxCharacters))) {
      return true;
    }

    return node.parentElement
      ? ancestorTextHasCurrencyActivationSignal(node.parentElement, maxCharacters)
      : false;
  }

  return false;
}

export function scanRootForCurrencyActivationSignal(
  root: ParentNode,
  options: CurrencyActivationScanOptions = {},
): boolean {
  const maxTextNodes = options.maxTextNodes ?? DEFAULT_SCAN_TEXT_NODE_LIMIT;
  const maxCharacters = options.maxCharacters ?? DEFAULT_SCAN_CHARACTER_LIMIT;
  const rootNode = root as Node;
  const ownerDocument = root instanceof Document ? root : rootNode.ownerDocument;
  if (!ownerDocument) return false;

  const walker = ownerDocument.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
  let scannedTextNodes = 0;
  let scannedCharacters = 0;
  let rollingText = "";
  let currentNode = walker.nextNode();

  while (currentNode && scannedTextNodes < maxTextNodes) {
    if (currentNode instanceof Text && !isSkippedTextParent(currentNode.parentNode)) {
      scannedTextNodes += 1;
      const remainingCharacters = maxCharacters - scannedCharacters;
      if (remainingCharacters <= 0) return false;

      const text = currentNode.data.slice(0, remainingCharacters);
      scannedCharacters += text.length;

      if (hasCurrencyActivationSignal(text)) {
        return true;
      }

      rollingText = appendActivationScanText(rollingText, text);
      if (hasCurrencyActivationSignal(rollingText)) {
        return true;
      }
    }

    currentNode = walker.nextNode();
  }

  return false;
}

export function mutationsContainCurrencyActivationSignal(
  mutations: MutationRecord[],
  options: CurrencyActivationScanOptions = {},
): boolean {
  const maxCharacters = options.maxCharacters ?? DEFAULT_SCAN_CHARACTER_LIMIT;
  let rollingText = "";

  for (const mutation of mutations) {
    if (
      mutation.type === "characterData" &&
      nodeHasCurrencyActivationSignal(mutation.target, options)
    ) {
      return true;
    }

    const targetText = getNodeTextWithinLimit(mutation.target, maxCharacters);
    if (targetText) {
      rollingText = appendActivationScanText(rollingText, targetText);
      if (hasCurrencyActivationSignal(rollingText)) {
        return true;
      }
    }

    for (const node of Array.from(mutation.addedNodes)) {
      if (nodeHasCurrencyActivationSignal(node, options)) {
        return true;
      }

      const nodeText = getNodeTextWithinLimit(node, maxCharacters);
      if (nodeText) {
        rollingText = appendActivationScanText(rollingText, nodeText);
        if (hasCurrencyActivationSignal(rollingText)) {
          return true;
        }
      }
    }
  }

  return false;
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
  let pendingMutations: MutationRecord[] = [];
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
    pendingMutations = [];

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
    if (isDisposed || ctx.isInvalid || !pendingMutations.length) return;

    const mutations = pendingMutations;
    pendingMutations = [];

    if (mutationsContainCurrencyActivationSignal(mutations)) {
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
    pendingMutations.push(...mutations);
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

    if (scanRootForCurrencyActivationSignal(body)) {
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
