# Prompt: Recreate FX Inline Extension From Scratch (Current Clone Spec)

Use this prompt in a brand-new Codex/LLM session. The model should assume zero access to any prior repository.

---

You are a senior engineer. Recreate the **FX Inline** browser extension from scratch as an implementation-faithful clone, including the same entrypoints, behavior, storage model, runtime conversion pipeline, and test coverage expectations.

This is a **greenfield** task. Build everything needed from this prompt only.

## 1) Required Stack and Project Shape

1. Use **WXT + React + TypeScript** for the extension.
2. Use a monorepo layout:
- `apps/extension` for the extension app.
- `apps/website` for a standalone static marketing site scaffold (basic Vite setup is enough).
- `docs` for runbooks/checklists.
3. Use the existing visual approach:
- custom CSS theme tokens (`converter-theme.css`) and component CSS,
- Radix dropdown primitives for currency menus.
4. Support Chromium and Firefox builds from one codebase. Include Safari conversion notes.
5. Include CI + release automation:
   - Workflows under `.github/workflows/`:
     - `ci.yml` runs `npm run test:all` on PRs and pushes to `main`.
     - `currency-detection-benchmarks.yml` runs currency detection benchmarks and publishes artifacts/summaries.
     - `release.yml` is tag-driven (on `push` of tags matching `v*`) and validates the tag, runs tests, builds artifacts, and publishes a GitHub release (store publishing steps are gated on configured secrets).
   - Release tags and versioning:
     - Tag format: `vMAJOR.MINOR.PATCH` (final) or `vMAJOR.MINOR.PATCH-rc.N` (RC).
     - `scripts/release/versioning.mjs` maps final tags to a browser-safe manifest version `MAJOR.MINOR.PATCH.50000`, and RC tags to `MAJOR.MINOR.PATCH.N`.
     - Local sanity commands:
       - `RELEASE_TAG=v0.4.1 npm run release:dry-run`
       - `RELEASE_TAG=v0.4.1 npm run release:validate-tag`

## 2) Product Identity

1. Extension name: `FX Inline`.
2. Description: converts prices directly on webpages into a preferred currency.
3. Visual language:
- dark slate shell and panel surfaces,
- wheat/light title and text accents,
- compact, high-density converter layout.

## 3) Manifest and Browser Capabilities

Implement equivalent manifest behavior via WXT config:

1. WXT source/public directories:
- `srcDir: apps/extension`
- `publicDir: apps/extension/public`
2. Icons:
- `16`, `32`, `48`, `96`, `128` in `manifest.icons`
- action `default_icon` for `16`, `32`, `48`
3. Permissions:
- `activeTab`
- `storage`
- `alarms`
4. Host permissions:
- `https://open.er-api.com/*`
- `https://api.exchangerate-api.com/*`
5. CSP for extension pages:
- `default-src 'self'`
- `script-src 'self'`
- `style-src 'self' 'unsafe-inline'`
- `object-src 'none'`
- `base-uri 'none'`
- `connect-src` must include extension self and rate provider origins.
- In development only, also allow local Vite/HMR origins and websocket endpoints for `127.0.0.1:3000` and `localhost:3000`.
6. Firefox-specific manifest settings:
- `browser_specific_settings.gecko.id = "fx-inline@xbotpc"`
- include `data_collection_permissions.required = ["none"]`.
7. Build hardening behavior:
- include post-bundle patching for Firefox manifest version fields so generated artifacts match the release tag metadata.

## 4) Required Extension Pages and Entrypoints

Implement these extension entrypoints and behaviors exactly.

### A) Popup Page (`popup.html`)

