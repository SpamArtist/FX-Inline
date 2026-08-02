import { jest } from "@jest/globals";
import {
  collectMutationActivationChangedAreas,
  createContentActivationController,
  createMutationActivationChangedNodeFrontier,
  isSupportedContentScriptUrl,
  scanMutationChangedAreasForCurrencyActivationSignal,
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

function scanMutations(mutations, options) {
  return scanMutationChangedAreasForCurrencyActivationSignal(
    collectMutationActivationChangedAreas(mutations),
    options,
  );
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

  expect(scanRootForCurrencyActivationSignal(document.body)).toBe("clear");

  document.querySelector("main").append("Plans start at €49");

  expect(scanRootForCurrencyActivationSignal(document.body)).toBe("signal");
});

test("root scan detects listing prices split across text nodes", () => {
  const filters = document.createElement("section");
  for (let index = 0; index < 20; index += 1) {
    const filter = document.createElement("span");
    filter.textContent = `Filter ${index}`;
    filters.append(filter);
  }

  const listingPrice = document.createElement("span");
  listingPrice.innerHTML = `
    <span>₹</span>
    <span>75</span>
  `;

  document.body.append(filters, listingPrice);

  expect(
    scanRootForCurrencyActivationSignal(document.body, {
      maxTextNodes: 30,
    }),
  ).toBe("signal");
});

test("root scan detects symbol prices split across token context boundary", () => {
  document.body.replaceChildren();
  for (const text of ["$", ".".repeat(61), "1"]) {
    const span = document.createElement("span");
    span.textContent = text;
    document.body.append(span);
  }

  expect(scanRootForCurrencyActivationSignal(document.body)).toBe("signal");

  document.body.replaceChildren();
  for (const text of ["1", ".".repeat(62), "€"]) {
    const span = document.createElement("span");
    span.textContent = text;
    document.body.append(span);
  }

  expect(scanRootForCurrencyActivationSignal(document.body)).toBe("clear");
});

test("root scan returns only explicit activation results", () => {
  document.body.textContent = "No price";
  const clearResult = scanRootForCurrencyActivationSignal(document.body);

  document.body.textContent = "$25";
  const signalResult = scanRootForCurrencyActivationSignal(document.body);

  document.body.textContent = "x".repeat(4);
  const exhaustedResult = scanRootForCurrencyActivationSignal(document.body, {
    maxCharacters: 3,
  });

  expect(new Set([clearResult, signalResult, exhaustedResult])).toEqual(
    new Set(["clear", "signal", "exhausted"]),
  );
});

test("root scan treats exact final budget use as clear", () => {
  const first = document.createElement("span");
  first.textContent = "A";
  const second = document.createElement("span");
  second.textContent = "B";
  document.body.append(first, second);

  expect(
    scanRootForCurrencyActivationSignal(document.body, {
      maxTextNodes: 2,
      maxCharacters: 2,
    }),
  ).toBe("clear");
});

test("root scan does not charge ignored and non-text nodes to budgets", () => {
  const ignoredScript = document.createElement("script");
  ignoredScript.textContent = "const ignoredPrice = '$999';";
  const ignoredSpan = document.createElement("span");
  ignoredSpan.dataset.fxInlineIgnore = "";
  ignoredSpan.textContent = "$888";
  const eligible = document.createElement("span");
  eligible.textContent = "A";
  document.body.append(ignoredScript, ignoredSpan, eligible);
  document.body.prepend(document.createComment("$777"));

  expect(
    scanRootForCurrencyActivationSignal(document.body, {
      maxTextNodes: 1,
      maxCharacters: 1,
    }),
  ).toBe("clear");
});

