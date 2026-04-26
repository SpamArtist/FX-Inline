import { jest } from "@jest/globals";

const getUserSettingsMock = jest.fn();
const getRatesMock = jest.fn();

const createInlineRuntimeMock = jest.fn();
const littleHotelierPricingDetectorPrePluginMock = {
  name: "littlehotelier-pricing-detector",
  phase: "pre",
};
const littleHotelierPricingRendererPostPluginMock = {
  name: "littlehotelier-pricing-renderer",
  phase: "post",
};
const controllerStartMock = jest.fn();
const controllerDestroyMock = jest.fn();
const controllerSetPreferredCurrencyMock = jest.fn();
const controllerSetRateSnapshotMock = jest.fn();
const controllerSetEnabledMock = jest.fn();
const controllerEnqueueMutationRootsMock = jest.fn();
const controllerShouldIgnoreMutationsMock = jest.fn();
const controllerRefreshMock = jest.fn();

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

function resetControllerMocks() {
  controllerStartMock.mockReset();
  controllerDestroyMock.mockReset();
  controllerSetPreferredCurrencyMock.mockReset();
  controllerSetRateSnapshotMock.mockReset();
  controllerSetEnabledMock.mockReset();
  controllerEnqueueMutationRootsMock.mockReset();
  controllerShouldIgnoreMutationsMock.mockReset();
  controllerRefreshMock.mockReset();

  controllerShouldIgnoreMutationsMock.mockReturnValue(false);
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

  await jest.unstable_mockModule("@/utils/rates/index", () => ({
    getRates: getRatesMock,
  }));

  await jest.unstable_mockModule("@fx-inline/inline-runtime", () => ({
    createInlineRuntime: createInlineRuntimeMock,
    littleHotelierPricingDetectorPrePlugin:
      littleHotelierPricingDetectorPrePluginMock,
    littleHotelierPricingRendererPostPlugin:
      littleHotelierPricingRendererPostPluginMock,
  }));

  return import("../../test-dist/entrypoints/content/conversionRuntime.js");
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetControllerMocks();

  getUserSettingsMock.mockResolvedValue({
    preferredCurrency: "EUR",
    globalAutoConversionEnabled: true,
    localAutoConversionByOrigin: {},
  });

  getRatesMock.mockResolvedValue(createRateSnapshot());

  createInlineRuntimeMock.mockReturnValue({
    start: controllerStartMock,
    stop: jest.fn(),
    refresh: controllerRefreshMock,
    setPreferredCurrency: controllerSetPreferredCurrencyMock,
    setRateSnapshot: controllerSetRateSnapshotMock,
    setEnabled: controllerSetEnabledMock,
    destroy: controllerDestroyMock,
    enqueueMutationRoots: controllerEnqueueMutationRootsMock,
    shouldIgnoreMutations: controllerShouldIgnoreMutationsMock,
    setRoot: jest.fn(),
    setObserveMutations: jest.fn(),
  });

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

test("initialize hydrates settings/rates, applies runtime state, and starts controller", async () => {
  const { createContentConversionRuntime } = await importRuntimeModuleWithMocks();
  const runtime = createContentConversionRuntime();

  await runtime.initialize();

  expect(getUserSettingsMock).toHaveBeenCalledTimes(1);
  expect(getRatesMock).toHaveBeenCalledWith({ forceRefresh: false });

  expect(controllerSetPreferredCurrencyMock).toHaveBeenCalledWith("EUR");
  expect(controllerSetRateSnapshotMock).toHaveBeenCalledWith(
    expect.objectContaining({ base: "USD" }),
  );
  expect(controllerSetEnabledMock).toHaveBeenCalledWith(true);
  expect(controllerStartMock).toHaveBeenCalledTimes(1);
});

test("content runtime selects little hotelier plugins only for pricing pages", async () => {
  const {
    getContentRuntimeSitePluginOptions,
    isLittleHotelierPricingPage,
  } = await importRuntimeModuleWithMocks();

  expect(
    isLittleHotelierPricingPage(
      "https://www.littlehotelier.com/pricing/",
    ),
  ).toBe(true);
  expect(
    getContentRuntimeSitePluginOptions(
      "https://www.littlehotelier.com/pricing?currency=USD",
    ),
  ).toEqual({
    prePlugins: [littleHotelierPricingDetectorPrePluginMock],
    postPlugins: [littleHotelierPricingRendererPostPluginMock],
  });

  expect(
    getContentRuntimeSitePluginOptions(
      "https://www.littlehotelier.com/id/pricing/",
    ),
  ).toEqual({
    prePlugins: [littleHotelierPricingDetectorPrePluginMock],
    postPlugins: [littleHotelierPricingRendererPostPluginMock],
  });
  expect(
    getContentRuntimeSitePluginOptions(
      "https://littlehotelier.com/pricing/",
    ),
  ).toEqual({});
  expect(
    getContentRuntimeSitePluginOptions(
      "https://www.littlehotelier.com/pricing-extra/",
    ),
  ).toEqual({});
});

test("content runtime selects little hotelier plugins for current locale pricing pages", async () => {
  const { getContentRuntimeSitePluginOptions, isLittleHotelierPricingPage } =
    await importRuntimeModuleWithMocks();

  const pricingUrls = [
    "https://www.littlehotelier.com/pricing/",
    "https://www.littlehotelier.com/de/preise/",
    "https://www.littlehotelier.com/es/precios/",
    "https://www.littlehotelier.com/it/prezzi/",
    "https://www.littlehotelier.com/th/pricing/",
    "https://www.littlehotelier.com/id/pricing/",
  ];

  for (const pricingUrl of pricingUrls) {
    expect(isLittleHotelierPricingPage(pricingUrl)).toBe(true);
    expect(getContentRuntimeSitePluginOptions(pricingUrl)).toEqual({
      prePlugins: [littleHotelierPricingDetectorPrePluginMock],
      postPlugins: [littleHotelierPricingRendererPostPluginMock],
    });
  }
});

test("settings updates debounce a fresh settings/rates hydration", async () => {
  const { createContentConversionRuntime } = await importRuntimeModuleWithMocks();
  const runtime = createContentConversionRuntime();

  await runtime.initialize();
  controllerSetPreferredCurrencyMock.mockClear();
  controllerSetRateSnapshotMock.mockClear();
  controllerSetEnabledMock.mockClear();

  await runtime.onSettingsStorageUpdate(
    { preferredCurrency: "INR" },
    { preferredCurrency: "EUR" },
  );

  jest.advanceTimersByTime(1399);
  expect(getUserSettingsMock).toHaveBeenCalledTimes(1);
  expect(getRatesMock).toHaveBeenCalledTimes(1);

  jest.advanceTimersByTime(1);

  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }

  expect(getUserSettingsMock).toHaveBeenCalledTimes(2);
  expect(getRatesMock).toHaveBeenCalledTimes(2);

  expect(controllerSetPreferredCurrencyMock).toHaveBeenCalledWith("EUR");
  expect(controllerSetEnabledMock).toHaveBeenCalledWith(true);
  expect(controllerSetRateSnapshotMock).toHaveBeenCalledWith(
    expect.objectContaining({ base: "USD" }),
  );
});

