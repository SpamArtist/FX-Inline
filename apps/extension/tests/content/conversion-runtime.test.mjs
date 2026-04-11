import { jest } from "@jest/globals";

const getUserSettingsMock = jest.fn();
const getRatesMock = jest.fn();
const convertVisiblePricesMock = jest.fn();
const suppressInlineConversionsMock = jest.fn();

function createRateSnapshot(overrides = {}) {
  const base = {
    base: "USD",
    fetchedAt: Date.now(),
    rates: {
      USD: 1,
      EUR: 0.9,
      INR: 83,
    },
  };

  return {
    ...base,
    ...overrides,
    rates: {
      ...base.rates,
      ...(overrides.rates || {}),
    },
  };
}

async function importRuntimeModuleWithMocks() {
  jest.resetModules();

  await jest.unstable_mockModule("@/utils/appStorage", () => ({
    getUserSettings: getUserSettingsMock,
    getOriginFromUrl: (url) => {
      try {
        const parsed = new URL(url);
        return parsed.origin;
      } catch {
        return null;
      }
    },
    isAutoConversionEnabledForOrigin: (settings, origin) => {
      if (settings?.globalAutoConversionEnabled === false) return false;
      if (!origin) return true;
      return settings?.localAutoConversionByOrigin?.[origin] !== false;
    },
  }));
  await jest.unstable_mockModule("@/utils/rates", () => ({
    getRates: getRatesMock,
  }));

  await jest.unstable_mockModule(
    "../../test-dist/entrypoints/content/inlineConversion.js",
    () => ({
      INLINE_CONVERSION_CLASS: "ccx-inline-conversion",
      convertVisiblePrices: convertVisiblePricesMock,
    }),
  );
  await jest.unstable_mockModule(
    "../../test-dist/entrypoints/content/inlineConversion/conversionNodes.js",
    () => ({
      suppressInlineConversions: suppressInlineConversionsMock,
    }),
  );

  return import("../../test-dist/entrypoints/content/conversionRuntime.js");
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();

  getUserSettingsMock.mockResolvedValue({
    preferredCurrency: "EUR",
    globalAutoConversionEnabled: true,
    localAutoConversionByOrigin: {},
  });
  getRatesMock.mockResolvedValue(createRateSnapshot());
  convertVisiblePricesMock.mockReturnValue(1);
  suppressInlineConversionsMock.mockReturnValue(0);

  document.body.innerHTML = "<div id=\"root\"></div>";
  window.localStorage.removeItem("ccx:perf");
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  document.body.innerHTML = "";
  window.localStorage.removeItem("ccx:perf");
});

test("initialize hydrates settings/rates and schedules inline conversion", async () => {
  const { createContentConversionRuntime } = await importRuntimeModuleWithMocks();
  const runtime = createContentConversionRuntime();

  await runtime.initialize();

  expect(getUserSettingsMock).toHaveBeenCalledTimes(1);
  expect(getRatesMock).toHaveBeenCalledWith({ forceRefresh: false });
  expect(convertVisiblePricesMock).not.toHaveBeenCalled();

  jest.advanceTimersByTime(200);

  expect(convertVisiblePricesMock).toHaveBeenCalledTimes(1);
  const conversionCallArgs = convertVisiblePricesMock.mock.calls[0];
  expect(conversionCallArgs[2]).toBe(document.body);
  expect(conversionCallArgs[3]).toMatchObject({
    clearExisting: false,
    refreshExisting: true,
  });
});

test("settings updates debounce conversion scheduling when preferred currency changes", async () => {
  const { createContentConversionRuntime } = await importRuntimeModuleWithMocks();
  const runtime = createContentConversionRuntime();

  await runtime.initialize();
  jest.advanceTimersByTime(200);
  convertVisiblePricesMock.mockClear();

  await runtime.onSettingsStorageUpdate(
    { preferredCurrency: "INR" },
    { preferredCurrency: "EUR" },
  );

  jest.advanceTimersByTime(1400);
  expect(convertVisiblePricesMock).toHaveBeenCalledTimes(0);

  jest.advanceTimersByTime(199);
  expect(convertVisiblePricesMock).toHaveBeenCalledTimes(0);

  jest.advanceTimersByTime(1);
  expect(convertVisiblePricesMock).toHaveBeenCalledTimes(1);

  expect(getUserSettingsMock).toHaveBeenCalledTimes(2);
  expect(getRatesMock).toHaveBeenCalledTimes(2);
});

