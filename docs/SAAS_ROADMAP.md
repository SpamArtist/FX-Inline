# FX Inline Roadmap Status

_Last updated: 2026-04-17_

## Delivered

1. Extension foundation and browser support
- WXT + React + TypeScript monorepo structure (`apps/extension`, `apps/website`, `docs`).
- Chromium + Firefox support from one codebase.
- Firefox bundle hardening patch for fragile `innerHTML` output patterns.

2. Popup converter UX
- Two-row converter with editable amounts (`displayThenEdit`) and currency swap.
- Header controls: local auto-conversion toggle (origin-scoped), global auto-conversion toggle, options button.
- Settings open flow: `browser.runtime.openOptionsPage()` with tab fallback.
- Footer includes both `Feedback ↗` action and `© {currentYear} FX Inline`.

3. Options and settings persistence
- Options page persists preferred currency from extension storage.
- Currency list is driven by `currency.json`, sorted by code, with `Intl.DisplayNames` fallback.
- User settings key: `local:user-settings` with sanitization and canonical origin normalization.

4. Rates pipeline and cache policy
- USD-base snapshot fetch with provider fallback:
  - `https://open.er-api.com/v6/latest/USD`
  - `https://api.exchangerate-api.com/v4/latest/USD`
- Fetch hardening: timeout, no-store cache, omitted credentials, no-referrer, redirect error mode.
- Market-day cache policy (`America/New_York`) with pre-open and weekend rollover behavior.
- Background alarm refresh (`ccx-refresh-rates`) every 30 minutes on install/startup/alarm.

5. Selection popup conversion on webpages
- Parses selected text with locale hint and shows popup near selection bounds.
- Shadow DOM popup host (`#popup-root`) with isolated styling and interaction capture.
- Two-row selection converter with click-to-edit amounts and idempotent cleanup.

6. Inline conversion runtime
- Full-page and mutation-root partial conversion passes with separate debounce windows and time budgets.
- Mutation suppression and delayed release to avoid self-triggered loops.
- Hydration retry path and content-script context invalidation-safe cleanup.
- Auto-conversion disable path suppresses existing wrappers instead of forcing full teardown.

7. Currency parsing and extraction robustness
- Supports ISO/symbol prefix/suffix, compact forms (for example `USD350`), and numeric-only selection defaults.
- Supports composite dollar symbols (`R$`, `RD$`, `A$`, `AU$`, `CA$`, `NZ$`, `HK$`, `MX$`, `NT$`, `US$`, `EC$`).
- Supports Unicode compatibility/full-width symbols (`￥`, `＄`, `￡`, `￦`, `￠`, `﹩`).
- Supports yen aliases (`yen`, `yên`) and locale-aware magnitude words.
- Guards against prose/handle false positives (word-like ISO casing checks and username-like boundaries).

8. Structured DOM conversion coverage
- Text-node conversion wrappers: `original (converted)` with `ccx-inline-conversion` + `.ccx-converted-amount`.
- Structured add-on conversion support for:
  - Amazon split price fragments (`.a-price-symbol`, `.a-price-whole`, `.a-price-decimal`, `.a-price-fraction`)
  - Sibling symbol/amount layouts including `yen/month` style tokens.
- Converted amount style contract includes inherited line-height and fit-content width.

9. Automated quality gates
- Unit and content tests for parser/runtime/inline behavior.
- CI workflow runs `npm run test:all` on pull requests and pushes to `main`.

## Current Focus

1. Keep parser and structured conversion coverage aligned with real-world site patterns.
2. Maintain low false-positive conversion rates without reducing supported currency syntax.
3. Preserve mutation/runtime performance characteristics on large, dynamic pages.

## Not in Scope (Current Phase)

1. Account/subscription/billing functionality.
2. Backend-managed rate service (client-side providers remain source of truth).
3. Migration/backward-compatibility shims for legacy storage formats.
