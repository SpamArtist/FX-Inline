import assert from "node:assert/strict";

export const MANIFEST_PRODUCT_NAME = "FX Inline";
export const MANIFEST_REQUIRED_PERMISSIONS = ["storage", "alarms", "activeTab"];
export const MANIFEST_RATE_PROVIDER_HOST_PERMISSIONS = [
  "https://open.er-api.com/*",
  "https://api.exchangerate-api.com/*",
];

const STALE_POPUP_TITLE = "Default Popup Title";

function getActionConfig(manifest, manifestName) {
  const action = manifest.action ?? manifest.browser_action;

  assert.ok(
    action,
    `${manifestName} manifest must define an action/browser_action entry.`,
  );

  return action;
}

function assertNoStalePopupTitle(popupHtml, manifestName) {
  assert.ok(
    popupHtml.includes(`<title>${MANIFEST_PRODUCT_NAME}</title>`),
    `${manifestName} popup HTML must use "${MANIFEST_PRODUCT_NAME}" as its title.`,
  );
  assert.ok(
    !popupHtml.includes(STALE_POPUP_TITLE),
    `${manifestName} popup HTML must not contain "${STALE_POPUP_TITLE}".`,
  );
}

function assertNoUnexpectedWebAccessibleResources(manifest, manifestName) {
  if (!Object.hasOwn(manifest, "web_accessible_resources")) return;

  assert.deepEqual(
    manifest.web_accessible_resources,
    [],
    `${manifestName} manifest should not expose web_accessible_resources unless a page-facing asset is intentionally added.`,
  );
}

function assertNoLegacyIconSize(manifest, manifestName) {
  assert.ok(
    !Object.hasOwn(manifest.icons ?? {}, "96"),
    `${manifestName} manifest must not declare icon/96.png.`,
  );
}

export function assertManifestHygiene({
  chromeManifest,
  firefoxManifest,
  chromePopupHtml,
  firefoxPopupHtml,
}) {
  const chromeAction = getActionConfig(chromeManifest, "Chrome");
  const firefoxAction = getActionConfig(firefoxManifest, "Firefox");

  assert.equal(chromeManifest.name, MANIFEST_PRODUCT_NAME);
  assert.equal(chromeAction.default_title, MANIFEST_PRODUCT_NAME);
  assert.equal(firefoxAction.default_title, MANIFEST_PRODUCT_NAME);

  assertNoStalePopupTitle(chromePopupHtml, "Chrome");
  assertNoStalePopupTitle(firefoxPopupHtml, "Firefox");

  assertNoLegacyIconSize(chromeManifest, "Chrome");
  assertNoLegacyIconSize(firefoxManifest, "Firefox");

  assert.deepEqual(chromeManifest.permissions, MANIFEST_REQUIRED_PERMISSIONS);
  assert.deepEqual(
    chromeManifest.host_permissions,
    MANIFEST_RATE_PROVIDER_HOST_PERMISSIONS,
  );

  assertNoUnexpectedWebAccessibleResources(chromeManifest, "Chrome");
  assertNoUnexpectedWebAccessibleResources(firefoxManifest, "Firefox");

  assert.ok(
    !Object.hasOwn(chromeManifest, "browser_specific_settings"),
    "Chrome manifest must not include browser_specific_settings.",
  );
  assert.deepEqual(firefoxManifest.browser_specific_settings, {
    gecko: {
      id: "fx-inline@xbotpc",
      data_collection_permissions: {
        required: ["none"],
      },
    },
  });
}
