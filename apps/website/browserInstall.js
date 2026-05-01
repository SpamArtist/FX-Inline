const CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/cicoldboionelecmpjpkkdhicjbpfefj?utm_source=item-share-cb";
const FIREFOX_ADDONS_URL = "https://addons.mozilla.org/en-GB/firefox/addon/fx-inline";

export const BROWSER_INSTALL_TARGETS = {
  chrome: {
    label: "Add to Chrome",
    href: CHROME_WEB_STORE_URL,
    external: true,
  },
  firefox: {
    label: "Add to Firefox",
    href: FIREFOX_ADDONS_URL,
    external: true,
  },
  safari: {
    label: "Add to Safari",
    href: "#page-review",
    external: false,
  },
  edge: {
    label: "Add to Edge",
    href: "#page-review",
    external: false,
  },
};

function getNavigatorUserAgent(navigatorLike) {
  return typeof navigatorLike?.userAgent === "string" ? navigatorLike.userAgent : "";
}

function getNavigatorBrands(navigatorLike) {
  return Array.isArray(navigatorLike?.userAgentData?.brands)
    ? navigatorLike.userAgentData.brands.map((brand) => brand.brand).join(" ")
    : "";
}

export function detectBrowserInstallTarget(navigatorLike = globalThis.navigator) {
  const signature = `${getNavigatorUserAgent(navigatorLike)} ${getNavigatorBrands(navigatorLike)}`;

  if (/firefox|fxios/i.test(signature)) {
    return "firefox";
  }

  if (/edg|microsoft edge/i.test(signature)) {
    return "edge";
  }

  if (/safari/i.test(signature) && !/chrome|chromium|crios|edg|opr|opera/i.test(signature)) {
    return "safari";
  }

  return "chrome";
}

export function applyBrowserInstallCta(anchor, targetKey) {
  const target = BROWSER_INSTALL_TARGETS[targetKey] ?? BROWSER_INSTALL_TARGETS.chrome;

  anchor.textContent = target.label;
  anchor.href = target.href;
  anchor.dataset.browserTarget = targetKey;

  if (target.external) {
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  } else {
    anchor.removeAttribute("target");
    anchor.removeAttribute("rel");
  }
}

export function initializeBrowserInstallCta(
  root = globalThis.document,
  navigatorLike = globalThis.navigator,
) {
  const anchor = root?.querySelector("[data-browser-install-cta]");

  if (!anchor) {
    return null;
  }

  const targetKey = detectBrowserInstallTarget(navigatorLike);
  applyBrowserInstallCta(anchor, targetKey);

  return targetKey;
}
