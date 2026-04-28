/** @jest-environment jsdom */

import {
  amazonStructuredAddonPlugin,
  amazonStructuredRendererPostPlugin,
  convertVisiblePrices,
  littleHotelierPricingDetectorPrePlugin,
  littleHotelierPricingRendererPostPlugin,
  suppressInlineConversions,
} from "../src/index.js";
import { createInlinePassIdFactory } from "../src/core/passContext.js";

const INLINE_CONVERSION_CLASS = "fx-inline-conversion";

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

function convertLittleHotelierPricing(
  preferredCurrency,
  rateSnapshot,
  clientRenderPreferences = null,
) {
  return convertVisiblePrices(preferredCurrency, rateSnapshot, document.body, {
    clearExisting: false,
    refreshExisting: true,
    includeDefaultPrePlugins: false,
    includeDefaultPostPlugins: false,
    prePlugins: [littleHotelierPricingDetectorPrePlugin],
    postPlugins: [littleHotelierPricingRendererPostPlugin],
    clientRenderPreferences,
  });
}

function setLittleHotelierPricingTable() {
  document.body.innerHTML = [
    '<section class="section d-none d-md-block pricing-table revised-pricing-lhb">',
    '  <div class="container">',
    '    <table class="table table-borderless mb-0 text-center">',
    "      <tbody>",
    "        <tr>",
    '          <td class="p-0 border-top-0">',
    '            <table class="mb-0 table-pricing table-breakdown-heading w-70 mx-auto">',
    "              <tbody>",
    '                <tr class="pb-0">',
    '                  <th class="border border-bottom-0 border-top-0 pb-0 px-4 pt-0" id="littleHotelierPro" data-field="product">',
    "                    <p>",
    '                      <span class="medium lh-pro" id="term">From&nbsp;</span><strong class="h1"><span class="output lh-pro pb-0" id="output-lhbm">$179</span></strong>',
    '                      <span class="code">USD</span><span class="price-suffix">&nbsp;/ month*</span>',
    "                    </p>",
    "                  </th>",
    '                  <th class="border border-bottom-0 border-top-0 pb-0 px-4 pt-0" id="littleHotelierRevenueOptimiser" data-field="product">',
    "                    <p>",
    '                      <span class="medium lh-pro" id="term">From&nbsp;</span><strong class="h1"><span class="output lh-pro pb-0" id="output-lhbm">$179</span></strong>',
    '                      <span class="lh-pro" id="term"><span class="code">USD</span><span class="price-suffix">&nbsp;/ month*</span></span>',
    "                    </p>",
    "                  </th>",
    "                </tr>",
    "              </tbody>",
    "            </table>",
    "          </td>",
    "        </tr>",
    "      </tbody>",
    "    </table>",
    "  </div>",
    "</section>",
  ].join("\n");
}

function getLittleHotelierAddons() {
  return Array.from(
    document.querySelectorAll(
      'span.fx-inline-conversion[data-ccx-site="littlehotelier-pricing"]',
    ),
  );
}

beforeEach(() => {
  document.documentElement.lang = "en-US";
  document.body.innerHTML = "";
  const styleTag = document.getElementById("fx-inline-conversion-style");
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
  const convertedAmount = wrapper.querySelector(".fx-inline-converted-amount");
  expect(convertedAmount.textContent).toMatch(/^\(.+\)$/);
});

test("injects style tag with converted amount line-height and width contract", () => {
  document.body.innerHTML = '<p id="price">Pay $100 now.</p>';

  convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
  });

  const styleTag = document.getElementById("fx-inline-conversion-style");
  expect(styleTag).not.toBeNull();
  expect(styleTag.textContent).toContain("line-height: inherit !important;");
  expect(styleTag.textContent).toContain("width: fit-content !important;");
});

test("applies configured converted currency position and display style", () => {
  const cases = [
    { position: "top", style: "pill" },
    { position: "bottom", style: "underline" },
    { position: "left", style: "highlightColor" },
    { position: "right", style: "brackets" },
    { position: "tooltip", style: "pill" },
  ];

  for (const { position, style } of cases) {
    document.body.innerHTML = '<p id="price">Pay $100 now.</p>';

    const applied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
      clearExisting: false,
      clientRenderPreferences: {
        default: {
          convertedCurrencyPosition: position,
          displayStyle: style,
          highlightColor: "#abcdef",
        },
      },
    });

    expect(applied).toBe(1);

    const wrapper = document.querySelector(`#price span.${INLINE_CONVERSION_CLASS}`);
    expect(wrapper.getAttribute("data-fx-inline-position")).toBe(position);

    if (position === "tooltip") {
      expect(wrapper.getAttribute("data-fx-inline-display-style")).toBeNull();
      expect(wrapper.getAttribute("data-fx-inline-tooltip")).toBeTruthy();
      expect(wrapper.getAttribute("title")).toBe(wrapper.getAttribute("data-fx-inline-tooltip"));
    } else {
      expect(wrapper.getAttribute("data-fx-inline-display-style")).toBe(style);
      if (style === "highlightColor") {
        expect(wrapper.style.getPropertyValue("--fx-inline-highlight-color")).toBe("#abcdef");
      }
    }
  }
});

