import assert from "node:assert/strict";
import test from "node:test";

import {
  EXTENSION_DEV_OPTIMIZE_DEPS_EXCLUDE,
  extensionDevDependencyOptimizerGuard,
  removeExtensionDevOptimizedDeps,
} from "../../wxt.config.ts";

test("extension dev optimizer excludes Preact deps from Vite pre-bundling", () => {
  const optimizeDeps = {
    exclude: ["virtual:app-config", "preact"],
    include: [
      "preact",
      "preact/hooks",
      "preact/debug",
      "preact/devtools",
      "preact/jsx-runtime",
      "preact/jsx-dev-runtime",
      "preact/compat",
      "@prefresh/core",
      "@prefresh/utils",
      "@wxt-dev/storage",
    ],
  };

  removeExtensionDevOptimizedDeps(optimizeDeps);

  assert.deepEqual(optimizeDeps.include, ["@wxt-dev/storage"]);
  assert.equal(
    optimizeDeps.exclude.length,
    new Set(optimizeDeps.exclude).size,
    "exclude list should stay deduplicated",
  );

  for (const dep of EXTENSION_DEV_OPTIMIZE_DEPS_EXCLUDE) {
    assert.ok(
      optimizeDeps.exclude.includes(dep),
      `expected ${dep} to be excluded from dependency optimization`,
    );
  }
});

test("extension dev optimizer guard runs after Preact preset config", () => {
  const plugin = extensionDevDependencyOptimizerGuard();

  assert.equal(plugin.apply, "serve");
  assert.equal(plugin.enforce, "post");
});
