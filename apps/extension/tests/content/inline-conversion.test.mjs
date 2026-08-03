import {
  INLINE_CONVERSION_CLASS,
  convertVisiblePrices,
} from "../../test-dist/entrypoints/content/inlineConversion.js";
import { suppressInlineConversions } from "@fx-inline/inline-runtime";

function createRateSnapshot(overrides = {}) {
  const baseSnapshot = {
    base: "USD",
    fetchedAt: Date.now(),
    rates: {
      USD: 1,
      EUR: 0.9,
      INR: 83,
      VND: 25000,
    },
  };

  return {
    ...baseSnapshot,
    ...overrides,
    rates: {
      ...baseSnapshot.rates,
      ...(overrides.rates || {}),
    },
  };
}

beforeEach(() => {
  document.documentElement.lang = "en-US";
  document.body.innerHTML = "";
  const styleTag = document.getElementById("fx-inline-conversion-style");
  styleTag?.remove();
});

test("converts text-node prices with the expected inline wrapper shape", () => {
  document.body.innerHTML = '<p id="price">Pay $100 now.</p>';

  const applied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
  });

  expect(applied).toBe(1);

  const wrapper = document.querySelector(`#price span.${INLINE_CONVERSION_CLASS}`);
  expect(wrapper).not.toBeNull();
  expect(wrapper.getAttribute("data-original")?.trim()).toBe("$100");
  expect(wrapper.textContent).toMatch(/^\$100\s+\(/);
  expect(wrapper.textContent.endsWith(")")).toBe(true);

  const convertedAmount = wrapper.querySelector(".fx-inline-converted-amount");
  expect(convertedAmount).not.toBeNull();
  expect(convertedAmount.textContent).toMatch(/^\(.+\)$/);
});

test("maxNodesPerPass skips unrelated text before counting accepted candidates", () => {
  const unrelatedItems = Array.from(
    { length: 200 },
    (_, index) => `<p>Listing copy ${index} without price markers.</p>`,
  );
  document.body.innerHTML = [
    ...unrelatedItems,
    '<p id="price">Pay $100 now.</p>',
    '<p id="later-price">Pay $200 later.</p>',
  ].join("");

  const samples = [];
  const applied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
    maxNodesPerPass: 1,
    onPerfSample: (sample) => {
      samples.push(sample);
    },
  });

  expect(applied).toBe(1);
  expect(document.querySelector(`#price span.${INLINE_CONVERSION_CLASS}`)).not.toBeNull();
  expect(document.querySelector(`#later-price span.${INLINE_CONVERSION_CLASS}`)).toBeNull();
  expect(samples[0].visitedTextNodes).toBe(201);
  expect(samples[0].acceptedCandidates).toBe(1);
  expect(samples[0].scannedTextNodes).toBe(1);
  expect(samples[0].reachedNodeLimit).toBe(true);
});

test("injects converted amount line-height and width styles", () => {
  document.body.innerHTML = '<p id="price">Pay $100 now.</p>';

  convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
  });

  const styleTag = document.getElementById("fx-inline-conversion-style");
  expect(styleTag).not.toBeNull();
  expect(styleTag.textContent).toMatch(/\.fx-inline-converted-amount\s*\{/);
  expect(styleTag.textContent).toContain("line-height: inherit !important;");
  expect(styleTag.textContent).toContain("width: fit-content !important;");
});

test("uses shared linearized light-text detection for inline conversion colors", () => {
  document.body.innerHTML = '<p id="price" style="color: rgb(180, 180, 180)">Pay $100 now.</p>';

  const applied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
  });

  expect(applied).toBe(1);

  const wrapper = document.querySelector(`#price span.${INLINE_CONVERSION_CLASS}`);
  expect(wrapper).not.toBeNull();
  expect(wrapper.style.getPropertyValue("--fx-inline-converted-color")).toBe("#355aa8");
});

