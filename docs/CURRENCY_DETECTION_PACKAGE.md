# Currency Detection Package

## Scope

`packages/currency-detection` provides a standalone, dependency-free detection core for:

- `parseCurrencyValue`
- `extractCurrencyTextMatches`
- `mayContainCurrencyToken`
- `hasThousandMagnitudeHint`
- `createCurrencyParser(config)` for additive runtime extensions

It intentionally excludes DOM manipulation, rate math, and reducer/state logic.

## TDD + Parity Workflow

1. Generate fixture corpus:

```bash
npm run currency-detection:fixtures
```

2. Build legacy parser snapshot (parity baseline):

```bash
npm run currency-detection:baseline
```

3. Run standalone package tests (ported parser tests + contract tests + parity harness):

```bash
npm run currency-detection:test
```

4. Run extension unit suite as regression guard:

```bash
npm run test:frontend
```

## Benchmark Workflow (Info-Only)

Run benchmarks:

```bash
npm run currency-detection:bench
```

Compare with baseline benchmark file when available:

```bash
npm run currency-detection:bench:compare
```

Generated artifacts:

- `packages/currency-detection/benchmarks/results/latest.json`
- `packages/currency-detection/benchmarks/results/latest.md`
- `packages/currency-detection/benchmarks/results/comparison.md`

CI workflow: `.github/workflows/currency-detection-benchmarks.yml`

- Runs parity baseline + tests + extension regression guard + benchmarks.
- Publishes benchmark summaries and artifacts.
- Benchmark comparison is report-only and does not fail the workflow.