test("uses linearized sRGB luminance for light text detection", () => {
  document.body.innerHTML = '<p id="price" style="color: rgb(180, 180, 180)">Pay $100 now.</p>';

  const applied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
  });

  expect(applied).toBe(1);

  const wrapper = document.querySelector(`#price span.${INLINE_CONVERSION_CLASS}`);
  expect(wrapper).not.toBeNull();
  expect(wrapper.style.getPropertyValue("--fx-inline-converted-color")).toBe("#355aa8");
});

test("refreshes existing wrappers in place and clears when target currency matches source", () => {
  document.body.innerHTML = '<p id="price">Price: $100</p>';

  const initialApplied = convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
  });
  expect(initialApplied).toBe(1);

  const initialWrapper = document.querySelector(`#price span.${INLINE_CONVERSION_CLASS}`);
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
  expect(refreshedWrapper.querySelector(".fx-inline-converted-amount")).toBe(initialConvertedNode);

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
  const convertedNode = wrapper.querySelector(".fx-inline-converted-amount");

  const suppressedCount = suppressInlineConversions(document.body);
  expect(suppressedCount).toBe(1);
  expect(wrapper.querySelector(".fx-inline-converted-amount")).toBe(convertedNode);
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
    '#amazon-root span.fx-inline-conversion[data-fx-inline-mode="addon"]',
  );
  expect(amazonAddon).not.toBeNull();
  expect(amazonAddon.getAttribute("data-original")).toBe("$199.99");

  const siblingAddon = document.querySelector(
    '#sibling-value span.fx-inline-conversion[data-fx-inline-mode="addon"]',
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
    document.querySelector('#amazon-root span.fx-inline-conversion[data-fx-inline-mode="addon"]'),
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
    document.querySelector('#amazon-root span.fx-inline-conversion[data-fx-inline-mode="addon"]'),
  ).not.toBeNull();
});

test("amazon addon does not duplicate original amount by default", () => {
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

test("scopes pass id factory sequences to each owner", () => {
  const firstCreatePassId = createInlinePassIdFactory();
  const secondCreatePassId = createInlinePassIdFactory();

  expect(firstCreatePassId()).toBe("inline-pass-1");
  expect(firstCreatePassId()).toBe("inline-pass-2");
  expect(secondCreatePassId()).toBe("inline-pass-1");
  expect(secondCreatePassId()).toBe("inline-pass-2");
});

test("uses provided pass id factory for conversion pass contexts", () => {
  document.body.innerHTML = "<div>$100</div>";
  const observedPassIds = [];
  let passCounter = 0;

  const postPlugin = {
    name: "observer",
    phase: "post",
    apply({ passId }) {
      observedPassIds.push(passId);
      return 0;
    },
  };

  const createPassId = () => {
    passCounter += 1;
    return `owner-pass-${passCounter}`;
  };

  convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
    includeDefaultPrePlugins: false,
    includeDefaultPostPlugins: false,
    postPlugins: [postPlugin],
    createPassId,
  });

  convertVisiblePrices("EUR", createRateSnapshot(), document.body, {
    clearExisting: false,
    includeDefaultPrePlugins: false,
    includeDefaultPostPlugins: false,
    postPlugins: [postPlugin],
    createPassId,
  });

  expect(observedPassIds).toEqual(["owner-pass-1", "owner-pass-2"]);
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
    '#amazon-root span.fx-inline-conversion[data-fx-inline-mode="addon"]',
  );
  expect(addon).not.toBeNull();
  expect(addon.classList.contains("client-wrapper")).toBe(true);
  expect(addon.style.getPropertyValue("--fx-inline-converted-color")).toBe("currentColor");
  expect(addon.textContent).toContain("≈ ");
  expect(addon.textContent).toContain(" incl");
  expect(addon.textContent).not.toContain("$199.99");
  expect(addon.querySelector(".fx-inline-converted-amount").classList.contains("client-amount")).toBe(
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
    document.querySelector('#amazon-root span.fx-inline-conversion[data-fx-inline-mode="addon"]'),
  ).toBeNull();
});