test("root scan excludes page ignore and inline conversion output ancestors", () => {
  document.body.innerHTML = [
    '<section data-fx-inline-ignore><p>$111</p></section>',
    '<section><p data-fx-inline-ignore>$222</p></section>',
    '<section class="fx-inline-conversion"><span>$333</span></section>',
    '<section><span class="ccx-inline-conversion">$444</span></section>',
    "<main><p>No price here</p></main>",
  ].join("");

  const textContentGet = jest.spyOn(Node.prototype, "textContent", "get");
  const dataGet = jest.spyOn(Text.prototype, "data", "get");

  expect(scanRootForCurrencyActivationSignal(document.body)).toBe("clear");
  expect(textContentGet).not.toHaveBeenCalled();
  expect(dataGet).toHaveBeenCalledTimes(1);
});

test("root scan keeps non-requested activation exclusions out", () => {
  for (const fixture of [
    "<button>Now $25</button>",
    "<code>Now $25</code>",
    "<pre>Now $25</pre>",
    "<div hidden>Now $25</div>",
    '<div contenteditable="true">Now $25</div>',
  ]) {
    document.body.innerHTML = fixture;
    expect(scanRootForCurrencyActivationSignal(document.body)).toBe("signal");
  }
});

test("root scan reports exhausted only after finding more eligible text", () => {
  const first = document.createElement("span");
  first.textContent = "A";
  const second = document.createElement("span");
  second.textContent = "B";
  document.body.append(first, second);

  expect(
    scanRootForCurrencyActivationSignal(document.body, {
      maxTextNodes: 1,
      maxCharacters: 5,
    }),
  ).toBe("exhausted");
});

test("root scan checks a partial final text node prefix before exhaustion", () => {
  document.body.textContent = "$25 per night";

  expect(
    scanRootForCurrencyActivationSignal(document.body, {
      maxCharacters: 3,
    }),
  ).toBe("signal");

  document.body.textContent = "Only USD 25";

  expect(
    scanRootForCurrencyActivationSignal(document.body, {
      maxCharacters: 8,
    }),
  ).toBe("exhausted");
});

test("mutation scan checks added nodes and character data updates", () => {
  const ignoredScript = document.createElement("script");
  ignoredScript.textContent = "const price = '$999'";
  const priceNode = document.createElement("span");
  priceNode.textContent = "Only £19";
  const dynamicPriceText = document.createTextNode("Deal price ₹1,299");

  expect(
    scanMutations([
      { addedNodes: [ignoredScript] },
    ]),
  ).toBe("clear");
  expect(
    scanMutations([
      { addedNodes: [priceNode] },
    ]),
  ).toBe("signal");
  expect(
    scanMutations([
      { type: "characterData", target: dynamicPriceText, addedNodes: [] },
    ]),
  ).toBe("signal");
});

test("mutation scan detects added split price containers", () => {
  const result = document.createElement("div");
  result.innerHTML = `
    <h2>ScotchBrite Scrub Pad</h2>
    <span>
      <span>₹</span>
      <span>75</span>
    </span>
  `;

  expect(
    scanMutations([
      { type: "childList", addedNodes: [result] },
    ]),
  ).toBe("signal");
});

test("mutation scan detects split price fragments delivered together", () => {
  const symbolNode = document.createElement("span");
  symbolNode.textContent = "₹";
  const amountNode = document.createElement("span");
  amountNode.textContent = "75";

  expect(
    scanMutations([
      { type: "childList", addedNodes: [symbolNode, amountNode] },
    ]),
  ).toBe("signal");
});

test("character data scan detects split price in changed text context", () => {
  const price = document.createElement("div");
  const symbol = document.createElement("span");
  const amount = document.createElement("span");
  const symbolText = document.createTextNode("₹");
  const amountText = document.createTextNode("Loading");
  symbol.append(symbolText);
  amount.append(amountText);
  price.append(symbol, amount);
  document.body.append(price);

  amountText.data = "75";

  expect(
    scanMutations([
      { type: "characterData", target: amountText, addedNodes: [] },
    ]),
  ).toBe("signal");
});

