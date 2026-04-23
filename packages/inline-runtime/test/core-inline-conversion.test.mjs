/** @jest-environment jsdom */

import {
  amazonStructuredAddonPlugin,
  amazonStructuredRendererPostPlugin,
  convertVisiblePrices,
  suppressInlineConversions,
} from "../src/index.js";

const INLINE_CONVERSION_CLASS = "ccx-inline-conversion";

function createRateSnapshot(overrides = {}) {
  const baseSnapshot = {
    base: "USD",
    fetchedAt: Date.now(),
    rates: {
      USD: 1,
      EUR: 0.9,
      INR: 83,
      VND: 25000,
      JPY: 110,
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
  const styleTag = document.getElementById("ccx-inline-conversion-style");
  styleTag?.remove();
});

test("converts text-node prices with expected wrapper shape", () => {
  document.body.innerHTML = '<p id="price">Pay $100 now.</p>';

  const applied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
  });

  expect(applied).toBe(1);

  const wrapper = document.querySelector(`#price span.${INLINE_CONVERSION_CLASS}`);
  expect(wrapper).not.toBeNull();
  expect(wrapper.getAttribute("data-original")?.trim()).toBe("$100");
  expect(wrapper.textContent).toMatch(/^\$100\s+\(.+\)$/);
  const convertedAmount = wrapper.querySelector(".ccx-converted-amount");
  expect(convertedAmount.textContent).toMatch(/^\(.+\)$/);
});

test("injects style tag with converted amount line-height and width contract", () => {
  document.body.innerHTML = '<p id="price">Pay $100 now.</p>';

  convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
  });

  const styleTag = document.getElementById("ccx-inline-conversion-style");
  expect(styleTag).not.toBeNull();
  expect(styleTag.textContent).toContain("line-height: inherit !important;");
  expect(styleTag.textContent).toContain("width: fit-content !important;");
});

test("refreshes existing wrappers in place and clears when target currency matches source", () => {
  document.body.innerHTML = '<p id="price">Price: $100</p>';

  const initialApplied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
  });
  expect(initialApplied).toBe(1);

  const initialWrapper = document.querySelector(`#price span.${INLINE_CONVERSION_CLASS}`);
  const initialConvertedNode = initialWrapper.querySelector(".ccx-converted-amount");

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
  expect(refreshedWrapper.querySelector(".ccx-converted-amount")).toBe(initialConvertedNode);

  const clearedApplied = convertVisiblePrices("USD", createRateSnapshot(), document.body);
  expect(clearedApplied).toBe(0);
  expect(document.querySelector(`#price span.${INLINE_CONVERSION_CLASS}`)).toBeNull();
});

test("suppresses and restores wrappers without replacing converted node", () => {
  document.body.innerHTML = '<p id="price">Price: $100</p>';

  convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
  });

  const wrapper = document.querySelector(`#price span.${INLINE_CONVERSION_CLASS}`);
  const convertedNode = wrapper.querySelector(".ccx-converted-amount");

  const suppressedCount = suppressInlineConversions(document.body);
  expect(suppressedCount).toBe(1);
  expect(wrapper.querySelector(".ccx-converted-amount")).toBe(convertedNode);
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

  expect(wrapper.querySelector(".ccx-converted-amount")).toBe(convertedNode);
  expect(convertedNode.style.display).toBe("");
});

test("adds structured add-on conversions for amazon-style and sibling-symbol prices", () => {
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
  ].join("\n");

  const applied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
  });

  expect(applied).toBeGreaterThanOrEqual(2);

  const amazonAddon = document.querySelector(
    '#amazon-root span.ccx-inline-conversion[data-ccx-mode="addon"]',
  );
  expect(amazonAddon).not.toBeNull();
  expect(amazonAddon.getAttribute("data-original")).toBe("$199.99");

  const siblingAddon = document.querySelector(
    '#sibling-value span.ccx-inline-conversion[data-ccx-mode="addon"]',
  );
  expect(siblingAddon).not.toBeNull();
  expect(siblingAddon.getAttribute("data-original")).toBe("$2500");
});

test("allows disabling default post plugins so amazon-specific logic can be detached", () => {
  document.body.innerHTML = [
    '<span id="amazon-root" aria-hidden="true">',
    '  <span class="a-price-symbol">$</span>',
    '  <span class="a-price-whole">199</span>',
    '  <span class="a-price-decimal">.</span>',
    '  <span class="a-price-fraction">99</span>',
    '</span>',
  ].join("\n");

  const applied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
    includeDefaultPostPlugins: false,
  });

  expect(applied).toBe(0);
  expect(
    document.querySelector('#amazon-root span.ccx-inline-conversion[data-ccx-mode="addon"]'),
  ).toBeNull();
});

test("supports amazon decorator as explicit post plugin", () => {
  document.body.innerHTML = [
    '<span id="amazon-root" aria-hidden="true">',
    '  <span class="a-price-symbol">$</span>',
    '  <span class="a-price-whole">199</span>',
    '  <span class="a-price-decimal">.</span>',
    '  <span class="a-price-fraction">99</span>',
    '</span>',
  ].join("\n");

  const applied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
    includeDefaultPrePlugins: false,
    includeDefaultPostPlugins: false,
    postPlugins: [amazonStructuredAddonPlugin],
  });

  expect(applied).toBe(1);
  expect(
    document.querySelector('#amazon-root span.ccx-inline-conversion[data-ccx-mode="addon"]'),
  ).not.toBeNull();
});