test("converts unicode yen symbols in mixed listing text", () => {
  document.body.innerHTML = [
    '<h5 id="listing">',
    '  <a href="/en/property/1545984">',
    "    ￥39,000",
    '    <span>Management fee：<span class="fx-inline-conversion" data-original="¥6,500">¥6,500 (<span class="fx-inline-converted-amount">₹3,806.20</span>)</span></span>',
    "  </a>",
    "</h5>",
  ].join("\n");

  const applied = convertVisiblePrices(
    "INR",
    createRateSnapshot({ rates: { JPY: 110 } }),
    document.body,
    {
      clearExisting: false,
    },
  );

  expect(applied).toBe(1);

  const listingWrappers = document.querySelectorAll(
    `#listing span.${INLINE_CONVERSION_CLASS}`,
  );
  expect(listingWrappers).toHaveLength(2);

  const convertedMainPrice = document.querySelector(
    '#listing span.fx-inline-conversion[data-original="￥39,000"]',
  );
  expect(convertedMainPrice).not.toBeNull();
  expect(convertedMainPrice.textContent).toMatch(/^￥39,000\s+\(.+\)$/);

  const existingFeeWrapper = document.querySelector(
    '#listing span.fx-inline-conversion[data-original="¥6,500"]',
  );
  expect(existingFeeWrapper).not.toBeNull();
  expect(existingFeeWrapper.querySelector(".fx-inline-converted-amount").textContent).toBe(
    "₹3,806.20",
  );
});

test("converts active Bolivia, Colombia, and Venezuela ISO price text", () => {
  document.body.innerHTML =
    '<p id="country-prices">BOB 69; COP 4000; VES 37</p>';

  const applied = convertVisiblePrices(
    "EUR",
    createRateSnapshot({
      rates: {
        BOB: 6.9,
        COP: 4000,
        VES: 37,
      },
    }),
    document.body,
    {
      clearExisting: false,
    },
  );

  expect(applied).toBe(3);

  const wrappers = Array.from(
    document.querySelectorAll(`#country-prices span.${INLINE_CONVERSION_CLASS}`),
  );
  expect(wrappers.map((wrapper) => wrapper.getAttribute("data-original"))).toEqual([
    "BOB 69",
    "COP 4000",
    "VES 37",
  ]);
  expect(
    wrappers.map((wrapper) =>
      wrapper.querySelector(".fx-inline-converted-amount").textContent,
    ),
  ).toEqual(["(€9.00)", "(€0.90)", "(€0.90)"]);
});

test("refreshes existing wrappers in place and clears wrappers when requested", () => {
  document.body.innerHTML = '<p id="price">Price: $100</p>';

  const initialApplied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
  });
  expect(initialApplied).toBe(1);

  const initialWrapper = document.querySelector(`#price span.${INLINE_CONVERSION_CLASS}`);
  expect(initialWrapper).not.toBeNull();

  const initialConvertedText = initialWrapper
    .querySelector(".fx-inline-converted-amount")
    .textContent;
  expect(initialConvertedText).toMatch(/^\(.+\)$/);
  const initialConvertedNode = initialWrapper.querySelector(".fx-inline-converted-amount");

  const refreshedApplied = convertVisiblePrices(
    "EUR",
    createRateSnapshot({ rates: { EUR: 0.75 } }),
    document.body,
    {
      clearExisting: false,
      refreshExisting: true,
    },
  );

  expect(refreshedApplied).toBe(1);

  const refreshedWrapper = document.querySelector(`#price span.${INLINE_CONVERSION_CLASS}`);
  expect(refreshedWrapper).toBe(initialWrapper);
  expect(refreshedWrapper.querySelector(".fx-inline-converted-amount")).toBe(
    initialConvertedNode,
  );

  const refreshedConvertedText = refreshedWrapper
    .querySelector(".fx-inline-converted-amount")
    .textContent;
  expect(refreshedConvertedText).not.toBe(initialConvertedText);
  expect(refreshedConvertedText).toMatch(/^\(.+\)$/);

  const clearedApplied = convertVisiblePrices("USD", createRateSnapshot(), document.body);
  expect(clearedApplied).toBe(0);
  expect(document.querySelector(`#price span.${INLINE_CONVERSION_CLASS}`)).toBeNull();
  expect(document.getElementById("price").textContent).toContain("$100");
});

