import {
  createDefaultInlineRuntimeSettings,
  getPrimaryTargetCurrency,
  getUnsupportedRuntimeSettingKeys,
  INLINE_RUNTIME_SETTING_REGISTRY,
  resolveInlineRuntimeSettingsForUrl,
  sanitizeInlineRuntimeSettingsManifest,
} from "../../test-dist/utils/inlineRuntimeSettings.js";

test("sanitizeInlineRuntimeSettingsManifest applies defaults and drops invalid scopes", () => {
  const manifest = sanitizeInlineRuntimeSettingsManifest({
    scopes: {
      allUrls: {
        enabled: "yes",
        targetCurrencies: ["INR", "NOPE", "EUR", "INR"],
        convertedCurrencyPosition: "sideways",
        displayStyle: "pill",
      },
      domains: {
        "https://Example.com/path": {
          enabled: false,
          targetCurrencies: ["GBP"],
        },
        "": {
          enabled: false,
        },
      },
    },
  });

  expect(manifest.scopes.allUrls.enabled).toBe(true);
  expect(manifest.scopes.allUrls.targetCurrencies).toEqual(["INR"]);
  expect(manifest.scopes.allUrls.convertedCurrencyPosition).toBe("right");
  expect(manifest.scopes.allUrls.displayStyle).toBe("pill");
  expect(Object.keys(manifest.scopes.domains)).toEqual(["example.com"]);
});

test("settings keep only one target currency", () => {
  const settings = createDefaultInlineRuntimeSettings({
    targetCurrencies: ["GBP", "EUR"],
  });

  expect(settings.targetCurrencies).toEqual(["GBP"]);
});

test("resolveInlineRuntimeSettingsForUrl uses page, domain, then all_urls precedence", () => {
  const manifest = sanitizeInlineRuntimeSettingsManifest({
    scopes: {
      allUrls: createDefaultInlineRuntimeSettings({
        targetCurrencies: ["EUR"],
      }),
      domains: {
        "example.com": createDefaultInlineRuntimeSettings({
          domain: "example.com",
          targetCurrencies: ["INR"],
        }),
      },
      pages: {
        "https://example.com/pricing?plan=pro": createDefaultInlineRuntimeSettings({
          domain: "example.com",
          pageUrl: "https://example.com/pricing?plan=pro",
          targetCurrencies: ["GBP"],
        }),
      },
    },
  });

  expect(
    getPrimaryTargetCurrency(
      resolveInlineRuntimeSettingsForUrl(
        manifest,
        "https://example.com/pricing?plan=pro#checkout",
      ).settings,
    ),
  ).toBe("GBP");
  expect(
    getPrimaryTargetCurrency(
      resolveInlineRuntimeSettingsForUrl(
        manifest,
        "https://example.com/pricing?plan=team",
      ).settings,
    ),
  ).toBe("INR");
  expect(
    getPrimaryTargetCurrency(
      resolveInlineRuntimeSettingsForUrl(
        manifest,
        "https://shop.example.com/pricing?plan=pro",
      ).settings,
    ),
  ).toBe("EUR");
});

test("unsupported future settings are retained for logging but skipped by runtime", () => {
  const manifest = sanitizeInlineRuntimeSettingsManifest({
    scopes: {
      allUrls: {
        ...createDefaultInlineRuntimeSettings(),
        notImplementedYet: true,
        extraSettings: {
          upcomingSetting: "alpha",
        },
      },
    },
  });

  expect(getUnsupportedRuntimeSettingKeys(manifest.scopes.allUrls)).toEqual([
    "notImplementedYet",
    "upcomingSetting",
  ]);
});

test("registry declares current runtime settings as supported", () => {
  expect(
    Object.values(INLINE_RUNTIME_SETTING_REGISTRY).every(
      (entry) => entry.runtimeSupported === true,
    ),
  ).toBe(true);
});
