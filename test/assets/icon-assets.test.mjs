import { test } from "node:test";
import assert from "node:assert/strict";
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
