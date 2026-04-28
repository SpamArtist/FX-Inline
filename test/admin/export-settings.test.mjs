import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createDefaultInlineRuntimeSettings,
  createDefaultInlineRuntimeSettingsManifest,
  normalizeDomainScope,
  normalizePageScope,
  readInlineRuntimeSettingsManifestFromDb,
  sanitizeInlineRuntimeSettingsManifest,
  writeGeneratedManifestFile,
  writeInlineRuntimeSettingsManifestToDb,
} from "../../dist/backend/settings-store.js";

test("admin DB export returns a default manifest on a fresh database", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fx-inline-admin-"));
  const dbPath = path.join(tempDir, "settings.sqlite");

  const manifest = readInlineRuntimeSettingsManifestFromDb(dbPath);

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.scopes.allUrls.enabled, true);
  assert.deepEqual(manifest.scopes.allUrls.targetCurrencies, ["EUR"]);
});

test("admin DB export persists scoped domain and page settings", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fx-inline-admin-"));
  const dbPath = path.join(tempDir, "settings.sqlite");
  const manifest = createDefaultInlineRuntimeSettingsManifest();

  manifest.scopes.domains["example.com"] = createDefaultInlineRuntimeSettings({
    enabled: false,
    domain: "example.com",
    targetCurrencies: ["INR", "EUR"],
    convertedCurrencyPosition: "tooltip",
  });
  manifest.scopes.pages["https://example.com/pricing"] =
    createDefaultInlineRuntimeSettings({
      enabled: true,
      domain: "example.com",
      pageUrl: "https://example.com/pricing",
      targetCurrencies: ["GBP"],
      displayStyle: "pill",
    });

  writeInlineRuntimeSettingsManifestToDb(manifest, dbPath);
  const exported = readInlineRuntimeSettingsManifestFromDb(dbPath);

  assert.equal(exported.scopes.domains["example.com"].enabled, false);
  assert.deepEqual(exported.scopes.domains["example.com"].targetCurrencies, ["INR"]);
  assert.equal(
    exported.scopes.pages["https://example.com/pricing"].displayStyle,
    "pill",
  );
});

test("admin exporter writes a TypeScript generated manifest", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fx-inline-admin-"));
  const outputPath = path.join(tempDir, "inlineRuntimeSettingsManifest.ts");
  const manifest = createDefaultInlineRuntimeSettingsManifest();

  const writtenPath = writeGeneratedManifestFile(manifest, outputPath);
  const generated = fs.readFileSync(writtenPath, "utf8");

  assert.equal(writtenPath, outputPath);
  assert.match(generated, /GENERATED_INLINE_RUNTIME_SETTINGS_MANIFEST/);
  assert.match(generated, /"targetCurrencies": \[\n {8}"EUR"\n {6}\]/);
});

test("admin save persists settings without exporting generated source", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fx-inline-admin-"));
  const dbPath = path.join(tempDir, "settings.sqlite");
  const outputPath = path.join(tempDir, "inlineRuntimeSettingsManifest.ts");
  const manifest = createDefaultInlineRuntimeSettingsManifest();

  manifest.scopes.allUrls = createDefaultInlineRuntimeSettings({
    targetCurrencies: ["BMD"],
    convertedCurrencyPosition: "left",
    displayStyle: "underline",
    highlightColor: "#abcdef",
  });

  const result = writeInlineRuntimeSettingsManifestToDb(manifest, dbPath);
  const persisted = readInlineRuntimeSettingsManifestFromDb(dbPath);

  assert.equal(Object.hasOwn(result, "outputPath"), false);
  assert.equal(fs.existsSync(outputPath), false);
  assert.equal(result.scopes.allUrls.convertedCurrencyPosition, "left");
  assert.equal(result.scopes.allUrls.highlightColor, "#abcdef");
  assert.equal(persisted.scopes.allUrls.displayStyle, "underline");
});

test("admin shared settings sanitizer normalizes scoped manifest input", () => {
  const manifest = sanitizeInlineRuntimeSettingsManifest({
    generatedAt: "2026-04-28T00:00:00.000Z",
    scopes: {
      allUrls: {
        enabled: false,
        targetCurrencies: ["not-a-code", "gbp"],
        convertedCurrencyPosition: "tooltip",
        displayStyle: "pill",
        highlightColor: "#ABCDEF",
        extraSettings: { nested: { enabled: true } },
      },
      domains: {
        "HTTPS://Example.COM/some/path": {
          targetCurrencies: ["jpy"],
          highlightColor: "invalid",
        },
      },
      pages: {
        "https://Example.COM/pricing#fragment": {
          targetCurrencies: ["cad"],
          convertedCurrencyPosition: "invalid",
          displayStyle: "underline",
        },
        "ftp://example.com/pricing": {
          targetCurrencies: ["usd"],
        },
      },
    },
  });

  assert.equal(normalizeDomainScope(" HTTPS://Store.Example.COM/path "), "store.example.com");
  assert.equal(normalizePageScope("https://example.com/pricing#plans"), "https://example.com/pricing");
  assert.equal(manifest.scopes.allUrls.enabled, false);
  assert.deepEqual(manifest.scopes.allUrls.targetCurrencies, ["GBP"]);
  assert.equal(manifest.scopes.allUrls.highlightColor, "#abcdef");
  assert.deepEqual(Object.keys(manifest.scopes.domains), ["example.com"]);
  assert.deepEqual(manifest.scopes.domains["example.com"].targetCurrencies, ["JPY"]);
  assert.equal(manifest.scopes.domains["example.com"].highlightColor, "#abcdef");
  assert.deepEqual(Object.keys(manifest.scopes.pages), ["https://example.com/pricing"]);
  assert.deepEqual(manifest.scopes.pages["https://example.com/pricing"].targetCurrencies, ["CAD"]);
  assert.equal(
    manifest.scopes.pages["https://example.com/pricing"].convertedCurrencyPosition,
    "tooltip",
  );
});