test("little hotelier pricing renderer uses default render preferences", () => {
  setLittleHotelierPricingTable();

  const applied = convertLittleHotelierPricing("EUR", createRateSnapshot());

  expect(applied).toBe(2);

  const addons = getLittleHotelierAddons();
  expect(addons).toHaveLength(2);

  const proOutput = document.querySelector("#littleHotelierPro .output.lh-pro");
  expect(proOutput.textContent).toBe("$179");
  expect(proOutput.querySelector(".fx-inline-conversion")).toBeNull();

  const proParagraph = document.querySelector("#littleHotelierPro p");
  const proAddon = proParagraph.lastElementChild;
  expect(proAddon).toBe(addons[0]);
  expect(proAddon.getAttribute("data-original")).toBe("$179 USD");
  expect(proAddon.getAttribute("data-fx-inline-position")).toBe("right");
  expect(proAddon.getAttribute("data-fx-inline-display-style")).toBe("brackets");
  expect(proAddon.textContent).toMatch(/^≈ \(.+\)$/u);
  expect(proAddon.textContent).not.toContain("$179");
  expect(proAddon.style.display).toBe("");
  expect(proAddon.style.position).toBe("");
  expect(proAddon.style.float).toBe("");
  expect(proAddon.style.marginTop).toBe("");
  expect(proAddon.style.padding).toBe("");
});

test("little hotelier pricing renderer applies admin render preferences", () => {
  setLittleHotelierPricingTable();

  const applied = convertLittleHotelierPricing("EUR", createRateSnapshot(), {
    default: {
      convertedCurrencyPosition: "bottom",
      displayStyle: "underline",
    },
  });

  expect(applied).toBe(2);

  const [proAddon] = getLittleHotelierAddons();
  expect(proAddon.getAttribute("data-fx-inline-position")).toBe("bottom");
  expect(proAddon.getAttribute("data-fx-inline-display-style")).toBe("underline");
  expect(proAddon.textContent).toMatch(/^≈ [^(].+/u);
});

test("little hotelier pricing renderer refreshes addon nodes in place", () => {
  setLittleHotelierPricingTable();

  convertLittleHotelierPricing("EUR", createRateSnapshot());

  const initialAddon = getLittleHotelierAddons()[0];
  const initialConvertedNode = initialAddon.querySelector(".fx-inline-converted-amount");
  const initialConvertedText = initialConvertedNode.textContent;

  convertLittleHotelierPricing(
    "EUR",
    createRateSnapshot({
      rates: {
        EUR: 0.75,
      },
    }),
  );

  const refreshedAddon = getLittleHotelierAddons()[0];
  const refreshedConvertedNode = refreshedAddon.querySelector(
    ".fx-inline-converted-amount",
  );

  expect(getLittleHotelierAddons()).toHaveLength(2);
  expect(refreshedAddon).toBe(initialAddon);
  expect(refreshedConvertedNode).toBe(initialConvertedNode);
  expect(refreshedConvertedNode.textContent).not.toBe(initialConvertedText);
});

test("little hotelier pricing renderer removes addons when conversion is unavailable", () => {
  setLittleHotelierPricingTable();

  convertLittleHotelierPricing("EUR", createRateSnapshot());
  expect(getLittleHotelierAddons()).toHaveLength(2);

  convertLittleHotelierPricing("USD", createRateSnapshot());

  expect(getLittleHotelierAddons()).toHaveLength(0);
});

test("little hotelier pricing renderer removes stale addons outside pricing table", () => {
  setLittleHotelierPricingTable();

  convertLittleHotelierPricing("EUR", createRateSnapshot());
  expect(getLittleHotelierAddons()).toHaveLength(2);

  const pricingSection = document.querySelector(
    "section.pricing-table.revised-pricing-lhb",
  );
  pricingSection.className = "section";

  convertLittleHotelierPricing("EUR", createRateSnapshot());

  expect(getLittleHotelierAddons()).toHaveLength(0);
});

test("little hotelier pricing renderer ignores non-pricing DOM", () => {
  document.body.innerHTML = [
    '<section class="section">',
    '  <th id="notPricing" data-field="product">',
    "    <p>",
    '      <strong class="h1"><span class="output lh-pro pb-0">$179</span></strong>',
    '      <span class="code">USD</span><span class="price-suffix">&nbsp;/ month*</span>',
    "    </p>",
    "  </th>",
    "</section>",
  ].join("\n");

  convertLittleHotelierPricing("EUR", createRateSnapshot());

  expect(getLittleHotelierAddons()).toHaveLength(0);
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
