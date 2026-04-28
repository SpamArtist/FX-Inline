import assert from "node:assert/strict";
import test from "node:test";

import {
  MANIFEST_PRODUCT_NAME,
  MANIFEST_RATE_PROVIDER_HOST_PERMISSIONS,
  MANIFEST_REQUIRED_PERMISSIONS,
  assertManifestHygiene,
} from "../../scripts/release/manifest-hygiene.mjs";

function createChromeManifest(overrides = {}) {
  return {
    name: MANIFEST_PRODUCT_NAME,
    action: {
      default_title: MANIFEST_PRODUCT_NAME,
      default_popup: "popup.html",
      default_icon: {
        "16": "icon/16.png",
        "32": "icon/32.png",
        "48": "icon/48.png",
      },
    },
    icons: {
      "16": "icon/16.png",
      "32": "icon/32.png",
      "48": "icon/48.png",
      "128": "icon/128.png",
      "512": "icon/512.png",
    },
    permissions: [...MANIFEST_REQUIRED_PERMISSIONS],
    host_permissions: [...MANIFEST_RATE_PROVIDER_HOST_PERMISSIONS],
    ...overrides,
  };
}

function createFirefoxManifest(overrides = {}) {
  return {
    browser_action: {
      default_title: MANIFEST_PRODUCT_NAME,
      default_popup: "popup.html",
      default_icon: {
        "16": "icon/16.png",
        "32": "icon/32.png",
        "48": "icon/48.png",
      },
    },
    icons: {
      "16": "icon/16.png",
      "32": "icon/32.png",
      "48": "icon/48.png",
      "128": "icon/128.png",
      "512": "icon/512.png",
    },
    browser_specific_settings: {
      gecko: {
        id: "fx-inline@xbotpc",
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
    ...overrides,
  };
}

function createManifestPair(overrides = {}) {
  return {
    chromeManifest: createChromeManifest(overrides.chromeManifest),
    firefoxManifest: createFirefoxManifest(overrides.firefoxManifest),
    chromePopupHtml: "<title>FX Inline</title>",
    firefoxPopupHtml: "<title>FX Inline</title>",
    ...overrides,
  };
}

test("assertManifestHygiene accepts the intended Chrome and Firefox manifest surface", () => {
  assert.doesNotThrow(() => {
    assertManifestHygiene(createManifestPair());
  });
});

test("assertManifestHygiene rejects stale popup titles", () => {
  assert.throws(
    () => assertManifestHygiene(createManifestPair({
      chromeManifest: createChromeManifest({
        action: {
          default_title: "Default Popup Title",
          default_popup: "popup.html",
        },
      }),
    })),
    /Default Popup Title|FX Inline/,
  );

  assert.throws(
    () => assertManifestHygiene(createManifestPair({
      chromePopupHtml: "<title>Default Popup Title</title>",
    })),
    /Default Popup Title|FX Inline/,
  );
});

test("assertManifestHygiene rejects Chrome-only manifest leaks", () => {
  assert.throws(
    () => assertManifestHygiene(createManifestPair({
      chromeManifest: createChromeManifest({
        browser_specific_settings: {
          gecko: {
            id: "fx-inline@xbotpc",
          },
        },
      }),
    })),
    /Chrome manifest must not include browser_specific_settings/,
  );
});

test("assertManifestHygiene rejects stale 96px icons and unexpected page-exposed assets", () => {
  assert.throws(
    () => assertManifestHygiene(createManifestPair({
      chromeManifest: createChromeManifest({
        icons: {
          "16": "icon/16.png",
          "96": "icon/96.png",
        },
      }),
    })),
    /icon\/96\.png/,
  );

  assert.throws(
    () => assertManifestHygiene(createManifestPair({
      chromeManifest: createChromeManifest({
        web_accessible_resources: [{
          resources: ["fx-inline-logo.svg"],
          matches: ["<all_urls>"],
        }],
      }),
    })),
    /web_accessible_resources/,
  );
});
