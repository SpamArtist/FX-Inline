import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const indexHtml = fs.readFileSync(path.resolve("apps/website/index.html"), "utf8");

describe("magnitude-aware marketing section", () => {
  it("describes magnitude support with concrete pricing examples", () => {
    assert.match(indexHtml, /id="magnitude-title"/);
    assert.match(indexHtml, /Magnitude-aware hints/);
    assert.match(indexHtml, /USD 100K/);
    assert.match(indexHtml, /¥6-13M/);
    assert.match(indexHtml, /₫ 3\.65 tỷ/);
    assert.match(indexHtml, /INR 2 crore/);
    assert.match(indexHtml, /localized magnitude profiles/);
    assert.doesNotMatch(indexHtml, /Magnitutde/);
  });
});
