#!/usr/bin/env node

import {
  DEFAULT_EXTENSION_ASSET_DIR,
  formatBytes,
  optimizeExtensionAssets,
} from "./extension-build-policy.mjs";

const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const assetDirArg = process.argv
  .slice(2)
  .find((arg) => !arg.startsWith("--"));
const assetDir = assetDirArg ?? DEFAULT_EXTENSION_ASSET_DIR;
const results = await optimizeExtensionAssets({ assetDir, write });
const changedResults = results.filter((result) => result.changed);

if (changedResults.length === 0) {
  console.log(`PNG assets already optimized in ${assetDir}.`);
  process.exit(0);
}

for (const result of changedResults) {
  const action = write ? "Optimized" : "Can optimize";
  console.log(
    `${action} ${result.relativePath}: ${formatBytes(result.originalBytes)} -> ${formatBytes(result.optimizedBytes)} (${formatBytes(result.savedBytes)} saved)`,
  );
}

if (!write) {
  console.error("Run npm run assets:optimize to apply PNG recompression.");
  process.exitCode = 1;
}