test("character data context keeps DOM order around changed text", () => {
  const price = document.createElement("div");
  const symbol = document.createElement("span");
  const amount = document.createElement("span");
  const symbolText = document.createTextNode("Loading");
  const amountText = document.createTextNode("75");
  symbol.append(symbolText);
  amount.append(amountText);
  price.append(symbol, amount);
  document.body.append(price);

  symbolText.data = "₹";

  expect(
    scanMutations([
      { type: "characterData", target: symbolText, addedNodes: [] },
    ]),
  ).toBe("signal");
});

test("character data context limits neighbor text reads to four per side", () => {
  const price = document.createElement("div");
  const beforeNodes = Array.from({ length: 5 }, () =>
    document.createTextNode("before"),
  );
  const changedText = document.createTextNode("changed");
  const afterNodes = Array.from({ length: 5 }, () =>
    document.createTextNode("after"),
  );
  price.append(...beforeNodes, changedText, ...afterNodes);
  document.body.append(price);
  const dataGet = jest.spyOn(Text.prototype, "data", "get");
  const textContentGet = jest.spyOn(Node.prototype, "textContent", "get");

  expect(
    scanMutations([
      { type: "characterData", target: changedText, addedNodes: [] },
    ]),
  ).toBe("clear");
  expect(dataGet).toHaveBeenCalledTimes(9);
  expect(textContentGet).not.toHaveBeenCalled();
});

test("character data context uses shared mutation text-node budget", () => {
  const price = document.createElement("div");
  const symbol = document.createTextNode("₹");
  const amount = document.createTextNode("75");
  price.append(symbol, amount);
  document.body.append(price);

  expect(
    scanMutations(
      [{ type: "characterData", target: amount, addedNodes: [] }],
      { maxTextNodes: 1 },
    ),
  ).toBe("exhausted");
});

test("character data context keeps the rolling text window bounded", () => {
  const price = document.createElement("div");
  const oldNumber = document.createTextNode(`25${",".repeat(520)}`);
  const changedCode = document.createTextNode("USD");
  price.append(oldNumber, changedCode);
  document.body.append(price);

  expect(
    scanMutations([
      { type: "characterData", target: changedCode, addedNodes: [] },
    ]),
  ).toBe("clear");
});

test("separate changed areas do not combine split fragments by delivery order", () => {
  const symbolArea = document.createElement("section");
  const amountArea = document.createElement("section");
  const symbolText = document.createTextNode("₹");
  const amountText = document.createTextNode("75");
  symbolArea.append(symbolText);
  amountArea.append(amountText);
  document.body.append(symbolArea, amountArea);

  expect(
    scanMutationChangedAreasForCurrencyActivationSignal([
      { type: "addedNodes", nodes: [symbolArea] },
      { type: "addedNodes", nodes: [amountArea] },
    ]),
  ).toBe("clear");
});

test("mixed childList and characterData changes use one shared batch budget", () => {
  const price = document.createElement("div");
  const symbol = document.createTextNode("₹");
  const amount = document.createTextNode("75");
  price.append(symbol, amount);
  document.body.append(price);

  expect(
    scanMutationChangedAreasForCurrencyActivationSignal(
      [
        { type: "addedNodes", nodes: [document.createTextNode("loading")] },
        { type: "characterData", node: amount },
      ],
      { maxTextNodes: 1 },
    ),
  ).toBe("exhausted");
});

test("mutation changed areas use a shared bounded scan budget", () => {
  const filledAreas = Array.from({ length: 1_000 }, () => ({
    type: "addedNodes",
    nodes: [document.createTextNode("x")],
  }));
  const priceArea = {
    type: "addedNodes",
    nodes: [document.createTextNode("Only USD 25")],
  };

  expect(
    scanMutationChangedAreasForCurrencyActivationSignal([
      {
        type: "addedNodes",
        nodes: [document.createTextNode("Only USD 25")],
      },
      {
        type: "addedNodes",
        nodes: [document.createTextNode("unscanned")],
      },
    ]),
  ).toBe("signal");
  expect(
    scanMutationChangedAreasForCurrencyActivationSignal([
      ...filledAreas,
      priceArea,
    ]),
  ).toBe("exhausted");
});

