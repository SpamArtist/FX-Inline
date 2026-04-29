import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  BUILD_POLICY,
  findBuildPolicyViolations,
  optimizePngBuffer,
} from "../../scripts/build/extension-build-policy.mjs";

test("build policy rejects scaffold manifest and html placeholders", async () => {
  const buildDir = await createBuildFixture({
    manifest: {
      manifest_version: 3,
      name: "FX Inline",
      action: {
        default_title: "Default Popup Title",
      },
    },
    html: {
      "popup.html": '<title>Default Popup Title</title>',
    },
  });

  const violations = await findBuildPolicyViolations({
    buildDir,
    policy: relaxedPolicy(),
  });
  const violationIds = violations.map((violation) => violation.id);

  assert.ok(violationIds.includes("forbidden-manifest-default"));
  assert.ok(violationIds.includes("forbidden-html-placeholder"));
});

test("build policy rejects exact duplicate css assets", async () => {
  const buildDir = await createBuildFixture({
    html: {
      "options.html": '<link rel="stylesheet" href="/assets/options.css">',
      "popup.html": '<link rel="stylesheet" href="/assets/popup.css">',
    },
    css: {
      "assets/options.css": ".fx-inline-button { color: red; }",
      "assets/popup.css": ".fx-inline-button { color: red; }",
    },
  });

  const violations = await findBuildPolicyViolations({
    buildDir,
    policy: relaxedPolicy(),
  });

  assert.ok(
    violations.some((violation) => violation.id === "duplicate-css"),
    "expected duplicate-css violation",
  );
});

test("build policy allows documented near-duplicate css baseline", async () => {
  const sharedCss = ".fx-inline-shell{display:grid;place-items:center;}".repeat(30);
  const buildDir = await createBuildFixture({
    html: {
      "options.html": '<link rel="stylesheet" href="/assets/options.css">',
      "popup.html": '<link rel="stylesheet" href="/assets/popup.css">',
    },
    css: {
      "assets/options.css": `${sharedCss}.fx-inline-options{max-width:420px;}`,
      "assets/popup.css": `${sharedCss}.fx-inline-popup{width:360px;}`,
    },
  });

  const violations = await findBuildPolicyViolations({
    buildDir,
    policy: relaxedPolicy(),
  });

  assert.equal(
    violations.some((violation) => violation.id === "near-duplicate-css"),
    false,
  );
});

test("build policy rejects chunks over the configured size budget", async () => {
  const buildDir = await createBuildFixture({
    js: {
      "chunks/react-vendor-test.js": "console.log('oversized chunk');",
    },
  });
  const policy = relaxedPolicy();
  policy.byteBudgets.sharedChunk = 8;

  const violations = await findBuildPolicyViolations({
    buildDir,
    policy,
  });

  assert.ok(
    violations.some((violation) => violation.id === "shared-chunk-size"),
    "expected shared-chunk-size violation",
  );
});

test("build policy rejects missing required manual chunk prefixes", async () => {
  const buildDir = await createBuildFixture({
    js: {
      "chunks/react-vendor-test.js": "console.log('react');",
    },
  });
  const policy = relaxedPolicy();
  policy.requiredChunkPrefixes = ["react-vendor", "extension-storage"];

  const violations = await findBuildPolicyViolations({
    buildDir,
    policy,
  });

  assert.ok(
    violations.some((violation) => violation.id === "missing-manual-chunk"),
    "expected missing-manual-chunk violation",
  );
});

test("png optimizer preserves already compact non-png input", () => {
  const source = Buffer.from("not a png");

  assert.equal(optimizePngBuffer(source), source);
});

async function createBuildFixture({
  manifest = { manifest_version: 3, name: "FX Inline" },
  html = {},
  css = {},
  js = {},
} = {}) {
  const buildDir = await fs.mkdtemp(path.join(os.tmpdir(), "fx-inline-build-"));
  await fs.writeFile(
    path.join(buildDir, "manifest.json"),
    JSON.stringify(manifest),
  );

  for (const [relativePath, contents] of Object.entries(html)) {
    await writeFixtureFile(buildDir, relativePath, contents);
  }

  for (const [relativePath, contents] of Object.entries(css)) {
    await writeFixtureFile(buildDir, relativePath, contents);
  }

  for (const [relativePath, contents] of Object.entries(js)) {
    await writeFixtureFile(buildDir, relativePath, contents);
  }

  return buildDir;
}

async function writeFixtureFile(buildDir, relativePath, contents) {
  const absolutePath = path.join(buildDir, relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, contents);
}

function relaxedPolicy() {
  return {
    ...BUILD_POLICY,
    byteBudgets: {
      ...BUILD_POLICY.byteBudgets,
      totalBuild: Number.MAX_SAFE_INTEGER,
      backgroundScript: Number.MAX_SAFE_INTEGER,
      contentScript: Number.MAX_SAFE_INTEGER,
      htmlEntryChunk: Number.MAX_SAFE_INTEGER,
      sharedChunk: Number.MAX_SAFE_INTEGER,
      cssFile: Number.MAX_SAFE_INTEGER,
      totalPngAssets: Number.MAX_SAFE_INTEGER,
      pngAssetsByPath: {},
    },
    requiredChunkPrefixes: [],
  };
}
