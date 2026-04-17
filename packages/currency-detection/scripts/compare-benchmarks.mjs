import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");
const resultsDir = path.join(packageRoot, "benchmarks/results");

const latestJsonPath = path.join(resultsDir, "latest.json");
const baselineJsonPath = path.join(resultsDir, "baseline.json");
const comparisonMdPath = path.join(resultsDir, "comparison.md");

function toResultMap(results) {
  return new Map(results.map((entry) => [entry.name, entry]));
}

function pctDelta(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

function formatPct(value) {
  if (value == null) return "n/a";
  const rounded = Math.round(value * 100) / 100;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

async function run() {
  const latest = JSON.parse(await readFile(latestJsonPath, "utf8"));

  let baseline;
  try {
    baseline = JSON.parse(await readFile(baselineJsonPath, "utf8"));
  } catch {
    baseline = null;
  }

  const lines = [
    "# Currency Detection Benchmark Comparison",
    "",
    `Latest: ${latest.generatedAt}`,
  ];

  if (!baseline) {
    lines.push("Baseline: not found (`benchmarks/results/baseline.json`)");
    lines.push("");
    lines.push("No comparison performed. This is info-only mode.");
    lines.push("");
    lines.push("| Scenario | Ops/Sec | Mean (ms) | P95 (ms) |",
      "| --- | ---: | ---: | ---: |");

    for (const result of latest.results) {
      lines.push(
        `| ${result.name} | ${result.opsPerSec} | ${result.meanMs} | ${result.p95Ms} |`,
      );
    }

    await writeFile(comparisonMdPath, `${lines.join("\n")}\n`, "utf8");
    console.info(`Wrote benchmark comparison: ${comparisonMdPath}`);
    return;
  }

  lines.push(`Baseline: ${baseline.generatedAt}`);
  lines.push("");
  lines.push(
    "| Scenario | Ops/Sec Δ | Mean (ms) Δ | P95 (ms) Δ | Latest Ops/Sec | Latest Mean | Latest P95 |",
  );
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");

  const baselineMap = toResultMap(baseline.results);

  for (const result of latest.results) {
    const prior = baselineMap.get(result.name);
    if (!prior) {
      lines.push(
        `| ${result.name} | n/a | n/a | n/a | ${result.opsPerSec} | ${result.meanMs} | ${result.p95Ms} |`,
      );
      continue;
    }

    const opsDelta = pctDelta(result.opsPerSec, prior.opsPerSec);
    const meanDelta = pctDelta(result.meanMs, prior.meanMs);
    const p95Delta = pctDelta(result.p95Ms, prior.p95Ms);

    lines.push(
      `| ${result.name} | ${formatPct(opsDelta)} | ${formatPct(meanDelta)} | ${formatPct(p95Delta)} | ${result.opsPerSec} | ${result.meanMs} | ${result.p95Ms} |`,
    );
  }

  await writeFile(comparisonMdPath, `${lines.join("\n")}\n`, "utf8");
  console.info(`Wrote benchmark comparison: ${comparisonMdPath}`);
}

await run();