test("mutation changed area checks partial boundary text before exhaustion", () => {
  const boundaryText = document.createTextNode("Only USD 25");

  expect(
    scanMutationChangedAreasForCurrencyActivationSignal(
      [{ type: "addedNodes", nodes: [boundaryText] }],
      { maxCharacters: 11 },
    ),
  ).toBe("signal");
  expect(
    scanMutationChangedAreasForCurrencyActivationSignal(
      [{ type: "addedNodes", nodes: [boundaryText] }],
      { maxCharacters: 9 },
    ),
  ).toBe("exhausted");
});

test("mutation childList scan avoids target and element textContent reads", () => {
  const container = document.createElement("section");
  container.textContent = "x".repeat(30_000);
  const addedNode = document.createElement("span");
  addedNode.append(document.createTextNode("Now $25"));

  const textContentGet = jest.spyOn(Node.prototype, "textContent", "get");

  expect(
    scanMutations([
      { type: "childList", target: container, addedNodes: [addedNode] },
    ]),
  ).toBe("signal");
  expect(textContentGet).not.toHaveBeenCalled();
});

test("mutation scan excludes page ignore and inline conversion output ancestors", () => {
  const ignored = document.createElement("section");
  ignored.dataset.fxInlineIgnore = "";
  ignored.append(document.createElement("span"));
  ignored.firstElementChild.append(document.createTextNode("$111"));
  const currentOutput = document.createElement("section");
  currentOutput.className = "fx-inline-conversion";
  currentOutput.append(document.createElement("span"));
  currentOutput.firstElementChild.append(document.createTextNode("$222"));
  const oldOutput = document.createElement("section");
  oldOutput.className = "ccx-inline-conversion";
  oldOutput.append(document.createElement("span"));
  oldOutput.firstElementChild.append(document.createTextNode("$333"));
  const eligible = document.createElement("section");
  eligible.append(document.createTextNode("No price"));

  const textContentGet = jest.spyOn(Node.prototype, "textContent", "get");
  const dataGet = jest.spyOn(Text.prototype, "data", "get");

  expect(
    scanMutations([
      { type: "childList", addedNodes: [ignored.firstElementChild] },
      { type: "childList", addedNodes: [currentOutput.firstElementChild] },
      { type: "childList", addedNodes: [oldOutput.firstElementChild] },
      { type: "childList", addedNodes: [eligible] },
    ]),
  ).toBe("clear");
  expect(textContentGet).not.toHaveBeenCalled();
  expect(dataGet).toHaveBeenCalledTimes(1);
});

test("mutation scan keeps text node and character work inside configured budgets", () => {
  const nodes = Array.from({ length: 5 }, () => document.createTextNode("x"));
  const price = document.createTextNode("USD 25");

  const dataGet = jest.spyOn(Text.prototype, "data", "get");
  const textContentGet = jest.spyOn(Node.prototype, "textContent", "get");

  expect(
    scanMutationChangedAreasForCurrencyActivationSignal(
      [{ type: "addedNodes", nodes }],
      { maxTextNodes: 3, maxCharacters: 20 },
    ),
  ).toBe("exhausted");
  expect(dataGet).toHaveBeenCalledTimes(3);
  expect(textContentGet).not.toHaveBeenCalled();

  dataGet.mockClear();

  expect(
    scanMutationChangedAreasForCurrencyActivationSignal(
      [{ type: "addedNodes", nodes: [price] }],
      { maxTextNodes: 10, maxCharacters: 3 },
    ),
  ).toBe("exhausted");
  expect(dataGet).toHaveBeenCalledTimes(1);
  expect(textContentGet).not.toHaveBeenCalled();
});

test("mutation changed area stops scanning after first added price", () => {
  const first = document.createTextNode("Now $25");
  const later = document.createTextNode("unscanned");
  Object.defineProperty(later, "data", {
    get() {
      throw new Error("later changed area scanned");
    },
  });

  expect(
    scanMutationChangedAreasForCurrencyActivationSignal([
      { type: "addedNodes", nodes: [first] },
      { type: "addedNodes", nodes: [later] },
    ]),
  ).toBe("signal");
});