1. Main converter shell:
- title text: `FX INLINE`
- two currency rows by default
- each row has a currency dropdown and amount area
- default source amount: `100`
- default source currency: `EUR`
- second row defaults to preferred currency unless same as source; fallback uses EUR/USD alternate logic
2. Amount editing behavior:
- amount starts in display mode and switches to editable input on click
- allow only numeric input with optional decimal point
- max 4 decimal places
- Enter commits
- Escape cancels
- blur commits
3. Live conversion:
- changing one row recalculates the counterpart row from current rate snapshot
4. Swap behavior:
- centered swap button between rows
- swap updates `seq` ordering for row positions
5. Header actions (right side):
- local auto-conversion toggle for active tab origin (disabled when origin unavailable)
- global auto-conversion toggle
- settings button that opens options page
6. Options open behavior:
- first call `browser.runtime.openOptionsPage()`
- fallback: `browser.tabs.create({ url: browser.runtime.getURL("/options.html") })`
7. Footer:
- include feedback action button text: `Feedback ↗` that opens a new tab to the configured feedback URL
- text: `© {currentYear} FX Inline`
8. Popup HTML metadata:
- include `<meta name="manifest.type" content="browser_action" />`.
- keep popup HTML title as `Default Popup Title` (runtime shell provides visible `FX INLINE` branding).

### B) Options Page (`options.html`, open in tab)

1. HTML title: `FX Inline Settings`.
2. Page shell includes brand text `FX INLINE` and a preferred currency setting panel.
3. Settings content:
- preferred currency selector only
4. On load:
- read persisted settings from extension storage
5. Currency option data:
- source from local `currency.json`
- use `Intl.DisplayNames` currency names when available
- fallback to JSON-provided name/code when unavailable
- render option label as `emoji code - currency name`
- sort options by code
6. On currency change:
- persist `preferredCurrency`
- show status message: `Preferred currency updated to <CODE>.`
7. Options HTML metadata:
- include `<meta name="manifest.open_in_tab" content="true" />`.

### C) Welcome Page (`welcome.html`, open in tab on fresh install)

1. Title: `Welcome to FX Inline`.
2. Open only when the extension is freshly installed.
3. Page shell:
- brand text `FX Inline`
- onboarding copy that explains the converter and points users to Settings
- primary button text `Open Settings`
4. On click:
- first call `browser.runtime.openOptionsPage()`
- fallback: `browser.tabs.create({ url: browser.runtime.getURL("/options.html") })`
5. Implementation notes:
- render the page with direct DOM APIs
- keep the page idempotent and avoid raw HTML injection
- include `<meta name="manifest.open_in_tab" content="true" />`.

### D) Content Script (all URLs)

1. Match pattern: `<all_urls>`.
2. `cssInjectionMode: "manual"`.
3. Responsibilities:
- selection-based popup conversion
- automatic inline conversion in page text
- mutation-aware partial/full reconversion runtime
- storage watch for settings updates
- context invalidation-safe cleanup for observers/watchers/UI capture listeners
4. Mutation observation target and options:
- observe `document.body`
- `childList: true`
- `subtree: true`
- `characterData: true`
5. Ignore self-triggered mutations while conversion suppression is active.

### E) Selection Popup in Webpages

1. On `mouseup`:
- read selected text
- parse with locale hint from `document.documentElement.lang`
- if valid, show popup near selection bounds
- if invalid/empty, remove popup
- if parsed text has no explicit currency token, default source currency to `EUR`
2. Popup rendering host:
- absolute positioned root with id `popup-root`
- attached open Shadow DOM
- very high z-index (`9999999`)
- inject combined inline CSS (`converter-theme.css` + `content.css`) via a `<style id="content-styles">`
- mount UI inside container id `popup-react-container` (container class `ccx-selection-popup-host`)
3. Popup UI behavior:
- same shell design language as popup, with `FX INLINE` header
- two rows only
- currency dropdown controls are disabled
- amounts are click-to-edit with commit/cancel key behavior
4. Event isolation:
- capture and swallow `pointerdown`, `mousedown`, `click`, `contextmenu`
- isolate events from popup root and dropdown portal class `ccx-dropdown-menu-content`
5. Removal behavior:
- remove popup when clicking outside and selection is cleared
- `removePopup()` and `destroy()` must be idempotent

### F) Background Script

1. Alarm name: `ccx-refresh-rates`.
2. Interval: every 30 minutes.
3. On install:
- schedule alarm
- refresh rates with force refresh
- open the welcome page only when the install reason is `install`
4. On startup:
- schedule alarm
- refresh rates
5. On alarm fire:
- refresh cached rates

## 5) Core Runtime Behavior

### A) Storage Model

Use extension local storage with these keys and semantics:

