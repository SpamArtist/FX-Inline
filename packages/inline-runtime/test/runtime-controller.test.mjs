/** @jest-environment jsdom */

import { jest } from "@jest/globals";

const convertVisiblePricesMock = jest.fn();
const suppressInlineConversionsMock = jest.fn();
const runPartialConversionPassMock = jest.fn();

async function importControllerWithMocks() {
  jest.resetModules();

  await jest.unstable_mockModule("../src/core/convertVisiblePrices.js", () => ({
    convertVisiblePrices: convertVisiblePricesMock,
  }));

  await jest.unstable_mockModule("../src/core/conversionNodes.js", () => ({
    clearInlineConversions: jest.fn(),
    suppressInlineConversions: suppressInlineConversionsMock,
  }));

  await jest.unstable_mockModule("../src/core/partialPass.js", () => ({
    runPartialConversionPass: runPartialConversionPassMock,
  }));

  return import("../src/runtime/controller.js");
}

function createSnapshot() {
  return {
    base: "USD",
    fetchedAt: Date.now(),
    rates: {
      USD: 1,
      EUR: 0.9,
    },
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();

  document.body.innerHTML = "<p>$100</p>";

  convertVisiblePricesMock.mockReturnValue(1);
  suppressInlineConversionsMock.mockReturnValue(0);
  runPartialConversionPassMock.mockReturnValue({
    conversions: 1,
    connectedRoots: 1,
    deferredRoots: 0,
  });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  document.body.innerHTML = "";
});

test("start schedules a full conversion using provided snapshot", async () => {
  const { createInlineRuntime } = await importControllerWithMocks();

  const runtime = createInlineRuntime({
    root: document.body,
    preferredCurrency: "EUR",
    rateSnapshot: createSnapshot(),
    enabled: true,
    observeMutations: false,
  });

  runtime.start();

  expect(convertVisiblePricesMock).toHaveBeenCalledTimes(0);

  jest.advanceTimersByTime(199);
  expect(convertVisiblePricesMock).toHaveBeenCalledTimes(0);

  jest.advanceTimersByTime(1);
  await Promise.resolve();

  expect(convertVisiblePricesMock).toHaveBeenCalledTimes(1);
  expect(convertVisiblePricesMock).toHaveBeenCalledWith(
    "EUR",
    expect.objectContaining({ base: "USD" }),
    document.body,
    expect.objectContaining({
      clearExisting: false,
      refreshExisting: true,
    }),
  );
});

test("passes plugin configuration into full conversion calls", async () => {
  const { createInlineRuntime } = await importControllerWithMocks();
  const prePlugin = jest.fn();
  const postPlugin = jest.fn();
  const onPluginError = jest.fn();
  const clientRenderPreferences = {
    sites: {
      amazon: {
        showOriginalPrice: false,
      },
    },
  };

  const runtime = createInlineRuntime({
    root: document.body,
    preferredCurrency: "EUR",
    rateSnapshot: createSnapshot(),
    enabled: true,
    observeMutations: false,
    includeDefaultPrePlugins: false,
    prePlugins: [prePlugin],
    postPlugins: [postPlugin],
    includeDefaultPostPlugins: false,
    clientRenderPreferences,
    onPluginError,
  });

  runtime.start();
  jest.advanceTimersByTime(200);
  await Promise.resolve();

  expect(convertVisiblePricesMock).toHaveBeenCalledWith(
    "EUR",
    expect.objectContaining({ base: "USD" }),
    document.body,
    expect.objectContaining({
      includeDefaultPrePlugins: false,
      prePlugins: [prePlugin],
      postPlugins: [postPlugin],
      includeDefaultPostPlugins: false,
      clientRenderPreferences,
      onPluginError,
    }),
  );
});

test("setEnabled(false) suppresses wrappers and skips conversion", async () => {
  const { createInlineRuntime } = await importControllerWithMocks();

  const runtime = createInlineRuntime({
    root: document.body,
    preferredCurrency: "EUR",
    rateSnapshot: createSnapshot(),
    enabled: true,
    observeMutations: false,
  });

  runtime.start();
  runtime.setEnabled(false);

  expect(suppressInlineConversionsMock).toHaveBeenCalledWith(document.body);

  jest.advanceTimersByTime(200);
  await Promise.resolve();

  expect(convertVisiblePricesMock).toHaveBeenCalledTimes(0);
});