test("skips plugins declared for a different phase and reports error", () => {
  document.body.innerHTML = "<div></div>";
  const pluginErrors = [];
  let applyCalls = 0;

  const postPhasePlugin = {
    name: "post-only",
    phase: "post",
    apply() {
      applyCalls += 1;
      return 1;
    },
  };

  convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
    includeDefaultPostPlugins: false,
    prePlugins: [postPhasePlugin],
    onPluginError: (error, plugin) => {
      pluginErrors.push({ error, plugin });
    },
  });

  expect(applyCalls).toBe(0);
  expect(pluginErrors).toHaveLength(1);
  expect(pluginErrors[0].plugin).toBe(postPhasePlugin);
  expect(pluginErrors[0].error).toBeInstanceOf(Error);
  expect(pluginErrors[0].error.message).toContain(
    'declared for "post" phase but ran in "pre" phase',
  );
});

test("supports pass-scoped metadata handoff from pre detector to post renderer", () => {
  document.body.innerHTML = "<div>$100</div>";
  const observed = [];

  const prePlugin = {
    name: "detector",
    phase: "pre",
    apply({ passContext, passId }) {
      passContext.push("demo", "metadata", { passId, tag: "detected" });
      return 0;
    },
  };

  const postPlugin = {
    name: "renderer",
    phase: "post",
    apply({ passContext, passId }) {
      const entries = passContext.consume("demo", "metadata");
      observed.push({
        passId,
        count: Array.isArray(entries) ? entries.length : 0,
      });
      return 0;
    },
  };

  convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
    includeDefaultPrePlugins: false,
    includeDefaultPostPlugins: false,
    prePlugins: [prePlugin],
    postPlugins: [postPlugin],
  });

  expect(observed).toHaveLength(1);
  expect(observed[0].count).toBe(1);
  expect(observed[0].passId).toMatch(/^inline-pass-/u);
});

test("does not leak pre/post pass metadata across conversion calls", () => {
  document.body.innerHTML = "<div>$100</div>";

  let conversionRound = 0;
  const seenCounts = [];

  const prePlugin = {
    name: "detector",
    phase: "pre",
    apply({ passContext }) {
      if (conversionRound === 0) {
        passContext.push("demo", "metadata", { round: conversionRound });
      }
      conversionRound += 1;
      return 0;
    },
  };

  const postPlugin = {
    name: "renderer",
    phase: "post",
    apply({ passContext }) {
      const entries = passContext.consume("demo", "metadata");
      seenCounts.push(Array.isArray(entries) ? entries.length : 0);
      return 0;
    },
  };

  convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
    includeDefaultPrePlugins: false,
    includeDefaultPostPlugins: false,
    prePlugins: [prePlugin],
    postPlugins: [postPlugin],
  });

  convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
    includeDefaultPrePlugins: false,
    includeDefaultPostPlugins: false,
    prePlugins: [prePlugin],
    postPlugins: [postPlugin],
  });

  expect(seenCounts).toEqual([1, 0]);
});

test("amazon renderer applies client render preferences", () => {
  document.body.innerHTML = [
    '<span id="amazon-root" aria-hidden="true">',
    '  <span class="a-price-symbol">$</span>',
    '  <span class="a-price-whole">199</span>',
    '  <span class="a-price-decimal">.</span>',
    '  <span class="a-price-fraction">99</span>',
    '</span>',
  ].join("\n");

  const applied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
    clientRenderPreferences: {
      sites: {
        amazon: {
          showOriginalPrice: false,
          convertedPrefix: "≈ ",
          convertedSuffix: " incl",
          wrapperClassName: "client-wrapper",
          convertedAmountClassName: "client-amount",
          colorStrategy: "inherit",
        },
      },
    },
  });

  expect(applied).toBe(1);
  const addon = document.querySelector(
    '#amazon-root span.ccx-inline-conversion[data-ccx-mode="addon"]',
  );
  expect(addon).not.toBeNull();
  expect(addon.classList.contains("client-wrapper")).toBe(true);
  expect(addon.style.getPropertyValue("--ccx-converted-color")).toBe("currentColor");
  expect(addon.textContent).toContain("≈ ");
  expect(addon.textContent).toContain(" incl");
  expect(addon.textContent).not.toContain("$199.99");
  expect(addon.querySelector(".ccx-converted-amount").classList.contains("client-amount")).toBe(
    true,
  );
});

test("amazon renderer ignores stale candidates from pre detection", () => {
  document.body.innerHTML = [
    '<span id="amazon-root" aria-hidden="true">',
    '  <span class="a-price-symbol">$</span>',
    '  <span class="a-price-whole">199</span>',
    '</span>',
  ].join("\n");

  const staleDetectorPrePlugin = {
    name: "stale-detector",
    phase: "pre",
    apply({ root, passContext }) {
      const hostNode = root.querySelector("#amazon-root");
      passContext.set("site:amazon", "structured-candidates", [
        { hostNode, detectedRawPrice: "$199" },
      ]);
      hostNode?.remove();
      return 0;
    },
  };

  const applied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
    includeDefaultPrePlugins: false,
    includeDefaultPostPlugins: false,
    prePlugins: [staleDetectorPrePlugin],
    postPlugins: [amazonStructuredRendererPostPlugin],
  });

  expect(applied).toBe(0);
  expect(
    document.querySelector('#amazon-root span.ccx-inline-conversion[data-ccx-mode="addon"]'),
  ).toBeNull();
});

test("reports perf sample shape with reached node limit", () => {
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
  expect(sample.scannedTextNodes).toBe(1);
  expect(sample.reachedNodeLimit).toBe(true);
  expect(sample.conversionsApplied).toBe(applied);
  expect(sample.totalMs).toBeGreaterThanOrEqual(0);
});