1. Key: `local:user-settings`.
2. Settings shape:
- `preferredCurrency`
- `globalAutoConversionEnabled`
- `localAutoConversionByOrigin`
3. Defaults:
- `preferredCurrency: "EUR"`
- `globalAutoConversionEnabled: true`
- `localAutoConversionByOrigin: {}`
4. Behavior requirements:
- sanitize and normalize persisted settings on reads/writes
- canonicalize origin keys to valid HTTP/HTTPS origins only
- keep helper APIs for full set and partial patch
5. Auto-conversion enable logic:
- global off disables all inline auto-conversion
- otherwise allow by default and only disable per origin when origin map entry is explicitly `false`

### B) Rates and Cache Policy

1. Base currency for snapshots: USD.
2. Cache key:
- `local:rate-cache`
3. Cache policy:
- compute market-day key in `America/New_York`
- weekends roll back to previous business day
- before 9:30 AM ET use previous business day
4. Fetch strategy:
- primary: `https://open.er-api.com/v6/latest/USD`
- fallback: `https://api.exchangerate-api.com/v4/latest/USD`
5. Fetch hardening:
- timeout around 8s
- `cache: "no-store"`
- `credentials: "omit"`
- `referrerPolicy: "no-referrer"`
- `redirect: "error"`
6. Normalization:
- keep only valid ISO currency codes
- keep finite positive rates
- always include `USD = 1`
7. Failure behavior:
- if providers fail and cached snapshot is valid, return cached snapshot
- otherwise surface the error

### C) Popup and Selection Converter State Logic

1. Maintain row array state with fields:
- `id`, `code`, `amount`, `icon`, `seq`
2. Support reducer actions:
- amount update
- currency update
- add row (in reducer even if not exposed in UI)
- swap row order
3. Recalculate dependent rows when source amount/currency changes.
4. Apply preferred-currency preference to secondary row when settings hydrate.
5. If rate snapshot is unavailable, keep deterministic numeric fallback formatting.

### D) Auto Inline Conversion on Webpages

1. Scan text nodes for currency snippets.
2. Skip contexts:
- blocked tags: `SCRIPT`, `STYLE`, `NOSCRIPT`, `TEXTAREA`, `INPUT`, `SELECT`, `OPTION`, `BUTTON`, `CODE`, `PRE`, `SVG`
- editable contexts (`contenteditable`, text inputs)
- hidden/assistive-only contexts
- already converted nodes
3. Wrapper/styling contract:
- wrapper class: `ccx-inline-conversion`
- converted amount child class: `ccx-converted-amount`
- style tag id: `ccx-inline-conversion-style`
4. Render output format as `original (converted)` for text-node replacements.
5. Avoid nested duplicate wrappers.
6. On reruns:
- refresh existing wrappers when possible
- otherwise clear/redecorate as needed
7. Do not convert:
- zero values
- same-currency values
- values with missing/invalid conversion rates
8. Compact formatting:
- default compact threshold `100,000`
- when raw source contains K-style magnitude hint, use `1,000` threshold
- prepend approximation marker `~` for compact output
9. Range support:
- support conversions for range matches like `¥6-13M` and `¥6M–¥13M`
10. Adaptive inline color:
- derive from effective text luminance context
- use equivalent colors:
  - light text context: `#93c5fd`
  - dark text context: `#355aa8`
11. Structured price decorators:
- support structured Amazon-style fragments and sibling symbol/amount node patterns
- include sibling currency-word combinations such as `yen/month`
12. Converted amount style contract:
- `.ccx-converted-amount` must include inherited line-height and `width: fit-content`

### E) Mutation-Aware Conversion Runtime

Implement the same runtime behavior pattern:

1. Full conversion pass debounce:
- around `200ms`
2. Partial conversion pass for mutation roots:
- debounce around `120ms`
- time budget around `16ms`
- continuation schedule around `28ms` if queue remains
3. Track pending mutation roots and collapse descendants under ancestors.
4. Node limits:
- full pass cap around `15,000` text nodes
- partial pass cap around `4,000` nodes per root
5. Settings update handling:
- watch settings storage key
- when conversion-relevant settings change, refresh rates/settings and schedule reconversion
- delayed rerender window around `1400ms` after settings writes
6. Mutation suppression behavior:
- keep suppression active during conversion pass
- release after short delay around `400ms`
7. Hydration retry behavior:
- retry conversion hydration after failure (around `3000ms`)
8. Perf logging:
- enabled by default in development
- in production, opt-in via localStorage key `ccx:perf` set to `"1"`
- log phase timings and counters for initialize/full/partial/settings flows
9. Auto-conversion disabled behavior:
- suppress/hide existing inline wrappers instead of applying new conversions
10. Lifecycle safety:
- cleanup must be idempotent and resilient to extension context invalidation errors

