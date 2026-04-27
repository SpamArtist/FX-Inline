import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createDefaultInlineRuntimeSettings,
  createDefaultInlineRuntimeSettingsManifest,
  readInlineRuntimeSettingsManifestFromDb,
  saveAndExportInlineRuntimeSettingsManifest,
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
  assert.equal(manifest.scopes.allUrls.fontColor, "#355aa8");
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

test("admin save persists settings and exports the generated manifest", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fx-inline-admin-"));
  const dbPath = path.join(tempDir, "settings.sqlite");
  const outputPath = path.join(tempDir, "inlineRuntimeSettingsManifest.ts");
  const manifest = createDefaultInlineRuntimeSettingsManifest();

  manifest.scopes.allUrls = createDefaultInlineRuntimeSettings({
    targetCurrencies: ["BMD"],
    convertedCurrencyPosition: "left",
    displayStyle: "underline",
    highlightColor: "#abcdef",
    fontColor: "#123456",
  });

  const result = saveAndExportInlineRuntimeSettingsManifest(manifest, {
    dbPath,
    outputPath,
  });
  const persisted = readInlineRuntimeSettingsManifestFromDb(dbPath);
  const generated = fs.readFileSync(outputPath, "utf8");

  assert.equal(result.outputPath, outputPath);
  assert.equal(result.manifest.scopes.allUrls.convertedCurrencyPosition, "left");
  assert.equal(result.manifest.scopes.allUrls.highlightColor, "#abcdef");
  assert.equal(result.manifest.scopes.allUrls.fontColor, "#123456");
  assert.equal(persisted.scopes.allUrls.displayStyle, "underline");
  assert.match(generated, /"targetCurrencies": \[\n {8}"BMD"\n {6}\]/);
  assert.match(generated, /"convertedCurrencyPosition": "left"/);
  assert.match(generated, /"fontColor": "#123456"/);
});
