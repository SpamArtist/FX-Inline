import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";

import {
  detectBrowserInstallTarget,
  initializeBrowserInstallCta,
} from "../../apps/website/browserInstall.js";

describe("browser install CTA", () => {
  it("detects the browser-specific install target", () => {
    assert.equal(
      detectBrowserInstallTarget({
        userAgent:
          "Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
      }),
      "edge",
    );
    assert.equal(
      detectBrowserInstallTarget({
        userAgent: "Mozilla/5.0 Gecko/20100101 Firefox/125.0",
      }),
      "firefox",
    );
    assert.equal(
      detectBrowserInstallTarget({
        userAgent:
          "Mozilla/5.0 AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
      }),
      "safari",
    );
    assert.equal(
      detectBrowserInstallTarget({
        userAgent:
          "Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
      }),
      "chrome",
    );
  });

  it("updates the header CTA label, destination, and external link behavior", () => {
    const dom = new JSDOM(`
      <a class="header-cta" href="#page-review" data-browser-install-cta>
        Add to Chrome
      </a>
    `);
    const target = initializeBrowserInstallCta(dom.window.document, {
      userAgent: "Mozilla/5.0 Gecko/20100101 Firefox/125.0",
    });
    const anchor = dom.window.document.querySelector("[data-browser-install-cta]");

    assert.equal(target, "firefox");
    assert.equal(anchor.textContent, "Add to Firefox");
    assert.equal(anchor.getAttribute("href"), "https://addons.mozilla.org/en-GB/firefox/addon/fx-inline");
    assert.equal(anchor.getAttribute("target"), "_blank");
    assert.equal(anchor.getAttribute("rel"), "noopener noreferrer");
  });

  it("keeps browsers without a public store listing on the review section", () => {
    const dom = new JSDOM(`
      <a class="header-cta" href="#page-review" target="_blank" rel="noopener noreferrer" data-browser-install-cta>
        Add to Chrome
      </a>
    `);
    const target = initializeBrowserInstallCta(dom.window.document, {
      userAgent:
        "Mozilla/5.0 AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
    });
    const anchor = dom.window.document.querySelector("[data-browser-install-cta]");

    assert.equal(target, "safari");
    assert.equal(anchor.textContent, "Add to Safari");
    assert.equal(anchor.getAttribute("href"), "#page-review");
    assert.equal(anchor.hasAttribute("target"), false);
    assert.equal(anchor.hasAttribute("rel"), false);
  });
});
