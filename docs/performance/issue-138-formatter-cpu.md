# Issue 138 Formatter CPU

## Scope

Fixture: `apts-jp-first-page-full-conversion`.
Harness: `packages/inline-runtime/scripts/measure-full-conversion-performance.mjs`.
Runs: 25 measured cold, 1 warmup, 25 measured warm.
Each run reloads fixed JSDOM input and verifies conversion count plus exact final DOM.

Prior evidence, same offline fixture and settings:

| Stage | Run Label | Cold Median / p95 | Warm Median / p95 |
| --- | --- | ---: | ---: |
| Original pre-scanner baseline | issue 136 baseline | 222.864 / 252.692 ms | 221.658 / 231.675 ms |
| Completed ordered scanner | issue 137 candidate | 227.173 / 274.865 ms | 225.713 / 235.591 ms |

Current issue 138 baseline after parser completion:

| Run Label | Cold Median / p95 | Warm Median / p95 |
| --- | ---: | ---: |
| issue138-current-baseline-v2 | 227.381 / 328.535 ms | 221.524 / 228.797 ms |

Formatter cost split in current baseline:

| Mode | Lookup Median / p95 | Construction Median / p95 | Format Call Median / p95 | Counts |
| --- | ---: | ---: | ---: | --- |
| Cold | 0.025 / 0.039 ms | 0.085 / 0.104 ms | 0.335 / 0.568 ms | 37 lookups, 2 constructions, 37 format calls |
| Warm | 0.021 / 0.032 ms | 0.000 / 0.000 ms | 0.111 / 0.146 ms | 37 lookups, 0 constructions, 37 format calls |

## Formatter Option

Change: keep existing `Intl.NumberFormat` cache and add one-entry recent formatter memo. This avoids repeated `Map.get` work for same locale, currency, and compact mode. It does not prebuild formatters, move work to setup, use idle time, or change fallback behavior.

Exact output constraints preserved:

| Constraint | Result |
| --- | --- |
| Locale | unchanged, uses same locale argument |
| Symbol | unchanged, same `Intl.NumberFormat` options |
| Fractions | unchanged, same `maximumFractionDigits` and compact fraction options |
| Compact notation | unchanged, same compact threshold caller input and `notation: "compact"` |
| Final DOM | exact DOM fixture check passed in harness runs |

Candidate runs:

| Run Label | Cold Median / p95 | Warm Median / p95 |
| --- | ---: | ---: |
| issue138-last-formatter-memo-a | 226.084 / 270.536 ms | 221.795 / 230.579 ms |
| issue138-last-formatter-memo-b | 226.033 / 273.959 ms | 223.986 / 230.210 ms |

Formatter cost split after memo, run B:

| Mode | Lookup Median / p95 | Construction Median / p95 | Format Call Median / p95 | Counts |
| --- | ---: | ---: | ---: | --- |
| Cold | 0.019 / 0.027 ms | 0.087 / 0.138 ms | 0.334 / 0.447 ms | 37 lookups, 2 constructions, 37 format calls |
| Warm | 0.019 / 0.022 ms | 0.000 / 0.000 ms | 0.111 / 0.152 ms | 37 lookups, 0 constructions, 37 format calls |

## Decision Summary

Production formatter memo kept. Cold total median decreased in two candidate runs against current baseline with same fixture and harness. Warm total did not show repeatable reduction, so only cold CPU is claimed. Formatter lookup median decreased from 0.025 ms to 0.018-0.019 ms cold and from 0.021 ms to 0.018-0.019 ms warm. Construction and format call costs stayed effectively unchanged. No work moved to setup, another task, idle time, or another process.

Three-stage comparison for final report:

| Stage | Cold Median / p95 | Warm Median / p95 |
| --- | ---: | ---: |
| Original pre-scanner baseline | 222.864 / 252.692 ms | 221.658 / 231.675 ms |
| Completed ordered scanner | 227.173 / 274.865 ms | 225.713 / 235.591 ms |
| Formatter memo result | 226.033 / 273.959 ms | 223.986 / 230.210 ms |

Assumption: prior issue 136 and issue 137 values came from parent task evidence. They are comparable by fixture and settings, but still subject to cross-run system noise.