test("changed node frontier stores identical changed nodes once", () => {
  const text = document.createTextNode("Loading");
  document.body.append(text);
  const frontier = createMutationActivationChangedNodeFrontier(document.body);

  frontier.addMutations([
    { type: "characterData", target: text, addedNodes: [] },
    { type: "characterData", target: text, addedNodes: [] },
  ]);

  const drainResult = frontier.drain();

  expect(drainResult.result).toBe("clear");
  expect(drainResult.changedAreas).toEqual([
    { type: "characterData", node: text },
  ]);
});

test("changed node frontier avoids repeated text reads for repeated mutation targets", () => {
  const text = document.createTextNode("Loading");
  document.body.append(text);
  const dataGet = jest.spyOn(Text.prototype, "data", "get");
  const frontier = createMutationActivationChangedNodeFrontier(document.body);

  frontier.addMutations([
    { type: "characterData", target: text, addedNodes: [] },
    { type: "characterData", target: text, addedNodes: [] },
  ]);

  const drainResult = frontier.drain();

  expect(
    scanMutationChangedAreasForCurrencyActivationSignal(
      drainResult.changedAreas,
    ),
  ).toBe("clear");
  expect(dataGet).toHaveBeenCalledTimes(1);
});

test("changed node frontier replaces a pending descendant with its ancestor", () => {
  const card = document.createElement("article");
  const price = document.createElement("span");
  price.textContent = "Loading";
  card.append(price);
  document.body.append(card);
  const frontier = createMutationActivationChangedNodeFrontier(document.body);

  frontier.addMutations([{ type: "childList", addedNodes: [price] }]);
  frontier.addMutations([{ type: "childList", addedNodes: [card] }]);

  const drainResult = frontier.drain();

  expect(drainResult.result).toBe("clear");
  expect(drainResult.changedAreas).toEqual([
    { type: "addedNodes", nodes: [card] },
  ]);
});

test("changed node frontier does not widen unrelated nodes to a shared ancestor", () => {
  const parent = document.createElement("section");
  const left = document.createElement("span");
  const right = document.createElement("span");
  parent.append(left, right);
  document.body.append(parent);
  const frontier = createMutationActivationChangedNodeFrontier(document.body);

  frontier.addMutations([{ type: "childList", addedNodes: [left] }]);
  frontier.addMutations([{ type: "childList", addedNodes: [right] }]);

  const drainResult = frontier.drain();

  expect(drainResult.result).toBe("clear");
  expect(drainResult.changedAreas).toEqual([
    { type: "addedNodes", nodes: [left] },
    { type: "addedNodes", nodes: [right] },
  ]);
});

test("changed node frontier marks exhaustion at its retention limit", () => {
  const nodes = Array.from({ length: 1_001 }, () =>
    document.createTextNode("x"),
  );
  document.body.append(...nodes);
  const frontier = createMutationActivationChangedNodeFrontier(document.body);

  frontier.addMutations([{ type: "childList", addedNodes: nodes }]);

  expect(frontier.size).toBe(1_000);
  expect(frontier.exhausted).toBe(true);
  expect(frontier.drain()).toEqual({
    result: "exhausted",
    changedAreas: [],
  });
  expect(frontier.size).toBe(0);
});

test("changed node frontier discards nodes that leave the observed area", () => {
  const price = document.createElement("span");
  price.textContent = "Now $25";
  document.body.append(price);
  const frontier = createMutationActivationChangedNodeFrontier(document.body);

  frontier.addMutations([{ type: "childList", addedNodes: [price] }]);
  price.remove();

  expect(frontier.drain()).toEqual({
    result: "clear",
    changedAreas: [],
  });
});

