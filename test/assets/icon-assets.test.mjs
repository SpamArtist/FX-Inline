import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertIconAssets,
  extensionIcons,
  storeListingIcon,
} from "../../scripts/optimize-icons.mjs";

test("icon assets are optimized and the 512 listing icon is outside extension public assets", async () => {
  const stats = await assertIconAssets();
  const statsByPath = new Map(stats.map((entry) => [entry.icon.path, entry.stats]));

  for (const icon of [...extensionIcons, storeListingIcon]) {
    assert.equal(statsByPath.get(icon.path)?.width, icon.size);
    assert.equal(statsByPath.get(icon.path)?.height, icon.size);
  }
});

test("build icon optimization runs on the host architecture without a system executable", async (t) => {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fx-inline-icons-"));
  t.after(() => fs.rm(fixtureRoot, { recursive: true, force: true }));
  const iconDirectory = path.join(fixtureRoot, ".output", "chrome-mv3", "icon");
  await fs.mkdir(iconDirectory, { recursive: true });
  await fs.symlink(path.resolve("node_modules"), path.join(fixtureRoot, "node_modules"), "junction");
  const source = await fs.readFile(extensionIcons[0].path);
  const iconPath = path.join(iconDirectory, "16.png");
  await fs.writeFile(iconPath, source);

  const scriptPath = fileURLToPath(new URL("../../scripts/optimize-icons.mjs", import.meta.url));
  for (const optimizerPath of [process.env.PATH, ""]) {
    const result = spawnSync(process.execPath, [scriptPath, "--build-output"], {
      cwd: fixtureRoot,
      encoding: "utf8",
      env: { ...process.env, PATH: optimizerPath },
    });

    assert.equal(result.status, 0, result.stderr || result.error?.message);
  }
  const optimized = await fs.readFile(iconPath);
  assert.deepEqual(optimized.subarray(0, 8), source.subarray(0, 8));
  assert.equal(optimized.readUInt32BE(16), 16);
  assert.equal(optimized.readUInt32BE(20), 16);
  assert.ok(optimized.byteLength <= source.byteLength);
});
