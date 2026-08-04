import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { __clearDefaultParserCachesForTests } from "@fx-inline/currency-detection";
import {
  __clearCurrencyFormatterCacheForTests,
  __startCurrencyFormatterPerfCaptureForTests,
  __stopCurrencyFormatterPerfCaptureForTests,
  convertVisiblePrices,
} from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(
  __dirname,
  "..",
  "test",
  "fixtures",
  "performance",
  "apts-jp-first-page",
);
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const phaseNames = ["setupMs", "discoveryMs", "analysisMs", "renderMs"];
const formatterMetricNames = [
  "cacheLookupMs",
  "formatterConstructionMs",
  "formatCallMs",
];

function parseArgs(argv) {
  const args = {
    label: "candidate",
    runs: 25,
    warmupRuns: 1,
    outDir: path.join(repoRoot, "performance-traces", "full-conversion"),
    output: null,
    quiet: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--label" && next) {
      args.label = next;
      index += 1;
    } else if (arg === "--runs" && next) {
      args.runs = Number(next);
      index += 1;
    } else if (arg === "--warmup-runs" && next) {
      args.warmupRuns = Number(next);
      index += 1;
    } else if (arg === "--out-dir" && next) {
      args.outDir = path.resolve(next);
      index += 1;
    } else if (arg === "--output" && next) {
      args.output = path.resolve(next);
      index += 1;
    } else if (arg === "--quiet") {
      args.quiet = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  if (!Number.isInteger(args.runs) || args.runs < 1) {
    throw new Error("--runs must be a positive integer.");
  }
  if (!Number.isInteger(args.warmupRuns) || args.warmupRuns < 0) {
    throw new Error("--warmup-runs must be a non-negative integer.");
  }
  if (!/^[a-z0-9._-]+$/iu.test(args.label)) {
    throw new Error("--label must contain only letters, digits, dot, dash, or underscore.");
  }

  return args;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readFixture() {
  const metadata = JSON.parse(
    fs.readFileSync(path.join(fixtureDir, "metadata.json"), "utf8"),
  );
  const inputHtml = fs.readFileSync(path.join(fixtureDir, metadata.inputFile), "utf8");
  const expectedDom = fs.readFileSync(
    path.join(fixtureDir, metadata.expectedDomFile),
    "utf8",
  );

  const inputSha256 = sha256(inputHtml);
  const expectedDomSha256 = sha256(expectedDom);
  if (inputSha256 !== metadata.inputSha256) {
    throw new Error(
      `Fixture input hash mismatch: expected ${metadata.inputSha256}, got ${inputSha256}`,
    );
  }
  if (expectedDomSha256 !== metadata.expectedDomSha256) {
    throw new Error(
      `Fixture expected DOM hash mismatch: expected ${metadata.expectedDomSha256}, got ${expectedDomSha256}`,
    );
  }

  return {
    metadata,
    inputHtml,
    expectedDom,
    inputSha256,
    expectedDomSha256,
  };
}

function installDomGlobals(dom) {
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Node = dom.window.Node;
  globalThis.NodeFilter = dom.window.NodeFilter;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLSpanElement = dom.window.HTMLSpanElement;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
}

function loadFixtureDocument(inputHtml) {
  const dom = new JSDOM(inputHtml, {
    contentType: "text/html",
    includeNodeLocations: false,
    pretendToBeVisual: true,
    url: "https://apts.jp/",
  });
  installDomGlobals(dom);
  return dom;
}

function clearMeasuredCaches() {
  __clearDefaultParserCachesForTests();
  __clearCurrencyFormatterCacheForTests();
}

function runConversion(fixture, mode, runIndex, measured) {
  const dom = loadFixtureDocument(fixture.inputHtml);
  const samples = [];
  let formatterPerf = null;
  let applied = 0;

  if (measured) {
    __startCurrencyFormatterPerfCaptureForTests();
  }

  try {
    applied = convertVisiblePrices(
      fixture.metadata.settings.targetCurrency,
      {
        base: fixture.metadata.ratesBase,
        fetchedAt: fixture.metadata.ratesFetchedAt,
        source: "apts.jp fixture fixed rates",
        rates: fixture.metadata.rates,
      },
      document.body,
      {
        clearExisting: fixture.metadata.settings.clearExisting,
        includeDefaultPrePlugins: fixture.metadata.settings.includeDefaultPrePlugins,
        includeDefaultPostPlugins: fixture.metadata.settings.includeDefaultPostPlugins,
        clientRenderPreferences: {
          default: {
            convertedCurrencyPosition:
              fixture.metadata.settings.convertedCurrencyPosition,
            displayStyle: fixture.metadata.settings.displayStyle,
          },
        },
        onPerfSample: (sample) => samples.push(sample),
      },
    );
  } finally {
    if (measured) {
      formatterPerf = __stopCurrencyFormatterPerfCaptureForTests();
    }
  }

  const actualDom = `${document.documentElement.outerHTML}\n`;
  if (applied !== fixture.metadata.expectedConversionCount) {
    throw new Error(
      `${mode} run ${runIndex} applied ${applied}, expected ${fixture.metadata.expectedConversionCount}`,
    );
  }
  if (actualDom !== fixture.expectedDom) {
    throw new Error(`${mode} run ${runIndex} DOM mismatch.`);
  }
  if (samples.length !== 1) {
    throw new Error(`${mode} run ${runIndex} captured ${samples.length} perf samples.`);
  }

  dom.window.close();
  return measured
    ? {
        mode,
        runIndex,
        ...samples[0],
        formatterPerf,
      }
    : null;
}

function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

function summarizeMetric(samples, metricName) {
  const values = samples.map((sample) => sample.formatterPerf[metricName]);
  return {
    median: percentile(values, 50),
    p95: percentile(values, 95),
  };
}

function summarizeFormatterSamples(samples) {
  const metricSummary = Object.fromEntries(
    formatterMetricNames.map((metricName) => [
      metricName,
      summarizeMetric(samples, metricName),
    ]),
  );

  return {
    ...metricSummary,
    counts: {
      cacheLookupCount: samples[0]?.formatterPerf.cacheLookupCount ?? null,
      formatterConstructionCount:
        samples[0]?.formatterPerf.formatterConstructionCount ?? null,
      formatCallCount: samples[0]?.formatterPerf.formatCallCount ?? null,
      cacheHits: samples[0]?.formatterPerf.cacheHits ?? null,
      cacheMisses: samples[0]?.formatterPerf.cacheMisses ?? null,
      fallbackCount: samples[0]?.formatterPerf.fallbackCount ?? null,
    },
  };
}

function summarizeSamples(samples) {
  const totalValues = samples.map((sample) => sample.totalMs);
  const phases = Object.fromEntries(
    phaseNames.map((phaseName) => {
      const values = samples.map((sample) => sample[phaseName]);
      return [
        phaseName,
        {
          median: percentile(values, 50),
          p95: percentile(values, 95),
        },
      ];
    }),
  );

  return {
    runs: samples.length,
    totalMs: {
      median: percentile(totalValues, 50),
      p95: percentile(totalValues, 95),
    },
    phases,
    formatter: summarizeFormatterSamples(samples),
    counters: {
      visitedTextNodes: samples[0]?.visitedTextNodes ?? null,
      acceptedCandidates: samples[0]?.acceptedCandidates ?? null,
      scannedTextNodes: samples[0]?.scannedTextNodes ?? null,
      conversionsApplied: samples[0]?.conversionsApplied ?? null,
      reachedNodeLimit: samples[0]?.reachedNodeLimit ?? null,
    },
  };
}

function getRuntimeInfo() {
  const cpus = os.cpus();
  return {
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    cpuModel: cpus[0]?.model ?? null,
    cpuCount: cpus.length,
  };
}

function createReport(args, fixture) {
  const coldSamples = [];
  const warmSamples = [];

  for (let index = 0; index < args.runs; index += 1) {
    clearMeasuredCaches();
    coldSamples.push(runConversion(fixture, "cold", index + 1, true));
  }

  clearMeasuredCaches();
  for (let index = 0; index < args.warmupRuns; index += 1) {
    runConversion(fixture, "warmup", index + 1, false);
  }
  for (let index = 0; index < args.runs; index += 1) {
    warmSamples.push(runConversion(fixture, "warm", index + 1, true));
  }

  return {
    schemaVersion: 1,
    reportType: "full-conversion-performance",
    label: args.label,
    generatedAt: new Date().toISOString(),
    informationOnly: true,
    fixture: {
      name: fixture.metadata.fixtureName,
      sourceUrl: fixture.metadata.sourceUrl,
      inputSha256: fixture.inputSha256,
      expectedDomSha256: fixture.expectedDomSha256,
      expectedConversionCount: fixture.metadata.expectedConversionCount,
      expectedPerfCounters: fixture.metadata.expectedPerfCounters,
      settings: fixture.metadata.settings,
      ratesBase: fixture.metadata.ratesBase,
      ratesFetchedAt: fixture.metadata.ratesFetchedAt,
    },
    methodology: {
      cold: "Clear parser and currency formatter caches before each measured run.",
      warm: "Clear caches once, run warmups, then reuse parser and currency formatter caches for measured runs.",
      domReset: "Create a new JSDOM document from fixed input before each warmup and measured run.",
      formatterBreakdown: "Measured runs separately capture currency formatter cache lookup, Intl.NumberFormat construction, and formatter.format call cost inside conversion.",
      verification: "Each measured run must match expected conversion count and exact expected DOM.",
      timeLimit: "No pass/fail time threshold.",
    },
    runtime: getRuntimeInfo(),
    summary: {
      cold: summarizeSamples(coldSamples),
      warm: summarizeSamples(warmSamples),
    },
    samples: {
      cold: coldSamples,
      warm: warmSamples,
    },
  };
}

function writeReport(args, report) {
  const outputPath =
    args.output ?? path.join(args.outDir, `${args.label}-full-conversion.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return outputPath;
}

function formatMs(value) {
  return `${value.toFixed(3)}ms`;
}

function printSummary(report, outputPath) {
  const cold = report.summary.cold.totalMs;
  const warm = report.summary.warm.totalMs;
  console.log(`Report: ${outputPath}`);
  console.log(`Label: ${report.label}`);
  console.log(`Cold total median/p95: ${formatMs(cold.median)} / ${formatMs(cold.p95)}`);
  console.log(`Warm total median/p95: ${formatMs(warm.median)} / ${formatMs(warm.p95)}`);
  for (const mode of ["cold", "warm"]) {
    const phases = report.summary[mode].phases;
    const formatter = report.summary[mode].formatter;
    console.log(
      `${mode} phases median setup/discovery/analysis/render: ` +
        phaseNames.map((phaseName) => formatMs(phases[phaseName].median)).join(" / "),
    );
    console.log(
      `${mode} formatter median lookup/construction/format: ` +
        formatterMetricNames
          .map((metricName) => formatMs(formatter[metricName].median))
          .join(" / "),
    );
  }
  console.log(
    `Runtime: ${report.runtime.node} ${report.runtime.platform}/${report.runtime.arch}`,
  );
}

const args = parseArgs(process.argv.slice(2));
const fixture = readFixture();
const report = createReport(args, fixture);
const outputPath = writeReport(args, report);

if (!args.quiet) {
  printSummary(report, outputPath);
}
