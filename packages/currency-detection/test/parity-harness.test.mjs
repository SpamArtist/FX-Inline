import { expect, test } from "@jest/globals";
import { readFile } from "node:fs/promises";
import path from "node:path";
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
    expect(parseCurrencyValue(fixture.input)).toEqual(fixture.output);
  }
});

test("parity harness: extractMatches outputs match legacy snapshot", async () => {
  const snapshot = await loadSnapshot();

  for (const fixture of snapshot.extractResults) {
    expect(extractCurrencyTextMatches(fixture.input)).toEqual(fixture.output);
  }
});

test("parity harness: quick filter output matches legacy snapshot", async () => {
  const snapshot = await loadSnapshot();

  for (const fixture of snapshot.quickFilterResults) {
    expect(mayContainCurrencyToken(fixture.input)).toBe(fixture.output);
  }
});

test("parity harness: thousand hint output matches legacy snapshot", async () => {
  const snapshot = await loadSnapshot();

  for (const fixture of snapshot.thousandHintResults) {
    expect(hasThousandMagnitudeHint(fixture.input)).toBe(fixture.output);
  }
});
