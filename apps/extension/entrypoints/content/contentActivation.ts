import type {
  ContentActivationController,
  ContentActivationControllerDeps,
  ContentScriptLifecycleContext,
  ContentWorkerStartOptions,
  CurrencyActivationScanOptions,
  ExtensionRuntimeUrlGlobal,
} from "./content.types";
import { setContentWorkerStartupOptions } from "./contentWorkerStartup";

const ACTIVATION_MUTATION_DEBOUNCE_MS = 250;
const DEFAULT_SCAN_TEXT_NODE_LIMIT = 350;
const DEFAULT_SCAN_CHARACTER_LIMIT = 20_000;
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

const CURRENCY_SYMBOL_PATTERN =
  "(?:US\\$|AU\\$|CA\\$|NZ\\$|HK\\$|MX\\$|NT\\$|EC\\$|RD\\$|R\\$|[$€£¥₹₩₪₫₱฿₦₲₡₨₭₮₯₰₳₴₵₷₸₺￥＄￡￦￠﹩])";
const ISO_CODE_PATTERN =
  "(?:AED|AFN|ALL|AMD|AOA|ARS|AUD|AWG|AZN|BAM|BBD|BDT|BHD|BIF|BMD|BND|BOB|BRL|BSD|BWP|BYN|BZD|CAD|CDF|CHF|CLP|CNY|COP|CRC|CUP|CVE|CZK|DJF|DKK|DOP|DZD|EGP|ERN|ETB|EUR|FJD|FKP|GBP|GEL|GHS|GIP|GMD|GNF|GTQ|GYD|HKD|HNL|HUF|IDR|ILS|INR|IQD|IRR|ISK|JMD|JOD|JPY|KES|KGS|KHR|KMF|KRW|KWD|KYD|KZT|LAK|LBP|LKR|LRD|LYD|MAD|MDL|MGA|MKD|MMK|MNT|MOP|MRU|MUR|MVR|MWK|MXN|MYR|MZN|NGN|NIO|NOK|NPR|NZD|OMR|PEN|PGK|PHP|PKR|PLN|PYG|QAR|RON|RSD|RUB|RWF|SAR|SBD|SCR|SDG|SEK|SGD|SHP|SLE|SOS|SRD|SSP|STN|SYP|SZL|THB|TJS|TMT|TND|TOP|TRY|TTD|TWD|TZS|UAH|UGX|USD|UYU|UZS|VES|VND|VUV|WST|XAF|XCD|XCG|XOF|YER|ZAR|ZMW|ZWL)";
const NUMBER_PATTERN = "\\d[\\d\\s.,'’]*(?:\\d|[.,]\\d)?";
const CURRENCY_ACTIVATION_PATTERNS = [
  new RegExp(`${CURRENCY_SYMBOL_PATTERN}\\s*${NUMBER_PATTERN}`, "u"),
  new RegExp(`${NUMBER_PATTERN}\\s*${CURRENCY_SYMBOL_PATTERN}`, "u"),
  new RegExp(`\\b${ISO_CODE_PATTERN}\\b\\s*${NUMBER_PATTERN}`, "u"),
  new RegExp(`${NUMBER_PATTERN}\\s*\\b${ISO_CODE_PATTERN}\\b`, "u"),
];
const STRUCTURED_PRICE_ROOT_SELECTOR = ".a-price";
const STRUCTURED_PRICE_OFFSCREEN_SELECTOR = ".a-offscreen";

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

function structuredPriceRootHasCurrencyActivationSignal(
  priceRoot: Element,
  maxCharacters: number,
): boolean {
  if (isSkippedTextParent(priceRoot)) return false;

  const offscreenText = priceRoot
    .querySelector(STRUCTURED_PRICE_OFFSCREEN_SELECTOR)
    ?.textContent?.trim();
  if (offscreenText && hasCurrencyActivationSignal(offscreenText)) {
    return true;
  }

  return hasCurrencyActivationSignal(
    getElementTextWithinLimit(priceRoot, maxCharacters),
  );
}

function elementHasStructuredPriceActivationSignal(
  element: Element,
  maxCharacters: number,
): boolean {
  if (isSkippedTextParent(element)) return false;

  const nearestPriceRoot = element.matches(STRUCTURED_PRICE_ROOT_SELECTOR)
    ? element
    : element.closest(STRUCTURED_PRICE_ROOT_SELECTOR);
  if (
    nearestPriceRoot &&
    structuredPriceRootHasCurrencyActivationSignal(nearestPriceRoot, maxCharacters)
  ) {
    return true;
  }

  for (const priceRoot of Array.from(
    element.querySelectorAll(STRUCTURED_PRICE_ROOT_SELECTOR),
  )) {
    if (structuredPriceRootHasCurrencyActivationSignal(priceRoot, maxCharacters)) {
      return true;
    }
  }

  return false;
}

function parentNodeHasStructuredPriceActivationSignal(
  root: ParentNode,
  maxCharacters: number,
): boolean {
  if (root instanceof Element) {
    return elementHasStructuredPriceActivationSignal(root, maxCharacters);
  }

  if (!(root instanceof Document || root instanceof DocumentFragment)) {
    return false;
  }

  for (const priceRoot of Array.from(
    root.querySelectorAll(STRUCTURED_PRICE_ROOT_SELECTOR),
  )) {
    if (structuredPriceRootHasCurrencyActivationSignal(priceRoot, maxCharacters)) {
      return true;
    }
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

export function hasCurrencyActivationSignal(text: string): boolean {
  if (!text || !/\d/u.test(text)) return false;
  const normalized = text.normalize("NFKC");

  return CURRENCY_ACTIVATION_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function nodeHasCurrencyActivationSignal(
  node: Node,
  options: CurrencyActivationScanOptions = {},
): boolean {
  const maxCharacters = options.maxCharacters ?? DEFAULT_SCAN_CHARACTER_LIMIT;

  if (node instanceof Text) {
    if (isSkippedTextParent(node.parentNode)) return false;
    if (
      node.parentElement &&
      elementHasStructuredPriceActivationSignal(node.parentElement, maxCharacters)
    ) {
      return true;
    }

    return hasCurrencyActivationSignal(node.data.slice(0, maxCharacters));
  }

  if (node instanceof Element) {
    if (isSkippedTextParent(node)) return false;
    if (elementHasStructuredPriceActivationSignal(node, maxCharacters)) {
      return true;
    }

    return hasCurrencyActivationSignal(getElementTextWithinLimit(node, maxCharacters));
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
  if (parentNodeHasStructuredPriceActivationSignal(root, maxCharacters)) {
    return true;
  }

  const walker = ownerDocument.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
  let scannedTextNodes = 0;
  let scannedCharacters = 0;
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
    }

    currentNode = walker.nextNode();
  }

  return false;
}

export function mutationsContainCurrencyActivationSignal(
  mutations: MutationRecord[],
  options: CurrencyActivationScanOptions = {},
): boolean {
  for (const mutation of mutations) {
    if (
      mutation.type === "characterData" &&
      nodeHasCurrencyActivationSignal(mutation.target, options)
    ) {
      return true;
    }

    for (const node of Array.from(mutation.addedNodes)) {
      if (nodeHasCurrencyActivationSignal(node, options)) {
        return true;
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
