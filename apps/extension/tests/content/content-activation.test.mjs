import { jest } from "@jest/globals";
import {
  createContentActivationController,
  hasCurrencyActivationSignal,
  isSupportedContentScriptUrl,
  mutationsContainCurrencyActivationSignal,
  scanRootForCurrencyActivationSignal,
} from "../../test-dist/entrypoints/content/contentActivation.js";

function createLifecycleContext() {
  const invalidationCallbacks = [];

  return {
    ctx: {
      isInvalid: false,
      addEventListener: jest.fn(),
      onInvalidated: (callback) => {
        invalidationCallbacks.push(callback);
      },
    },
    invalidationCallbacks,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  document.body.innerHTML = "";
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  document.body.innerHTML = "";
});

test("currency activation signal detects prices without accepting generic status text", () => {
  expect(hasCurrencyActivationSignal("$129.99")).toBe(true);
  expect(hasCurrencyActivationSignal("USD 129.99")).toBe(true);
  expect(hasCurrencyActivationSignal("129.99 EUR")).toBe(true);
  expect(hasCurrencyActivationSignal("￥39,000")).toBe(true);
  expect(hasCurrencyActivationSignal("API 200 OK")).toBe(false);
});

test("activation URL guard keeps unsupported schemes out of content startup", () => {
  expect(isSupportedContentScriptUrl("https://example.com/pricing")).toBe(true);
  expect(isSupportedContentScriptUrl("http://localhost:3000")).toBe(true);
  expect(isSupportedContentScriptUrl("about:blank")).toBe(false);
  expect(isSupportedContentScriptUrl("chrome://extensions")).toBe(false);
  expect(isSupportedContentScriptUrl("file:///tmp/prices.html")).toBe(false);
});

test("root scan ignores script text and finds page-visible currency text", () => {
  document.body.innerHTML = `
    <script>const price = "$999";</script>
    <main><p>No price here</p></main>
  `;

  expect(scanRootForCurrencyActivationSignal(document.body)).toBe(false);

  document.querySelector("main").append("Plans start at €49");

  expect(scanRootForCurrencyActivationSignal(document.body)).toBe(true);
});

test("mutation scan checks added nodes only", () => {
  const ignoredScript = document.createElement("script");
  ignoredScript.textContent = "const price = '$999'";
  const priceNode = document.createElement("span");
  priceNode.textContent = "Only £19";

  expect(
    mutationsContainCurrencyActivationSignal([
      { addedNodes: [ignoredScript] },
    ]),
  ).toBe(false);
  expect(
    mutationsContainCurrencyActivationSignal([
      { addedNodes: [priceNode] },
    ]),
  ).toBe(true);
});

test("activation controller observes child additions and lazy-loads worker after debounce", async () => {
  const { ctx } = createLifecycleContext();
  const importContentWorker = jest.fn().mockResolvedValue(undefined);
  let mutationCallback = null;
  const observer = {
    observe: jest.fn(),
    disconnect: jest.fn(),
  };
  const createMutationObserver = jest.fn((callback) => {
    mutationCallback = callback;
    return observer;
  });

  document.body.innerHTML = "<main><p>No price yet</p></main>";

  const controller = createContentActivationController(ctx, {
    document,
    locationHref: "https://example.com/",
    importContentWorker,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
    createMutationObserver,
  });

  controller.start();

  expect(importContentWorker).not.toHaveBeenCalled();
  expect(observer.observe).toHaveBeenCalledWith(document.body, {
    childList: true,
    subtree: true,
  });

  const addedNode = document.createElement("p");
  addedNode.textContent = "Now only $25";
  mutationCallback([{ addedNodes: [addedNode] }]);

  jest.advanceTimersByTime(249);
  expect(importContentWorker).not.toHaveBeenCalled();

  jest.advanceTimersByTime(1);
  await Promise.resolve();
  await Promise.resolve();

  expect(importContentWorker).toHaveBeenCalledTimes(1);
  expect(importContentWorker).toHaveBeenCalledWith({});
  expect(observer.disconnect).toHaveBeenCalledTimes(1);
});

test("activation controller bails before observing unsupported schemes", () => {
  const { ctx } = createLifecycleContext();
  const importContentWorker = jest.fn();
  const createMutationObserver = jest.fn();

  document.body.innerHTML = "<main><p>$25</p></main>";

  createContentActivationController(ctx, {
    document,
    locationHref: "about:blank",
    importContentWorker,
    createMutationObserver,
  }).start();

  expect(importContentWorker).not.toHaveBeenCalled();
  expect(createMutationObserver).not.toHaveBeenCalled();
});

test("selection signal lazy-loads worker with startup selection handling", async () => {
  const { ctx } = createLifecycleContext();
  const importContentWorker = jest.fn().mockResolvedValue(undefined);

  document.body.innerHTML = "<main><p>No price here</p></main>";

  createContentActivationController(ctx, {
    document,
    locationHref: "https://example.com/",
    importContentWorker,
    getSelectionText: () => "USD 19",
  }).start();

  document.dispatchEvent(new MouseEvent("mouseup"));
  await Promise.resolve();
  await Promise.resolve();

  expect(importContentWorker).toHaveBeenCalledTimes(1);
  expect(importContentWorker).toHaveBeenCalledWith({
    showSelectionOnStart: true,
  });
});
