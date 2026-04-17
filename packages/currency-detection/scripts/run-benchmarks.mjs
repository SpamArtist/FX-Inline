import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCurrencyParser,
} from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");
const fixturesPath = path.join(packageRoot, "test/fixtures/parity-cases.json");
const resultsDir = path.join(packageRoot, "benchmarks/results");
const latestJsonPath = path.join(resultsDir, "latest.json");
const latestMdPath = path.join(resultsDir, "latest.md");

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1),
  );
  return sortedValues[index];
}

function round(number, precision = 4) {
  const factor = 10 ** precision;
  return Math.round(number * factor) / factor;
}

function buildLargeExtractionPayload(extractInputs) {
  const chunks = extractInputs.slice(0, 60);
  return chunks.join(" | ");
}

async function run() {
  const parser = createCurrencyParser();
  const fixtures = JSON.parse(await readFile(fixturesPath, "utf8"));

  const parseInputs = fixtures.parseInputs.slice(0, 300);
  const extractInputs = fixtures.extractInputs.slice(0, 200);
  const quickFilterInputs = fixtures.quickFilterInputs.slice();
  const thousandHintInputs = fixtures.thousandHintInputs.slice();

  const largeExtractionPayload = buildLargeExtractionPayload(extractInputs);
  const adversarialPayload = `${"x".repeat(20000)} USD 123 ${"y".repeat(20000)}`;

  const scenarios = [
    {
      name: "parse.small-batch",
      iterations: 180,
      batchSize: parseInputs.length,
      run: () => {
        for (const input of parseInputs) {
          parser.parseValue(input);
        }
      },
    },
    {
      name: "extract.small-batch",
      iterations: 120,
      batchSize: extractInputs.length,
      run: () => {
        for (const input of extractInputs) {
          parser.extractMatches(input);
        }
      },
    },
    {
      name: "extract.large-payload",
      iterations: 80,
      batchSize: 1,
      run: () => {
        parser.extractMatches(largeExtractionPayload);
      },
    },
    {
      name: "quick-filter.batch",
      iterations: 300,
      batchSize: quickFilterInputs.length + thousandHintInputs.length,
      run: () => {
        for (const input of quickFilterInputs) {
          parser.mayContainCurrencyToken(input);
        }
        for (const input of thousandHintInputs) {
          parser.hasThousandMagnitudeHint(input);
        }
      },
    },
    {
      name: "adversarial.noise",
      iterations: 60,
      batchSize: 1,
      run: () => {
        parser.extractMatches(adversarialPayload);
      },
    },
  ];

  const results = [];

  for (const scenario of scenarios) {
    for (let warmup = 0; warmup < 20; warmup += 1) {
      scenario.run();
    }

    const durations = [];
    const memoryBefore = process.memoryUsage().heapUsed;

    for (let iteration = 0; iteration < scenario.iterations; iteration += 1) {
      const startedAt = performance.now();
      scenario.run();
      durations.push(performance.now() - startedAt);
    }

    const memoryAfter = process.memoryUsage().heapUsed;
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const totalMs = durations.reduce((sum, duration) => sum + duration, 0);
    const meanMs = totalMs / durations.length;
    const p95Ms = percentile(sortedDurations, 95);
    const opCount = scenario.iterations * scenario.batchSize;
    const opsPerSec = opCount / (totalMs / 1000);

    results.push({
      name: scenario.name,
      iterations: scenario.iterations,
      batchSize: scenario.batchSize,
      operationCount: opCount,
      totalMs: round(totalMs),
      meanMs: round(meanMs),
      p95Ms: round(p95Ms),
      opsPerSec: round(opsPerSec),
      memoryDeltaBytes: memoryAfter - memoryBefore,
    });
  }

  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    fixtureSummary: {
      parseInputs: parseInputs.length,
      extractInputs: extractInputs.length,
      quickFilterInputs: quickFilterInputs.length,
      thousandHintInputs: thousandHintInputs.length,
    },
    results,
  };

  const markdownLines = [
    "# Currency Detection Benchmarks",
    "",
    `Generated at: ${output.generatedAt}`,
    `Node: ${output.nodeVersion} (${output.platform}/${output.arch})`,
    "",
    "| Scenario | Ops/Sec | Mean (ms) | P95 (ms) | Iterations | Batch Size |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const result of results) {
    markdownLines.push(
      `| ${result.name} | ${result.opsPerSec} | ${result.meanMs} | ${result.p95Ms} | ${result.iterations} | ${result.batchSize} |`,
    );
  }

  markdownLines.push("");

  await mkdir(resultsDir, { recursive: true });
  await writeFile(latestJsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  await writeFile(latestMdPath, `${markdownLines.join("\n")}\n`, "utf8");

  console.info(`Wrote benchmark JSON: ${latestJsonPath}`);
  console.info(`Wrote benchmark summary: ${latestMdPath}`);
}

await run();