test("suppresses and restores wrappers without replacing converted-amount node", () => {
  document.body.innerHTML = '<p id="price">Price: $100</p>';

  const initialApplied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
  });
  expect(initialApplied).toBe(1);

  const wrapper = document.querySelector(`#price span.${INLINE_CONVERSION_CLASS}`);
  const convertedNode = wrapper.querySelector(".fx-inline-converted-amount");
  expect(convertedNode).not.toBeNull();

  const suppressedCount = suppressInlineConversions(document.body);
  expect(suppressedCount).toBe(1);
  expect(wrapper.querySelector(".fx-inline-converted-amount")).toBe(convertedNode);
  expect(wrapper.firstChild.nodeValue).toBe("$100");
  expect(wrapper.lastChild.nodeValue).toBe("");
  expect(convertedNode.style.display).toBe("none");

  convertVisiblePrices(
    "EUR",
    createRateSnapshot({ rates: { EUR: 0.75 } }),
    document.body,
    {
      clearExisting: false,
      refreshExisting: true,
    },
  );

  expect(wrapper.querySelector(".fx-inline-converted-amount")).toBe(convertedNode);
  expect(convertedNode.style.display).toBe("");
  expect(wrapper.textContent).toMatch(/^\$100\s+\(.+\)$/);
});

test("skips editable, non-visible, and already-converted wrapper contexts", () => {
  document.body.innerHTML = [
    '<div id="editable" contenteditable="true">$100</div>',
    '<div id="hidden" class="visually-hidden">$200</div>',
    '<div id="existing"><span class="fx-inline-conversion" data-original="$300"><span class="fx-inline-converted-amount">€270.00</span></span></div>',
    '<p id="plain">$400</p>',
  ].join("");

  const applied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
  });

  expect(applied).toBe(1);
  expect(document.querySelector(`#editable span.${INLINE_CONVERSION_CLASS}`)).toBeNull();
  expect(document.querySelector(`#hidden span.${INLINE_CONVERSION_CLASS}`)).toBeNull();

  const existingWrappers = document.querySelectorAll(`#existing span.${INLINE_CONVERSION_CLASS}`);
  expect(existingWrappers).toHaveLength(1);
  expect(existingWrappers[0].getAttribute("data-original")).toBe("$300");

  expect(document.querySelector(`#plain span.${INLINE_CONVERSION_CLASS}`)).not.toBeNull();
});

test("reuses one parent DOM eligibility result through the content conversion seam", () => {
  document.body.innerHTML = '<p id="prices">$100<!--split-->$200</p>';

  const originalClosest = Element.prototype.closest;
  let ancestorSearches = 0;
  Element.prototype.closest = function countClosest(selector) {
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
    const applied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
      clearExisting: false,
    });

    expect(applied).toBe(2);
    expect(
      document.querySelectorAll(`#prices span.${INLINE_CONVERSION_CLASS}`),
    ).toHaveLength(2);
    expect(ancestorSearches).toBe(1);
  } finally {
    Element.prototype.closest = originalClosest;
  }
});

test("adds structured add-on conversions for Amazon-style and sibling-symbol prices", () => {
  document.body.innerHTML = [
    '<span id="amazon-root" aria-hidden="true">',
    '  <span class="a-price-symbol">$</span>',
    '  <span class="a-price-whole">199</span>',
    '  <span class="a-price-decimal">.</span>',
    '  <span class="a-price-fraction">99</span>',
    '</span>',
    '<div>',
    '  <span aria-hidden="true" id="sibling-symbol">$</span>',
    '  <span aria-hidden="true" id="sibling-value">2500</span>',
    '</div>',
    '<div>',
    '  <span aria-hidden="true" id="sibling-value-word">990,000</span>',
    '  <span aria-hidden="true" id="sibling-word">yen/month</span>',
    '</div>',
  ].join("\n");

  const applied = convertVisiblePrices(
    "EUR",
    createRateSnapshot({ rates: { JPY: 110 } }),
    document.body,
    {
      clearExisting: false,
    },
  );
  expect(applied).toBeGreaterThanOrEqual(2);

  const amazonAddon = document.querySelector(
    '#amazon-root span.fx-inline-conversion[data-fx-inline-mode="addon"]',
  );
  expect(amazonAddon).not.toBeNull();
  expect(amazonAddon.getAttribute("data-original")).toBe("$199.99");
  expect(amazonAddon.querySelector(".fx-inline-converted-amount").textContent).toMatch(
    /^\(.+\)$/,
  );

  const siblingAddon = document.querySelector(
    '#sibling-value span.fx-inline-conversion[data-fx-inline-mode="addon"]',
  );
  expect(siblingAddon).not.toBeNull();
  expect(siblingAddon.getAttribute("data-original")).toBe("$2500");
  expect(siblingAddon.querySelector(".fx-inline-converted-amount").textContent).toMatch(
    /^\(.+\)$/,
  );

  const siblingWordAddon = document.querySelector(
    '#sibling-value-word span.fx-inline-conversion[data-fx-inline-mode="addon"]',
  );
  expect(siblingWordAddon).not.toBeNull();
  expect(siblingWordAddon.getAttribute("data-original")).toBe("990,000 yen");
  expect(
    siblingWordAddon.querySelector(".fx-inline-converted-amount").textContent,
  ).toMatch(/^\(.+\)$/);
});

