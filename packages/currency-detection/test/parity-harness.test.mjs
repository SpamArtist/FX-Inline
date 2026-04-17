import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  extractCurrencyTextMatches,
  hasThousandMagnitudeHint,
  mayContainCurrencyToken,
  parseCurrencyValue,
} from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const snapshotPath = path.join(__dirname, "fixtures/legacy-snapshot.json");

async function loadSnapshot() {
  try {
    const raw = await readFile(snapshotPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Missing legacy snapshot at ${snapshotPath}. Run npm run currency-detection:baseline. ${error}`,
    );
  }
}

test("parity harness: parseValue outputs match legacy snapshot", async () => {
  const snapshot = await loadSnapshot();

  for (const fixture of snapshot.parseResults) {
    assert.deepStrictEqual(parseCurrencyValue(fixture.input), fixture.output, fixture.input);
  }
});

test("parity harness: extractMatches outputs match legacy snapshot", async () => {
  const snapshot = await loadSnapshot();

  for (const fixture of snapshot.extractResults) {
    assert.deepStrictEqual(
      extractCurrencyTextMatches(fixture.input),
      fixture.output,
      fixture.input,
    );
  }
});

test("parity harness: quick filter output matches legacy snapshot", async () => {
  const snapshot = await loadSnapshot();

  for (const fixture of snapshot.quickFilterResults) {
    assert.equal(mayContainCurrencyToken(fixture.input), fixture.output, fixture.input);
  }
});

test("parity harness: thousand hint output matches legacy snapshot", async () => {
  const snapshot = await loadSnapshot();

  for (const fixture of snapshot.thousandHintResults) {
    assert.equal(hasThousandMagnitudeHint(fixture.input), fixture.output, fixture.input);
  }
});
