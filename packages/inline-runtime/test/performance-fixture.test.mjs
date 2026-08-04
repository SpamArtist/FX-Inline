/** @jest-environment jsdom */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertVisiblePrices } from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(
  __dirname,
  "fixtures",
  "performance",
  "apts-jp-first-page",
);
const metadata = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "metadata.json"), "utf8"),
);
const inputHtml = fs.readFileSync(path.join(fixtureDir, metadata.inputFile), "utf8");
const expectedDom = fs.readFileSync(
  path.join(fixtureDir, metadata.expectedDomFile),
  "utf8",
);

const lockedSettings = {
  targetCurrency: "EUR",
  convertedCurrencyPosition: "right",
  displayStyle: "brackets",
  clearExisting: false,
  includeDefaultPrePlugins: true,
  includeDefaultPostPlugins: true,
};

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function loadFixtureDocument() {
  document.open();
  document.write(inputHtml);
  document.close();
  return document;
}

function collectConversions(document) {
  return Array.from(document.querySelectorAll(".fx-inline-conversion")).map(
    (wrapper, index) => ({
      index,
      original: wrapper.getAttribute("data-original"),
      convertedText:
        wrapper.querySelector(".fx-inline-converted-amount")?.textContent ?? "",
      position: wrapper.getAttribute("data-fx-inline-position"),
      displayStyle: wrapper.getAttribute("data-fx-inline-display-style"),
    }),
  );
}

function getAssetLinkSelector() {
  return [
    'link[rel~="apple-touch-icon"][href]',
    'link[rel~="dns-prefetch"][href]',
    'link[rel~="icon"][href]',
    'link[rel~="manifest"][href]',
    'link[rel~="modulepreload"][href]',
    'link[rel~="preconnect"][href]',
    'link[rel~="prefetch"][href]',
    'link[rel~="preload"][href]',
    'link[rel~="stylesheet"][href]',
  ].join(",");
}

test("apts.jp performance fixture metadata locks input hash and config", () => {
  expect(metadata.fixtureName).toBe("apts-jp-first-page-full-conversion");
  expect(metadata.sourceUrl).toBe("https://apts.jp/");
  expect(metadata.baselineSourceCommit).toBe(
    "2140309a8f4e86920e29292d92a469b4486ec8df",
  );
  expect(metadata.locale).toBe("en");
  expect(metadata.ratesBase).toBe("EUR");
  expect(metadata.ratesFetchedAt).toBe("2026-08-04T00:00:00.000Z");
  expect(metadata.settings).toEqual(lockedSettings);
  expect(metadata.rates).toMatchObject({
    EUR: 1,
    JPY: 180.94,
    USD: 1.1510178117048346,
  });
  expect(metadata.inputSha256).toBe(sha256(inputHtml));
  expect(metadata.expectedDomSha256).toBe(sha256(expectedDom));
  expect(metadata.expectedConversions).toHaveLength(
    metadata.expectedConversionCount,
  );
});

test("apts.jp performance fixture keeps all network assets blocked", () => {
  const document = loadFixtureDocument();

  expect(document.querySelector("script")).toBeNull();
  expect(
    document.querySelectorAll('template[data-fx-inline-blocked-asset="script"]')
      .length,
  ).toBeGreaterThan(0);
  expect(document.querySelector(getAssetLinkSelector())).toBeNull();
  expect(
    document.querySelector(
      [
        "[src]",
        "[srcset]",
        "[poster]",
        "[data-src]",
        "[data-srcset]",
        "[data-background-image]",
      ].join(","),
    ),
  ).toBeNull();

  for (const style of document.querySelectorAll("style")) {
    expect(style.textContent).not.toMatch(/url\(\s*(['"]?)(?:https?:|\/\/|\/)/iu);
  }
});

test("apts.jp performance fixture matches exact full conversion DOM", () => {
  const document = loadFixtureDocument();
  const samples = [];

  const applied = convertVisiblePrices(
    metadata.settings.targetCurrency,
    {
      base: metadata.ratesBase,
      fetchedAt: metadata.ratesFetchedAt,
      source: "apts.jp fixture fixed rates",
      rates: metadata.rates,
    },
    document.body,
    {
      clearExisting: metadata.settings.clearExisting,
      includeDefaultPrePlugins: metadata.settings.includeDefaultPrePlugins,
      includeDefaultPostPlugins: metadata.settings.includeDefaultPostPlugins,
      clientRenderPreferences: {
        default: {
          convertedCurrencyPosition:
            metadata.settings.convertedCurrencyPosition,
          displayStyle: metadata.settings.displayStyle,
        },
      },
      onPerfSample: (sample) => samples.push(sample),
    },
  );

  expect(applied).toBe(metadata.expectedConversionCount);
  expect(collectConversions(document)).toEqual(metadata.expectedConversions);
  expect({
    visitedTextNodes: samples[0].visitedTextNodes,
    acceptedCandidates: samples[0].acceptedCandidates,
    scannedTextNodes: samples[0].scannedTextNodes,
    conversionsApplied: samples[0].conversionsApplied,
    reachedNodeLimit: samples[0].reachedNodeLimit,
  }).toEqual(metadata.expectedPerfCounters);
  expect(`${document.documentElement.outerHTML}\n`).toBe(expectedDom);
});
