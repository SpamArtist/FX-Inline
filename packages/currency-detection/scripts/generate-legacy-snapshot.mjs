import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const fixturesPath = path.join(
  repoRoot,
  "packages/currency-detection/test/fixtures/parity-cases.json",
);
const snapshotPath = path.join(
  repoRoot,
  "packages/currency-detection/test/fixtures/legacy-snapshot.json",
);
const legacyModulePath = path.join(
  repoRoot,
  "apps/extension/test-dist/utils/utils.js",
);
const legacyUtilsDir = path.join(repoRoot, "apps/extension/test-dist/utils");

async function materializeLegacyParserForNode() {
  const tmpRoot = await mkdtemp(path.join(repoRoot, ".legacy-parser-"));
  const files = await readdir(legacyUtilsDir, { withFileTypes: true });
  const importPattern = new RegExp('from "(\\./[^".]+)"', "g");

  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith(".js")) continue;
    const sourcePath = path.join(legacyUtilsDir, file.name);
    const targetPath = path.join(tmpRoot, file.name);
    const source = await readFile(sourcePath, "utf8");

    const rewritten = source.replace(importPattern, 'from "$1.js"');

    await writeFile(targetPath, rewritten, "utf8");
  }

  return {
    tmpRoot,
    modulePath: path.join(tmpRoot, "utils.js"),
  };
}

const fixtures = JSON.parse(await readFile(fixturesPath, "utf8"));

let legacy;
let stagedLegacy;
try {
  stagedLegacy = await materializeLegacyParserForNode();
  legacy = await import(pathToFileURL(stagedLegacy.modulePath).href);
} catch (error) {
  throw new Error(
    `Legacy parser build artifact missing at ${legacyModulePath}. Run npm run build:unit first. ${error}`,
  );
} finally {
  if (stagedLegacy?.tmpRoot) {
    await rm(stagedLegacy.tmpRoot, { recursive: true, force: true });
  }
}

const snapshot = {
  schemaVersion: 1,
  source: "apps/extension/utils/utils.ts (compiled via apps/extension/test-dist/utils/utils.js)",
  fixtureSchemaVersion: fixtures.schemaVersion,
  parseResults: fixtures.parseInputs.map((input) => ({
    input,
    output: legacy.parseCurrencyValue(input),
  })),
  extractResults: fixtures.extractInputs.map((input) => ({
    input,
    output: legacy.extractCurrencyTextMatches(input),
  })),
  quickFilterResults: fixtures.quickFilterInputs.map((input) => ({
    input,
    output: legacy.mayContainCurrencyToken(input),
  })),
  thousandHintResults: fixtures.thousandHintInputs.map((input) => ({
    input,
    output: legacy.hasThousandMagnitudeHint(input),
  })),
};

await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.info(`Wrote legacy snapshot: ${snapshotPath}`);