## 6) Parsing and Matching Requirements

Implement robust parser + extraction with locale-aware magnitude words and quick pre-filters.

### A) Required Valid Parse Cases

Must parse all of these correctly:

1. `100`
2. `USD 100`
3. `100 USD`
4. `$100`
5. `100$`
6. `USD100`
7. `100USD`
8. `usd 100`
9. `EUR 12,5`
10. `USD 4.295 billion`
11. `4.295 billion USD`
12. `₫ 4.295 billion`
13. `₫ 3.65 tỷ`
14. `VND 850 triệu`
15. `USD 2 miliar`
16. `₫3.65tỷ`
17. `$1,234.56`
18. `eur-42.5`
19. `+150 usd`
20. `42.5eur`
21. `JPY 1,234`
22. `¥6M`
23. `¥6m`
24. `¥6M+`
25. `USD 350+`
26. `USD 1.2 million`
27. `2 billions USD`
28. `₫ 4.295 trillion`
29. `USD 1.5 triliun`
30. `₫ 1 nghìn tỷ`
31. `VND 1 ngan ty`
32. `1 000 000 ₫`
33. `1 000 000 ₫` (NBSP grouped)
34. `1 Lakh INR`
35. `1 Lac INR`
36. `INR 1 Lakh`
37. `INR 1 Lac`
38. `1 Crore INR`
39. `1 Cr INR`
40. `INR 1 Crore`
41. `INR 1 Cr`
42. `yen 1,234`
43. `YÊN 1,234`
44. `1,234 yên`
45. `R$ 10`
46. `10R$`
47. `RD$ 40`
48. `A$3`
49. `AU$ 4`
50. `CA$ 5`
51. `NZ$6`
52. `HK$7`
53. `MX$8`
54. `NT$9`
55. `US$10`
56. `EC$11`
57. `￥39,000`
58. `＄100`
59. `￡200`
60. `￦3000`
61. `￠50`
62. `﹩75`
### B) Required Invalid Parse Cases

Must reject:

1. `foo`
2. `USD`
3. `and 100`
4. `100..50`
5. `foo bar`
6. `12.3.4 USD`
7. `27, all`

### C) Required Text Extraction Cases

Must detect correctly from mixed text:

1. `Deal: $100 and 200 eur today` -> detect USD 100 and EUR 200.
2. `Median price: ₫ 4.295 billion and backup USD 2 million and EUR 3 trillions and VND 1.2 tỷ`
3. `Words and 200 apples; offer usd 30 and ₹50 now` -> ignore apples, keep USD/INR.
4. `Deal: £99.99 then 120 CAD and 10€`
5. `200USD/month Coliving ... and USD350/week`
6. `₫ 45,000,000 / month`
7. `Mais de 1 000 000 ₫ por pessoa`
8. `Median price ₫ 4.295 billion`
9. `Mức giá từ ₫ 3.65 tỷ đến ₫ 4.2 tỷ, có thể lên USD 2 miliar`
10. `🇯🇵 Salary: ¥6M–¥13M ...`
11. `Comp range starts at ¥6M+ base`
12. `Compensation: ¥6-13M base` (shared magnitude range)
13. `Revenue; 2023-24 $446,641,957.` -> detect only USD amount, not year range.
14. Ignore lowercase/titlecase word-like ISO prose (e.g. `top`, `all`, `try`, `mad`) unless uppercase token is intentional currency code.
15. Ignore username/handle-like boundaries (for example `@kes11av`, `kes11buddy`) while still detecting nearby valid snippets such as `USD350/week` or `KES 11`.
16. Support composite dollar symbols and Unicode compatibility/full-width symbols inside mixed text.
17. Support yen alias extraction including `yen/month` sibling-token contexts.

