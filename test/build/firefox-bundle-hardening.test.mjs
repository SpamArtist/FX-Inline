import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const firefoxOutputDirectory = path.resolve(".output/firefox-mv2");
const unsafeInnerHtmlAssignmentPattern = /(?:\.innerHTML|\["innerHTML"\]|\['innerHTML'\])\s*=/u;
const scriptTemplatePattern = /<script>(?:<\\\/script>|\\x3c\/script>)/u;

function listJavaScriptFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...listJavaScriptFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(entryPath);
    }
  }

  return files;
}

function findBundleHardeningViolations(files) {
  const violations = [];

  for (const file of files) {
    const contents = fs.readFileSync(file, "utf8");
    const relativePath = path.relative(process.cwd(), file);

    if (unsafeInnerHtmlAssignmentPattern.test(contents)) {
      violations.push(`${relativePath}: direct innerHTML assignment`);
    }

    if (scriptTemplatePattern.test(contents)) {
      violations.push(`${relativePath}: script template via HTML parser`);
    }
  }

  return violations;
}

test("Firefox bundle avoids direct innerHTML sinks", () => {
  assert.equal(
    fs.existsSync(firefoxOutputDirectory),
    true,
    "Run `wxt build -b firefox` before this test.",
  );

  const javascriptFiles = listJavaScriptFiles(firefoxOutputDirectory);
  assert.ok(javascriptFiles.length > 0, "Firefox build should emit JavaScript files.");

  assert.deepEqual(findBundleHardeningViolations(javascriptFiles), []);
});
