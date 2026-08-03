import { jest } from "@jest/globals";

const getUserSettingsMock = jest.fn();
const getCachedRateSnapshotMock = jest.fn();

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
const controllerSetClientRenderPreferencesMock = jest.fn();
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

function createUserSettings(overrides = {}) {
  const allUrls = {
    enabled: true,
    domain: "",
    pageUrl: "",
    targetCurrencies: ["EUR"],
    convertedCurrencyPosition: "right",
    displayStyle: "brackets",
    highlightColor: "#fff1a8",
    extraSettings: {},
    ...(overrides.allUrls || {}),
  };

  return {
    schemaVersion: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    scopes: {
      allUrls,
      domains: overrides.domains || {},
      pages: overrides.pages || {},
    },
  };
}

function resetControllerMocks() {
  controllerStartMock.mockReset();
  controllerDestroyMock.mockReset();
  controllerSetPreferredCurrencyMock.mockReset();
  controllerSetRateSnapshotMock.mockReset();
  controllerSetEnabledMock.mockReset();
  controllerSetClientRenderPreferencesMock.mockReset();
  controllerEnqueueMutationRootsMock.mockReset();
  controllerShouldIgnoreMutationsMock.mockReset();
  controllerRefreshMock.mockReset();

  controllerShouldIgnoreMutationsMock.mockReturnValue(false);
}

async function importRuntimeModuleWithMocks() {
  jest.resetModules();

  await jest.unstable_mockModule("@/utils/appStorage", () => ({
    getUserSettings: getUserSettingsMock,
  }));

  await jest.unstable_mockModule("@/utils/rates/cache", () => ({
    getCachedRateSnapshot: getCachedRateSnapshotMock,
  }));

  await jest.unstable_mockModule("@fx-inline/inline-runtime/extension", () => ({
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

  getUserSettingsMock.mockResolvedValue(createUserSettings());

  getCachedRateSnapshotMock.mockResolvedValue(createRateSnapshot());

  createInlineRuntimeMock.mockReturnValue({
    start: controllerStartMock,
    stop: jest.fn(),
    refresh: controllerRefreshMock,
    setPreferredCurrency: controllerSetPreferredCurrencyMock,
    setRateSnapshot: controllerSetRateSnapshotMock,
    setEnabled: controllerSetEnabledMock,
    setClientRenderPreferences: controllerSetClientRenderPreferencesMock,
    destroy: controllerDestroyMock,
    enqueueMutationRoots: controllerEnqueueMutationRootsMock,
    shouldIgnoreMutations: controllerShouldIgnoreMutationsMock,
    setRoot: jest.fn(),
    setObserveMutations: jest.fn(),
  });

  document.body.innerHTML = "<div id=\"root\"></div>";
  window.localStorage.removeItem("fx-inline:perf");
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  document.body.innerHTML = "";
  window.localStorage.removeItem("fx-inline:perf");
});

test("initialize hydrates settings/rates, applies runtime state, and starts controller", async () => {
  const { createContentConversionRuntime } = await importRuntimeModuleWithMocks();
  const runtime = createContentConversionRuntime();

  await runtime.initialize();

  expect(getUserSettingsMock).toHaveBeenCalledTimes(1);
  expect(getCachedRateSnapshotMock).toHaveBeenCalledTimes(1);

  expect(controllerSetPreferredCurrencyMock).toHaveBeenCalledWith("EUR");
  expect(controllerSetClientRenderPreferencesMock).toHaveBeenCalledWith({
      default: {
        convertedCurrencyPosition: "right",
        displayStyle: "brackets",
        highlightColor: "#fff1a8",
      },
    });
  expect(controllerSetRateSnapshotMock).toHaveBeenCalledWith(
    expect.objectContaining({ base: "USD" }),
  );
  expect(controllerSetEnabledMock).toHaveBeenCalledWith(true);
  expect(controllerStartMock).toHaveBeenCalledTimes(1);
});

test("content runtime perf logs visited and accepted candidate totals", async () => {
  window.localStorage.setItem("fx-inline:perf", "1");
  const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
  const { createContentConversionRuntime } = await importRuntimeModuleWithMocks();

  createContentConversionRuntime();
  const options = createInlineRuntimeMock.mock.calls[0][0];
  options.onPerfSample({
    totalMs: 12.345,
    clearExistingMs: 1.111,
    scanTextNodesMs: 2.222,
    decorateNodesMs: 9.012,
    visitedTextNodes: 42,
    acceptedCandidates: 7,
    scannedTextNodes: 7,
    conversionsApplied: 5,
    maxNodesPerPass: 15000,
    reachedNodeLimit: false,
  });

  expect(infoSpy).toHaveBeenCalledWith(
    expect.stringContaining("inlineConversion.full"),
    expect.objectContaining({
      visitedTextNodes: 42,
      acceptedCandidates: 7,
      scannedTextNodes: 7,
      conversions: 5,
    }),
  );
});

test("content runtime selects little hotelier plugins only for pricing pages", async () => {
  await importRuntimeModuleWithMocks();
  const {
    getContentRuntimeSitePluginOptions,
    isLittleHotelierPricingPage,
  } = await import("../../test-dist/entrypoints/content/sitePlugins.js");

  expect(
    isLittleHotelierPricingPage(
      new URL("https://www.littlehotelier.com/pricing/"),
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
  await importRuntimeModuleWithMocks();
  const { getContentRuntimeSitePluginOptions, isLittleHotelierPricingPage } =
    await import("../../test-dist/entrypoints/content/sitePlugins.js");

  const pricingUrls = [
    "https://www.littlehotelier.com/pricing/",
    "https://www.littlehotelier.com/de/preise/",
    "https://www.littlehotelier.com/es/precios/",
    "https://www.littlehotelier.com/it/prezzi/",
    "https://www.littlehotelier.com/th/pricing/",
    "https://www.littlehotelier.com/id/pricing/",
  ];

  for (const pricingUrl of pricingUrls) {
    expect(isLittleHotelierPricingPage(new URL(pricingUrl))).toBe(true);
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
    createUserSettings({ allUrls: { targetCurrencies: ["INR"] } }),
    createUserSettings({ allUrls: { targetCurrencies: ["EUR"] } }),
  );

  jest.advanceTimersByTime(1399);
  expect(getUserSettingsMock).toHaveBeenCalledTimes(1);
  expect(getCachedRateSnapshotMock).toHaveBeenCalledTimes(1);

  jest.advanceTimersByTime(1);

  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }

  expect(getUserSettingsMock).toHaveBeenCalledTimes(2);
  expect(getCachedRateSnapshotMock).toHaveBeenCalledTimes(2);

  expect(controllerSetPreferredCurrencyMock).toHaveBeenCalledWith("EUR");
  expect(controllerSetEnabledMock).toHaveBeenCalledWith(true);
  expect(controllerSetRateSnapshotMock).toHaveBeenCalledWith(
    expect.objectContaining({ base: "USD" }),
  );
});

test("initialize reflects disabled auto-conversion in runtime state", async () => {
  getUserSettingsMock.mockResolvedValue(
    createUserSettings({ allUrls: { enabled: false } }),
  );

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
