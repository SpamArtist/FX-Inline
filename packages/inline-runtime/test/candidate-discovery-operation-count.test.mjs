/** @jest-environment jsdom */

import { convertVisiblePrices } from "../src/index.js";
import { shouldSkipTextNode } from "../src/core/domGuards.js";
import { createInlinePassContext } from "../src/core/passContext.js";
import {
  PRICE_TEXT_CLASS_UNRELATED,
  classifyPriceText,
} from "../src/core/priceTextClassification.js";
import { ensureInlineConversionStyles } from "../src/core/styles.js";
import { decoratePricesInTextNode } from "../src/core/textNodeDecorator.js";

function createRateSnapshot() {
  return {
    base: "USD",
    fetchedAt: Date.now(),
    rates: {
      USD: 1,
      EUR: 0.9,
    },
  };
}

function appendNestedText(parent, id, text, depth = 8) {
  let cursor = parent;
  for (let level = 0; level < depth; level += 1) {
    const wrapper = document.createElement("span");
    wrapper.dataset.depth = String(level);
    cursor.append(wrapper);
    cursor = wrapper;
  }
  cursor.id = id;
  cursor.append(document.createTextNode(text));
  return cursor;
}

function buildDeepTextHeavyFixture() {
  const root = document.createElement("main");
  root.id = "fixture-root";

  for (let index = 0; index < 350; index += 1) {
    appendNestedText(
      root,
      `copy-${index}`,
      `Editorial paragraph ${index} with many words and no price marker.`,
    );
  }

  appendNestedText(root, "direct-price-a", "Pay $100 today.");
  appendNestedText(root, "direct-price-b", "Renew for $200 later.");

  const splitPrice = document.createElement("p");
  splitPrice.id = "split-price";
  const splitCurrency = document.createElement("span");
  splitCurrency.id = "split-currency";
  splitCurrency.append(document.createTextNode("USD"));
  const splitAmount = document.createElement("span");
  splitAmount.id = "split-amount";
  splitAmount.append(document.createTextNode("1,234.50"));
  splitPrice.append(splitCurrency, splitAmount);
  root.append(splitPrice);

  const repeatedParent = document.createElement("p");
  repeatedParent.id = "repeated-parent";
  repeatedParent.append(
    document.createTextNode("$12"),
    document.createComment("split"),
    document.createTextNode("$13"),
  );
  root.append(repeatedParent);

  const hidden = document.createElement("p");
  hidden.hidden = true;
  hidden.id = "hidden-price";
  hidden.append(document.createTextNode("$300"));
  root.append(hidden);

  const editable = document.createElement("p");
  editable.setAttribute("contenteditable", "true");
  editable.id = "editable-price";
  editable.append(document.createTextNode("$400"));
  root.append(editable);

  const script = document.createElement("script");
  script.id = "script-price";
  script.type = "text/plain";
  script.append(document.createTextNode("$500"));
  root.append(script);

  const existingWrapperParent = document.createElement("p");
  existingWrapperParent.id = "existing-price";
  const existingWrapper = document.createElement("span");
  existingWrapper.className = "fx-inline-conversion";
  existingWrapper.dataset.original = "$600";
  existingWrapper.append(document.createTextNode("$600"));
  existingWrapperParent.append(existingWrapper);
  root.append(existingWrapperParent);

  return root;
}

function withAncestorSearchCount(callback) {
  const originalClosest = Element.prototype.closest;
  let ancestorSearches = 0;

  Element.prototype.closest = function countTextEligibilityClosest(selector) {
    if (
      selector.includes('[contenteditable]:not([contenteditable="false"])') &&
      selector.includes('[class*="visually-hidden"]') &&
      selector.includes(".fx-inline-conversion")
    ) {
      ancestorSearches += 1;
    }
    return originalClosest.call(this, selector);
  };

  try {
    const result = callback();
    return {
      ...result,
      ancestorSearches,
    };
  } finally {
    Element.prototype.closest = originalClosest;
  }
}

function runCurrentCandidateDiscovery(root) {
  const conversions = convertVisiblePrices("EUR", createRateSnapshot(), root, {
    clearExisting: false,
    includeDefaultPrePlugins: false,
    includeDefaultPostPlugins: false,
  });

  return {
    conversions,
  };
}

function runLegacyCandidateDiscoveryOrder(root) {
  const preferredCurrency = "EUR";
  const rateSnapshot = createRateSnapshot();
  const passContext = createInlinePassContext();
  const passId = passContext.passId;
  const localeHint = document.documentElement?.lang || null;
  const lightTextCache = new WeakMap();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const acceptedTextCandidates = [];
  let visitedTextNodes = 0;

  ensureInlineConversionStyles();

  try {
    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      visitedTextNodes += 1;
      if (shouldSkipTextNode(textNode)) continue;

      const classification = classifyPriceText(textNode.nodeValue);
      if (classification.kind === PRICE_TEXT_CLASS_UNRELATED) continue;

      acceptedTextCandidates.push({
        textNode,
        kind: classification.kind,
        text: classification.text,
      });
    }

    let conversions = 0;
    for (const candidate of acceptedTextCandidates) {
      conversions += decoratePricesInTextNode(
        candidate,
        preferredCurrency,
        rateSnapshot,
        localeHint,
        lightTextCache,
        passContext,
        passId,
        null,
        null,
      );
    }

    return {
      visitedTextNodes,
      acceptedCandidates: acceptedTextCandidates.length,
      conversions,
    };
  } finally {
    passContext.clear();
  }
}

function readConversionOriginals(root) {
  return Array.from(root.querySelectorAll(".fx-inline-conversion"))
    .map((wrapper) => wrapper.getAttribute("data-original"))
    .sort();
}

beforeEach(() => {
  document.documentElement.lang = "en-US";
  document.body.innerHTML = "";
  document.getElementById("fx-inline-conversion-style")?.remove();
});

test("compares current Candidate Discovery operation counts against legacy order", () => {
  const oldRoot = buildDeepTextHeavyFixture();
  const newRoot = oldRoot.cloneNode(true);
  document.body.append(oldRoot);

  const oldResult = withAncestorSearchCount(() =>
    runLegacyCandidateDiscoveryOrder(oldRoot),
  );

  document.body.replaceChildren(newRoot);

  const newResult = withAncestorSearchCount(() =>
    runCurrentCandidateDiscovery(newRoot),
  );

  expect(newResult).toEqual({
    conversions: oldResult.conversions,
    ancestorSearches: 7,
  });
  expect(oldResult).toEqual({
    visitedTextNodes: 360,
    acceptedCandidates: 5,
    conversions: 5,
    ancestorSearches: 359,
  });
  expect(readConversionOriginals(newRoot)).toEqual(readConversionOriginals(oldRoot));
  expect(newRoot.querySelector("#hidden-price .fx-inline-conversion")).toBeNull();
  expect(newRoot.querySelector("#editable-price .fx-inline-conversion")).toBeNull();
  expect(newRoot.querySelector("#script-price .fx-inline-conversion")).toBeNull();
  expect(newRoot.querySelectorAll("#existing-price .fx-inline-conversion")).toHaveLength(
    1,
  );
  expect(newResult.ancestorSearches).toBeLessThan(oldResult.ancestorSearches);
});
