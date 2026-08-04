import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const scriptPath = path.join(
  repoRoot,
  "packages",
  "inline-runtime",
  "scripts",
  "measure-full-conversion-performance.mjs",
);

test("full conversion performance harness writes comparable offline report", () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "fx-inline-perf-"));
  const outputPath = path.join(outputDir, "baseline-full-conversion.json");

  execFileSync(
    process.execPath,
    [
      scriptPath,
      "--label",
      "baseline",
      "--runs",
      "2",
      "--warmup-runs",
      "1",
      "--output",
      outputPath,
      "--quiet",
    ],
    {
      cwd: repoRoot,
      stdio: "pipe",
    },
  );

  const report = JSON.parse(fs.readFileSync(outputPath, "utf8"));

  expect(report).toEqual(
    expect.objectContaining({
      schemaVersion: 1,
      reportType: "full-conversion-performance",
      label: "baseline",
      informationOnly: true,
    }),
  );
  expect(report.methodology).toEqual(
    expect.objectContaining({
      cold: expect.stringContaining("Clear parser"),
      warm: expect.stringContaining("reuse parser"),
      domReset: expect.stringContaining("fixed input"),
      verification: expect.stringContaining("exact expected DOM"),
      timeLimit: "No pass/fail time threshold.",
    }),
  );
  expect(report.runtime).toEqual(
    expect.objectContaining({
      node: expect.stringMatching(/^v/u),
      platform: process.platform,
      arch: process.arch,
    }),
  );
  for (const mode of ["cold", "warm"]) {
    expect(report.summary[mode].runs).toBe(2);
    expect(report.summary[mode].totalMs).toEqual({
      median: expect.any(Number),
      p95: expect.any(Number),
    });
    for (const phase of ["setupMs", "discoveryMs", "analysisMs", "renderMs"]) {
      expect(report.summary[mode].phases[phase]).toEqual({
        median: expect.any(Number),
        p95: expect.any(Number),
      });
    }
    expect(report.samples[mode]).toHaveLength(2);
  }
  expect(report.fixture.expectedConversionCount).toBe(37);
});