test("does not duplicate amazon original amount text in addon by default", () => {
  document.body.innerHTML = [
    '<span class="a-price">',
    '  <span class="a-offscreen">¥4,680</span>',
    '  <span id="amazon-hidden-root" aria-hidden="true">',
    '    <span class="a-price-symbol">¥</span>',
    '    <span class="a-price-whole">4,680</span>',
    "  </span>",
    "</span>",
  ].join("\n");

  const applied = convertVisiblePrices(
    "EUR",
    createRateSnapshot({ rates: { JPY: 110 } }),
    document.body,
    {
      clearExisting: false,
    },
  );

  expect(applied).toBe(1);
  const addon = document.querySelector(
    '#amazon-hidden-root span.fx-inline-conversion[data-fx-inline-mode="addon"]',
  );
  expect(addon).not.toBeNull();
  expect(addon.textContent).not.toContain("¥4,680");
  expect(addon.querySelector(".fx-inline-converted-amount").textContent).toMatch(
    /^\(.+\)$/u,
  );
});

test("adds conversion when amount and yen/month token are split across sibling nodes", () => {
  document.body.innerHTML = [
    '<div class="price" id="split-yen">',
    "  from",
    '  <span class="bold">990,000</span>',
    "  yen/month",
    "</div>",
  ].join("\n");

  const applied = convertVisiblePrices(
    "EUR",
    createRateSnapshot({ rates: { JPY: 110 } }),
    document.body,
    {
      clearExisting: false,
    },
  );

  expect(applied).toBeGreaterThanOrEqual(1);

  const addon = document.querySelector(
    '#split-yen .bold span.fx-inline-conversion[data-fx-inline-mode="addon"]',
  );
  expect(addon).not.toBeNull();
  expect(addon.getAttribute("data-original")).toBe("990,000 yen");
  expect(addon.querySelector(".fx-inline-converted-amount").textContent).toMatch(
    /^\(.+\)$/,
  );
});

test("reports perf sample shape and node-limit metadata", () => {
  document.body.innerHTML = "<p>$100</p><p>$200</p><p>$300</p>";

  const samples = [];
  const applied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
    maxNodesPerPass: 1,
    onPerfSample: (sample) => {
      samples.push(sample);
    },
  });

  expect(samples).toHaveLength(1);

  const sample = samples[0];
  expect(sample.maxNodesPerPass).toBe(1);
  expect(sample.visitedTextNodes).toBe(1);
  expect(sample.acceptedCandidates).toBe(1);
  expect(sample.scannedTextNodes).toBe(1);
  expect(sample.reachedNodeLimit).toBe(true);
  expect(sample.conversionsApplied).toBe(applied);
  expect(sample.totalMs).toBeGreaterThanOrEqual(0);
  expect(sample.clearExistingMs).toBeGreaterThanOrEqual(0);
  expect(sample.scanTextNodesMs).toBeGreaterThanOrEqual(0);
  expect(sample.decorateNodesMs).toBeGreaterThanOrEqual(0);
});
