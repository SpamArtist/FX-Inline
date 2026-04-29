import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { lintBuildOutput } from "../../scripts/release/lint-build-output.mjs";

function createTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fx-inline-release-lint-"));
}

function writeFile(filePath, content = "") {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeCleanBuild(repoDir) {
  const buildDir = path.join(repoDir, ".output", "chrome-mv3");
  const manifest = {
    manifest_version: 3,
    name: "FX Inline",
    version: "0.4.1",
    action: {
      default_popup: "popup.html",
      default_title: "FX Inline",
    },
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
      512: "icon/512.png",
    },
  };

  writeFile(path.join(buildDir, "manifest.json"), JSON.stringify(manifest));
  writeFile(
    path.join(buildDir, "popup.html"),
    '<!doctype html><title>FX Inline</title><script type="module" src="/chunks/popup.js"></script>',
  );
  writeFile(path.join(buildDir, "chunks", "popup.js"), 'import "./browser-a1b2.js";');
  writeFile(path.join(buildDir, "chunks", "browser-a1b2.js"), "export const b = chrome;");

  for (const size of ["16", "32", "48", "128", "512"]) {
    writeFile(path.join(buildDir, "icon", `${size}.png`));
  }

  return buildDir;
}

test("release build lint accepts branded output with referenced assets", async () => {
  const repoDir = createTempRepo();
  writeCleanBuild(repoDir);

  await assert.doesNotReject(
    lintBuildOutput({
      cwd: repoDir,
      sourceFiles: [],
    }),
  );
});

test("release build lint rejects scaffold popup titles", async () => {
  const repoDir = createTempRepo();
  const buildDir = writeCleanBuild(repoDir);
  const manifestPath = path.join(buildDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.action.default_title = "Default Popup Title";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  await assert.rejects(
    lintBuildOutput({
      cwd: repoDir,
      sourceFiles: [],
    }),
    /Default Popup Title|action\.default_title/u,
  );
});

test("release build lint rejects the 1970 generatedAt sentinel", async () => {
  const repoDir = createTempRepo();
  const buildDir = writeCleanBuild(repoDir);
  writeFile(
    path.join(buildDir, "content-scripts", "content.js"),
    'const generatedAt = "1970-01-01T00:00:00.000Z";',
  );

  await assert.rejects(
    lintBuildOutput({
      cwd: repoDir,
      sourceFiles: [],
    }),
    /1970 generatedAt sentinel/u,
  );
});

test("release build lint rejects nonessential 96px icons", async () => {
  const repoDir = createTempRepo();
  const buildDir = writeCleanBuild(repoDir);
  const manifestPath = path.join(buildDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.icons["96"] = "icon/96.png";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  writeFile(path.join(buildDir, "icon", "96.png"));

  await assert.rejects(
    lintBuildOutput({
      cwd: repoDir,
      sourceFiles: [],
    }),
    /96px icon/u,
  );
});

test("release build lint rejects obvious copied orphan image output", async () => {
  const repoDir = createTempRepo();
  const buildDir = writeCleanBuild(repoDir);
  writeFile(path.join(buildDir, "fx-inline-logo.svg"), "<svg />");

  await assert.rejects(
    lintBuildOutput({
      cwd: repoDir,
      sourceFiles: [],
    }),
    /orphaned copied image assets/u,
  );
});

test("release build lint scans selected source files for release placeholders", async () => {
  const repoDir = createTempRepo();
  writeCleanBuild(repoDir);
  writeFile(
    path.join(repoDir, "apps", "extension", "generated", "inlineRuntimeSettingsManifest.ts"),
    'export const manifest = { generatedAt: "1970-01-01T00:00:00.000Z" };',
  );

  await assert.rejects(
    lintBuildOutput({
      cwd: repoDir,
      sourceFiles: ["apps/extension/generated/inlineRuntimeSettingsManifest.ts"],
    }),
    /1970 generatedAt sentinel/u,
  );
});