test("changed node frontier scans moved nodes in current document order", () => {
  const amount = document.createElement("span");
  amount.textContent = "75";
  const symbol = document.createElement("span");
  symbol.textContent = "₹";
  document.body.append(amount, symbol);
  const frontier = createMutationActivationChangedNodeFrontier(document.body);

  frontier.addMutations([
    { type: "childList", addedNodes: [amount, symbol] },
    { type: "childList", addedNodes: [amount] },
  ]);
  document.body.prepend(symbol);

  const drainResult = frontier.drain();

  expect(drainResult.changedAreas).toEqual([
    { type: "addedNodes", nodes: [symbol, amount] },
  ]);
  expect(
    scanMutationChangedAreasForCurrencyActivationSignal(
      drainResult.changedAreas,
    ),
  ).toBe("signal");
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
    characterData: true,
    subtree: true,
  });

  const addedNode = document.createElement("p");
  addedNode.textContent = "Now only $25";
  document.body.append(addedNode);
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

test("activation controller uses one fixed mutation batch window", async () => {
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

  createContentActivationController(ctx, {
    document,
    locationHref: "https://example.com/",
    importContentWorker,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
    createMutationObserver,
  }).start();

  const loadingText = document.createTextNode("Loading");
  document.body.append(loadingText);
  mutationCallback([
    {
      type: "childList",
      addedNodes: [loadingText],
    },
  ]);
  jest.advanceTimersByTime(200);
  const priceText = document.createTextNode("Now $25");
  document.body.append(priceText);
  mutationCallback([
    {
      type: "childList",
      addedNodes: [priceText],
    },
  ]);

  jest.advanceTimersByTime(49);
  expect(importContentWorker).not.toHaveBeenCalled();

  jest.advanceTimersByTime(1);
  await Promise.resolve();
  await Promise.resolve();

  expect(importContentWorker).toHaveBeenCalledTimes(1);
  expect(observer.disconnect).toHaveBeenCalledTimes(1);
});

test("activation controller collects changed areas before mutation timer fires", async () => {
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

  createContentActivationController(ctx, {
    document,
    locationHref: "https://example.com/",
    importContentWorker,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
    createMutationObserver,
  }).start();

  let addedNodesReads = 0;
  const loadingText = document.createTextNode("Loading");
  document.body.append(loadingText);
  const mutation = {
    type: "childList",
    get addedNodes() {
      addedNodesReads += 1;
      return [loadingText];
    },
  };

  mutationCallback([mutation]);
  expect(addedNodesReads).toBe(1);

  jest.advanceTimersByTime(250);
  await Promise.resolve();
  await Promise.resolve();

  expect(addedNodesReads).toBe(1);
  expect(importContentWorker).not.toHaveBeenCalled();
});

test("activation controller loads worker after exhausted mutation scan", async () => {
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

  createContentActivationController(ctx, {
    document,
    locationHref: "https://example.com/",
    importContentWorker,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
    createMutationObserver,
  }).start();

  const largeContainer = document.createElement("div");
  for (let index = 0; index < 1_001; index += 1) {
    largeContainer.append(document.createTextNode("x"));
  }
  document.body.append(largeContainer);

  mutationCallback([
    {
      type: "childList",
      addedNodes: Array.from(largeContainer.childNodes),
    },
  ]);

  jest.advanceTimersByTime(250);
  await Promise.resolve();
  await Promise.resolve();

  expect(importContentWorker).toHaveBeenCalledTimes(1);
  expect(observer.disconnect).toHaveBeenCalledTimes(1);
});

test("activation controller keeps observing after clear mutation scan", async () => {
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

  createContentActivationController(ctx, {
    document,
    locationHref: "https://example.com/",
    importContentWorker,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
    createMutationObserver,
  }).start();

  const loadingText = document.createTextNode("Loading");
  document.body.append(loadingText);
  mutationCallback([
    {
      type: "childList",
      addedNodes: [loadingText],
    },
  ]);
  jest.advanceTimersByTime(250);
  await Promise.resolve();
  await Promise.resolve();

  expect(importContentWorker).not.toHaveBeenCalled();
  expect(observer.disconnect).not.toHaveBeenCalled();

  const priceText = document.createTextNode("Now $25");
  document.body.append(priceText);
  mutationCallback([
    {
      type: "childList",
      addedNodes: [priceText],
    },
  ]);
  jest.advanceTimersByTime(250);
  await Promise.resolve();
  await Promise.resolve();

  expect(importContentWorker).toHaveBeenCalledTimes(1);
  expect(observer.disconnect).toHaveBeenCalledTimes(1);
});