test("partial conversion defers remaining roots when time budget is exceeded", async () => {
  const { createContentConversionRuntime } = await importRuntimeModuleWithMocks();
  const runtime = createContentConversionRuntime();

  await runtime.initialize();
  jest.advanceTimersByTime(200);
  convertVisiblePricesMock.mockClear();

  const rootA = document.createElement("div");
  const rootB = document.createElement("div");
  document.body.append(rootA, rootB);

  const nowSpy = jest.spyOn(performance, "now");
  let callCount = 0;
  nowSpy.mockImplementation(() => {
    callCount += 1;

    if (callCount === 1) return 0;
    if (callCount === 2) return 20;

    return 20;
  });

  runtime.enqueueMutationRoots([rootA, rootB]);

  jest.advanceTimersByTime(120);
  expect(convertVisiblePricesMock).toHaveBeenCalledTimes(1);
  expect(convertVisiblePricesMock.mock.calls[0][2]).toBe(rootA);
  expect(convertVisiblePricesMock.mock.calls[0][3]).toMatchObject({
    clearExisting: false,
    maxNodesPerPass: 4000,
  });

  jest.advanceTimersByTime(27);
  expect(convertVisiblePricesMock).toHaveBeenCalledTimes(1);

  jest.advanceTimersByTime(1);
  expect(convertVisiblePricesMock).toHaveBeenCalledTimes(2);
  expect(convertVisiblePricesMock.mock.calls[1][2]).toBe(rootB);
});

test("shouldIgnoreMutations stays true until suppression delay is released", async () => {
  const { createContentConversionRuntime } = await importRuntimeModuleWithMocks();
  const runtime = createContentConversionRuntime();

  await runtime.initialize();

  expect(runtime.shouldIgnoreMutations()).toBe(false);

  jest.advanceTimersByTime(200);
  expect(convertVisiblePricesMock).toHaveBeenCalledTimes(1);
  expect(runtime.shouldIgnoreMutations()).toBe(true);

  jest.advanceTimersByTime(399);
  expect(runtime.shouldIgnoreMutations()).toBe(true);

  jest.advanceTimersByTime(1);
  expect(runtime.shouldIgnoreMutations()).toBe(false);
});

test("disabling auto-conversion suppresses wrappers without running conversion", async () => {
  getUserSettingsMock.mockResolvedValue({
    preferredCurrency: "EUR",
    globalAutoConversionEnabled: false,
    localAutoConversionByOrigin: {},
  });

  const { createContentConversionRuntime } = await importRuntimeModuleWithMocks();
  const runtime = createContentConversionRuntime();

  await runtime.initialize();
  jest.advanceTimersByTime(200);

  expect(suppressInlineConversionsMock).toHaveBeenCalledTimes(1);
  expect(suppressInlineConversionsMock).toHaveBeenCalledWith(document.body);
  expect(convertVisiblePricesMock).toHaveBeenCalledTimes(0);
});

test("re-enabling auto-conversion refreshes rates before scheduling in-place updates", async () => {
  const { createContentConversionRuntime } = await importRuntimeModuleWithMocks();
  const runtime = createContentConversionRuntime();

  await runtime.initialize();
  jest.advanceTimersByTime(200);
  convertVisiblePricesMock.mockClear();

  await runtime.onSettingsStorageUpdate(
    {
      preferredCurrency: "EUR",
      globalAutoConversionEnabled: true,
      localAutoConversionByOrigin: {},
    },
    {
      preferredCurrency: "EUR",
      globalAutoConversionEnabled: false,
      localAutoConversionByOrigin: {},
    },
  );

  expect(getRatesMock).toHaveBeenCalledTimes(2);
  expect(getRatesMock).toHaveBeenLastCalledWith({ forceRefresh: false });

  jest.advanceTimersByTime(1600);
  expect(convertVisiblePricesMock).toHaveBeenCalledTimes(1);
});