test("initialize reflects disabled auto-conversion in runtime state", async () => {
  getUserSettingsMock.mockResolvedValue({
    preferredCurrency: "EUR",
    globalAutoConversionEnabled: false,
    localAutoConversionByOrigin: {},
  });

  const { createContentConversionRuntime } = await importRuntimeModuleWithMocks();
  const runtime = createContentConversionRuntime();

  await runtime.initialize();

  expect(controllerSetEnabledMock).toHaveBeenCalledWith(false);
});

test("enqueueMutationRoots delegates to shared runtime controller", async () => {
  const { createContentConversionRuntime } = await importRuntimeModuleWithMocks();
  const runtime = createContentConversionRuntime();

  await runtime.initialize();

  const rootA = document.createElement("div");
  const rootB = document.createElement("div");

  runtime.enqueueMutationRoots([rootA, rootB]);

  expect(controllerEnqueueMutationRootsMock).toHaveBeenCalledWith([rootA, rootB]);
});

test("shouldIgnoreMutations delegates to shared runtime controller", async () => {
  controllerShouldIgnoreMutationsMock.mockReturnValue(true);

  const { createContentConversionRuntime } = await importRuntimeModuleWithMocks();
  const runtime = createContentConversionRuntime();

  await runtime.initialize();

  expect(runtime.shouldIgnoreMutations()).toBe(true);
});

test("recordSelectionConversion triggers shared runtime refresh", async () => {
  const { createContentConversionRuntime } = await importRuntimeModuleWithMocks();
  const runtime = createContentConversionRuntime();

  await runtime.initialize();

  runtime.recordSelectionConversion();

  expect(controllerRefreshMock).toHaveBeenCalledTimes(1);
});

test("cleanup destroys the shared runtime controller", async () => {
  const { createContentConversionRuntime } = await importRuntimeModuleWithMocks();
  const runtime = createContentConversionRuntime();

  await runtime.initialize();
  runtime.cleanup();

  expect(controllerDestroyMock).toHaveBeenCalledTimes(1);
});
