import {
  INLINE_CONVERSION_CLASS,
  convertVisiblePrices,
} from "../../test-dist/entrypoints/content/inlineConversion.js";

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
  const styleTag = document.getElementById("ccx-inline-conversion-style");
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

  const convertedAmount = wrapper.querySelector(".ccx-converted-amount");
  expect(convertedAmount).not.toBeNull();
  expect(convertedAmount.textContent.length > 0).toBe(true);
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
    .querySelector(".ccx-converted-amount")
    .textContent;

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

  const refreshedConvertedText = refreshedWrapper
    .querySelector(".ccx-converted-amount")
    .textContent;
  expect(refreshedConvertedText).not.toBe(initialConvertedText);

  const clearedApplied = convertVisiblePrices("USD", createRateSnapshot(), document.body);
  expect(clearedApplied).toBe(0);
  expect(document.querySelector(`#price span.${INLINE_CONVERSION_CLASS}`)).toBeNull();
  expect(document.getElementById("price").textContent).toContain("$100");
});

test("skips editable, non-visible, and already-converted wrapper contexts", () => {
  document.body.innerHTML = [
    '<div id="editable" contenteditable="true">$100</div>',
    '<div id="hidden" class="visually-hidden">$200</div>',
    '<div id="existing"><span class="ccx-inline-conversion" data-original="$300"><span class="ccx-converted-amount">€270.00</span></span></div>',
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
  expect(sample.scannedTextNodes).toBe(1);
  expect(sample.reachedNodeLimit).toBe(true);
  expect(sample.conversionsApplied).toBe(applied);
  expect(sample.totalMs).toBeGreaterThanOrEqual(0);
  expect(sample.clearExistingMs).toBeGreaterThanOrEqual(0);
  expect(sample.scanTextNodesMs).toBeGreaterThanOrEqual(0);
  expect(sample.decorateNodesMs).toBeGreaterThanOrEqual(0);
});
