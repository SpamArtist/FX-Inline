import assert from "node:assert/strict";
import test from "node:test";
import {
  DISPLAY_STYLE_OPTIONS,
  getDisplayStylePreview,
} from "../../apps/admin/src/settingsConstants.js";

test("display style previews use the active target currency", () => {
  const previews = DISPLAY_STYLE_OPTIONS.map((style) =>
    getDisplayStylePreview(style.value, "AUD"),
  );

  assert.deepEqual(previews, ["AUD 90", "AUD 90", "AUD 90", "(AUD 90)"]);
});

test("display style options do not carry hardcoded preview currency text", () => {
  assert.equal(
    DISPLAY_STYLE_OPTIONS.some((style) => Object.hasOwn(style, "preview")),
    false,
  );
});