test("enqueueMutationRoots runs partial conversion with debounce", async () => {
  const { createInlineRuntime } = await importControllerWithMocks();

  const runtime = createInlineRuntime({
    root: document.body,
    preferredCurrency: "EUR",
    rateSnapshot: createSnapshot(),
    enabled: true,
    observeMutations: false,
  });

  runtime.start();
  jest.advanceTimersByTime(200);
  await Promise.resolve();
  runPartialConversionPassMock.mockClear();

  const rootA = document.createElement("div");
  document.body.appendChild(rootA);

  runtime.enqueueMutationRoots([rootA]);

  jest.advanceTimersByTime(119);
  expect(runPartialConversionPassMock).toHaveBeenCalledTimes(0);

  jest.advanceTimersByTime(1);

  expect(runPartialConversionPassMock).toHaveBeenCalledTimes(1);
  expect(runPartialConversionPassMock.mock.calls[0][0]).toEqual([rootA]);
  expect(runPartialConversionPassMock.mock.calls[0][4]).toEqual(
    expect.objectContaining({
      includeDefaultPrePlugins: undefined,
      clientRenderPreferences: null,
    }),
  );
});

test("shouldIgnoreMutations remains true until suppression release delay elapses", async () => {
  const { createInlineRuntime } = await importControllerWithMocks();

  const runtime = createInlineRuntime({
    root: document.body,
    preferredCurrency: "EUR",
    rateSnapshot: createSnapshot(),
    enabled: true,
    observeMutations: false,
  });

  runtime.start();

  expect(runtime.shouldIgnoreMutations()).toBe(false);

  jest.advanceTimersByTime(200);
  await Promise.resolve();
  expect(runtime.shouldIgnoreMutations()).toBe(true);

  jest.advanceTimersByTime(399);
  expect(runtime.shouldIgnoreMutations()).toBe(true);

  jest.advanceTimersByTime(1);
  expect(runtime.shouldIgnoreMutations()).toBe(false);
});

test("start reports missing injected snapshot when none is provided", async () => {
  const { createInlineRuntime } = await importControllerWithMocks();
  const onError = jest.fn();

  const runtime = createInlineRuntime({
    root: document.body,
    preferredCurrency: "EUR",
    enabled: true,
    observeMutations: false,
    onError,
    autoFetchRates: true,
    loadRates: getRatesMock,
  });

  runtime.start();

  jest.advanceTimersByTime(200);
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }

  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError.mock.calls[0][0]).toEqual(expect.any(Error));
  expect(onError.mock.calls[0][0].message).toBe(
    "FX Inline runtime missing rate snapshot. Provide `rateSnapshot` before starting or refreshing.",
  );
  expect(convertVisiblePricesMock).not.toHaveBeenCalled();
});

test("setClientRenderPreferences schedules a conversion with updated preferences", async () => {
  const { createInlineRuntime } = await importControllerWithMocks();
  const runtime = createInlineRuntime({
    root: document.body,
    preferredCurrency: "EUR",
    rateSnapshot: createSnapshot(),
    enabled: true,
    observeMutations: false,
  });

  runtime.start();
  jest.advanceTimersByTime(200);
  await Promise.resolve();
  convertVisiblePricesMock.mockClear();

  runtime.setClientRenderPreferences({
    sites: {
      amazon: {
        convertedSuffix: " incl",
      },
    },
  });

  jest.advanceTimersByTime(200);
  await Promise.resolve();

  expect(convertVisiblePricesMock).toHaveBeenCalledTimes(1);
  expect(convertVisiblePricesMock).toHaveBeenCalledWith(
    "EUR",
    expect.objectContaining({ base: "USD" }),
    document.body,
    expect.objectContaining({
      clientRenderPreferences: {
        sites: {
          amazon: {
            convertedSuffix: " incl",
          },
        },
      },
    }),
  );
});