test("activation controller discards disconnected frontier nodes before scanning", async () => {
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

  createContentActivationController(ctx, {
    document,
    locationHref: "https://example.com/",
    importContentWorker,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
    createMutationObserver,
  }).start();

  const removedPrice = document.createElement("p");
  removedPrice.textContent = "Now only $25";
  document.body.append(removedPrice);
  mutationCallback([{ type: "childList", addedNodes: [removedPrice] }]);
  removedPrice.remove();

  jest.advanceTimersByTime(250);
  await Promise.resolve();
  await Promise.resolve();

  expect(importContentWorker).not.toHaveBeenCalled();
  expect(observer.disconnect).not.toHaveBeenCalled();
});

test("activation controller disposal cancels frontier scan and worker load", async () => {
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

  const price = document.createElement("p");
  price.textContent = "Now only $25";
  document.body.append(price);
  mutationCallback([{ type: "childList", addedNodes: [price] }]);

  controller.dispose();
  jest.advanceTimersByTime(250);
  await Promise.resolve();
  await Promise.resolve();

  expect(importContentWorker).not.toHaveBeenCalled();
  expect(observer.disconnect).toHaveBeenCalledTimes(1);
});

test("activation controller starts immediately on existing split listing prices", async () => {
  const { ctx } = createLifecycleContext();
  const importContentWorker = jest.fn().mockResolvedValue(undefined);
  const createMutationObserver = jest.fn();

  document.body.innerHTML = `
    <main>
      <span>
        <span>₹</span>
        <span>75</span>
      </span>
    </main>
  `;

  createContentActivationController(ctx, {
    document,
    locationHref: "https://example.com/search",
    importContentWorker,
    createMutationObserver,
  }).start();

  await Promise.resolve();
  await Promise.resolve();

  expect(importContentWorker).toHaveBeenCalledTimes(1);
  expect(importContentWorker).toHaveBeenCalledWith({});
  expect(createMutationObserver).not.toHaveBeenCalled();
});

test("activation controller keeps worker lazy after exhausted initial scan", async () => {
  const { ctx } = createLifecycleContext();
  const importContentWorker = jest.fn().mockResolvedValue(undefined);
  const observer = {
    observe: jest.fn(),
    disconnect: jest.fn(),
  };
  const createMutationObserver = jest.fn(() => observer);

  document.body.textContent = "x".repeat(20_001);

  createContentActivationController(ctx, {
    document,
    locationHref: "https://example.com/search",
    importContentWorker,
    createMutationObserver,
  }).start();

  await Promise.resolve();
  await Promise.resolve();

  expect(importContentWorker).not.toHaveBeenCalled();
  expect(observer.observe).toHaveBeenCalledWith(document.body, {
    childList: true,
    characterData: true,
    subtree: true,
  });
});

test("activation controller lazy-loads worker when a text node becomes a price", async () => {
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

  const dynamicPriceText = document.createTextNode("Loading deal");
  const priceElement = document.createElement("span");
  priceElement.append(dynamicPriceText);
  document.body.append(priceElement);

  createContentActivationController(ctx, {
    document,
    locationHref: "https://example.com/",
    importContentWorker,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
    createMutationObserver,
  }).start();

  expect(importContentWorker).not.toHaveBeenCalled();

  dynamicPriceText.data = "Limited deal ₹1,299";
  mutationCallback([
    { type: "characterData", target: dynamicPriceText, addedNodes: [] },
  ]);

  jest.advanceTimersByTime(250);
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
