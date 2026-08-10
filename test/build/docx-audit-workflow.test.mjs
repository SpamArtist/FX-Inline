import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const workflow = readFileSync(
  join(import.meta.dirname, "../../.github/workflows/docx-pull-request-audit.yml"),
  "utf8",
);

test("DocX bundle upload includes its hidden head marker", () => {
  const uploadStep = workflow.match(
    /- name: Upload Extension Bundle Artifact[\s\S]*?(?=\n {2}\w|$)/,
  )?.[0];

  assert.ok(uploadStep, "expected Extension Bundle Artifact upload step");
  assert.match(uploadStep, /path: docx-extension-bundle/);
  assert.match(uploadStep, /include-hidden-files: true/);
});