### D) Locale-Aware Magnitude Profiles

Support locale-sensitive magnitude words with locale hints (from page `lang`), including:

1. English scale (`million`, `billion`, `trillion`).
2. Vietnamese (`triệu`, `tỷ`, `nghìn tỷ`, aliases).
3. Indonesian/Malay/Turkish/Azerbaijani variants.
4. Indic systems (`lakh/lac`, `crore/cr`, Marathi forms, etc.).
5. East Asian systems (Chinese/Japanese/Korean large units).
6. Avoid cross-locale collisions by respecting locale hint where required.

### E) Fast Pre-Filters

Implement quick checks to skip expensive parsing:

1. `mayContainCurrencyToken`:
- requires both numeric signal and currency token signal
2. `hasThousandMagnitudeHint`:
- detects K-style magnitude hints tied to numbers

## 7) Scripts and Dev Commands

Define scripts equivalent in behavior to:

1. `npm run dev`
2. `npm run dev:firefox`
3. `npm run build`
4. `npm run build:firefox`
5. `npm run zip`
6. `npm run zip:firefox`
7. `npm run compile`
8. `npm run build:unit`
9. `npm run build:content-tests`
10. `npm run jest`
11. `npm run test:frontend`
12. `npm run test:content`
13. `npm run test:unit`
14. `npm run test:all`
15. `npm run dev:website`
16. `npm run build:website`
17. `npm run preview:website`

## 8) Testing Requirements (Mandatory)

Do not finish until tests are implemented and passing.

### A) Unit Tests

Add tests equivalent in scope to:

1. parser valid/invalid case matrix above.
2. extraction behavior for mixed snippets, compact ISO text, ranges, locale-sensitive magnitudes.
3. quick filter coverage (`mayContainCurrencyToken`, `hasThousandMagnitudeHint`).
4. rate math conversions:
- cross currency conversion
- same currency
- negative values
- missing/invalid rates return null
- formatting edge cases
5. rate policy:
- market-day key post-open
- pre-open rollover
- weekend rollover
6. currency formatter/presentation behavior:
- standard currency formatting
- fallback formatting for invalid currency
- compact formatting behavior
- currency display/icon fallback behavior
7. reducer and hydration logic:
- initial state
- amount/currency/swap actions
- preferred currency application
- settings/rates hydration behavior
8. mutation root collector:
- includes element and text-parent roots
- ignores popup root
- deduplicates roots
- collapses descendant roots

### B) Content/DOM Integration Tests

Include jsdom-level tests for content runtime and selection popup:

1. inline output formatting and wrapper behavior.
2. skipped contexts are not converted.
3. reruns do not produce nested wrappers.
4. partial conversion respects root queue and time budget behavior.
5. settings changes trigger delayed reconversion flow.
6. auto-conversion disable path suppresses wrappers.
7. selection popup loader lazy-import and dedupe behavior.
8. selection popup controller render, editing interactions, cleanup idempotency.
9. perf logger enable/disable behavior.
10. structured add-on decorators for Amazon and sibling symbol/amount patterns.
11. username/handle-like false-positive protections.
12. extension context invalidation cleanup safety path.

### C) Manual E2E Checklist (`docs/QA_E2E_CHECKLIST.md`)

Must include:

1. selection popup behavior on dynamic pages.
2. auto conversion on static + SPA pages.
3. mutation observer catches inserted nodes.
4. rate refresh behavior across day boundaries.
5. global and per-origin auto-conversion toggles.
6. run key scenarios on Chromium and Firefox; note differences.

## 9) README Requirements

Include:

1. project layout (`apps/extension`, `apps/website`, `docs`).
2. local setup steps.
3. dev/build/test command guide.
4. unpacked extension loading instructions.
5. browser compatibility matrix.
6. known limitations/performance safeguards.
7. security/privacy notes.

## 10) Delivery Expectations

1. Provide complete runnable code; no pseudocode.
2. Preserve behavioral parity with this spec for popup/options/content/background/runtime.
3. Exclude account/subscription flows from scope.
4. At completion, print:
- implemented feature checklist
- automated test results summary
- manual checklist file location
- residual risks/gaps
