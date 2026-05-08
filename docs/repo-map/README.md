# FX Inline Repository Map

This folder contains a graphical map of the current repository structure.

- `fx-inline-repo-map.svg` is the final readable presentation map.
- `fx-inline-repo-map-background.png` is the raster background generated with the built-in `imagegen` tool.

The map is based on current repository evidence, excluding ignored graph/revenue-report artifacts per the repo instructions.

## Structure Summary

- `apps/extension/` - WXT browser extension, Preact UI entrypoints, content activation, content worker, storage/rate utilities, shared theme assets, and unit/content tests.
- `packages/inline-runtime/` - shared DOM conversion runtime, mutation controller, partial conversion pass, plugin runner, Amazon/Little Hotelier plugins, formatting, and rate fetch support.
- `packages/currency-detection/` - dependency-free parser core with symbol/ISO/word/magnitude data, fixtures, benchmarks, and package tests.
- `apps/admin/` and `apps/backend/` - React settings workbench, Nest API, SQLite-backed settings store, and generated inline-runtime settings manifest export.
- `apps/website/` - marketing site and parser playground.
- `scripts/`, `test/`, and `.github/workflows/` - build assertions, asset optimization, release packaging/publishing, CI, and cross-app tests.

## Improvement Callouts

- Content activation handoff is split across `contentActivation.ts`, startup handoff, `content-worker.ts`, `conversionRuntime.ts`, and the shared runtime controller. Add a lifecycle sequence document and focused boundary tests for the handoff states.
- `wxt.config.ts` is a dense policy hub for manifest fields, CSP, manual chunking, release version overrides, dependency optimizer guardrails, and Firefox hardening. Splitting tested helpers would lower change risk.
- Rate provider parsing exists in both extension utilities and the inline-runtime package. A shared provider contract would reduce drift.
- Admin settings export is build-critical because many build, compile, zip, and test paths consume the generated manifest. Keep schema ownership and regeneration triggers visible near the export workflow.
- Parser and site-plugin rules are high-leverage and likely to grow. New rules should keep fixture cases, benchmark checks, and plugin contract tests close to the implementation.

## Imagegen Prompt

```text
Use case: infographic-diagram
Asset type: repo architecture map background for a graphical presentation
Primary request: Create a 16:9 polished editorial software repository map for FX Inline, a browser-extension monorepo. The visual should look like a clean subway/topographic system map with six distinct districts: browser extension, shared inline runtime, currency parser, admin/API/settings, website/playground, and build/release/CI.
Style/medium: crisp high-resolution raster infographic background, flat + subtle isometric hybrid, professional but not boring.
Composition/framing: landscape 16:9, structured map with connected route lines, abstract folder blocks, dependency paths, warning pins, and improvement markers. Leave ample empty rounded label panels and callout spaces for exact text to be overlaid later.
Color palette: off-white canvas, dark ink labels areas, teal runtime line, gold parser line, coral hotspots, slate build/release line, muted green admin/settings line.
Text: no readable text at all; no letters, no fake labels, no pseudo-words.
Constraints: make the six districts visually distinct, keep strong negative space for later labels, avoid tiny detail clutter, no brand logos, no watermark, no screenshots, no code text.
```
