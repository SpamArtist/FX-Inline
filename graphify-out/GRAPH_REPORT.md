# Graph Report - /Users/xbotpc/Desktop/XBOTPC/Work/Code/currency-conversion-extension-tool-codex-78e0  (2026-04-19)

## Corpus Check
- 73 files · ~73,027 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 369 nodes · 494 edges · 74 communities detected
- Extraction: 79% EXTRACTED · 20% INFERRED · 1% AMBIGUOUS · INFERRED: 99 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]

## God Nodes (most connected - your core abstractions)
1. `extractCurrencyTextMatches()` - 18 edges
2. `decorateStructuredAmazonPrices()` - 11 edges
3. `decorateStructuredSiblingSymbolPrices()` - 11 edges
4. `getUserSettings()` - 9 edges
5. `convertVisiblePrices()` - 9 edges
6. `decorateSplitSiblingPriceInTextNode()` - 9 edges
7. `decoratePricesInTextNode()` - 9 edges
8. `getConvertedAmountText()` - 9 edges
9. `createMagnitudeAliasResolver()` - 8 edges
10. `refreshExistingInlineConversions()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `createCompiledConfig()` --calls--> `getCanonicalCurrencySymbolToken()`  [INFERRED]
  packages/currency-detection/src/parser-core.js → /Users/xbotpc/Desktop/XBOTPC/Work/Code/currency-conversion-extension-tool-codex-78e0/apps/extension/utils/utils.ts
- `getMagnitudeAliasMap()` --calls--> `buildParserArtifacts()`  [INFERRED]
  apps/extension/utils/magnitudeProfiles.ts → /Users/xbotpc/Desktop/XBOTPC/Work/Code/currency-conversion-extension-tool-codex-78e0/apps/extension/utils/utils.ts
- `parseCurrencyValue()` --calls--> `getSiblingCurrencyRawPrice()`  [INFERRED]
  /Users/xbotpc/Desktop/XBOTPC/Work/Code/currency-conversion-extension-tool-codex-78e0/apps/extension/utils/utils.ts → apps/extension/entrypoints/content/inlineConversion/structuredDecorators.ts
- `parseCurrencyValue()` --calls--> `getSplitSiblingRawPrice()`  [INFERRED]
  /Users/xbotpc/Desktop/XBOTPC/Work/Code/currency-conversion-extension-tool-codex-78e0/apps/extension/utils/utils.ts → apps/extension/entrypoints/content/inlineConversion/textNodeDecorator.ts
- `extractCurrencyTextMatches()` --calls--> `refreshExistingInlineConversions()`  [INFERRED]
  /Users/xbotpc/Desktop/XBOTPC/Work/Code/currency-conversion-extension-tool-codex-78e0/apps/extension/utils/utils.ts → apps/extension/entrypoints/content/inlineConversion/conversionNodes.ts

## Hyperedges (group relationships)
- **Logo Composition** — fx_inline_logo, fx_inline_logo_background, fx_inline_logo_ring, fx_inline_logo_arrows, fx_inline_logo_lines, fx_inline_logo_mark [EXTRACTED 1.00]
- **App Icon Brand Mark** — 48_png_extension_icon, 48_png_refresh_exchange_ring, 48_png_central_currency_glyph [INFERRED 0.82]
- **Icon Composition** — icon_128_png, icon_128_png_exchange_motif, icon_128_png_cyan_ring, icon_128_png_dark_badge [EXTRACTED 1.00]
- **Icon composition** — 512_png_extension_icon, 512_png_dark_rounded_square_background, 512_png_cyan_ring, 512_png_exchange_arrows [INFERRED 0.82]
- **Site Mark Composition** — fx_inline_rounded_background, fx_inline_circular_ring, fx_inline_horizontal_lines, fx_inline_left_arrow, fx_inline_right_arrow [EXTRACTED 1.00]
- **Engineering Governance Bundle** — agents_md_engineering_guidance, agents_md_worktree_policy, agents_md_git_issue_workflow, agents_md_git_workflow_mandate [INFERRED 0.82]
- **Interactive Graph UI Flow** — graph_html_raw_nodes_dataset, graph_html_raw_edges_dataset, graph_html_network_instance, graph_html_node_info_panel, graph_html_search_feature, graph_html_community_filter [EXTRACTED 1.00]
- **Graph Report Navigation Scaffold** — graph_report_md_graph_report, graph_report_md_community_hubs, graph_report_md_god_nodes, graph_report_md_surprising_connections, graph_report_md_hyperedges_section [EXTRACTED 1.00]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.1
Nodes (31): getConvertedAmountText(), applyConvertedAmountColor(), clearInlineConversions(), ensureInlineConversionNodeRefs(), getInlineAddonNode(), getOriginalText(), isInlineConversionAddon(), refreshExistingInlineConversions() (+23 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (18): initializeRateRefresh(), scheduleRateRefreshAlarm(), refreshSettingsAndRates(), getMarketDayKey(), getPreviousBusinessDay(), isWeekend(), shouldUseMarketDayCache(), toDateKey() (+10 more)

### Community 2 - "Community 2"
Cohesion: 0.17
Nodes (25): formatCurrencyHeadlineAmount(), buildParserArtifacts(), escapeRegex(), extractCurrencyTextMatches(), formatAmountInCurrency(), getCanonicalCurrencySymbolToken(), getCurrencyFormatter(), getParserArtifacts() (+17 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (16): loadSettings(), onToggleGlobalAutoConversion(), onToggleLocalAutoConversion(), asCurrencyCode(), asGlobalAutoConversionEnabled(), asLocalAutoConversionByOrigin(), getOriginFromUrl(), getUserSettings() (+8 more)

### Community 4 - "Community 4"
Cohesion: 0.16
Nodes (16): convertAmountWithSnapshot(), formatConvertedAmount(), createAmountRowView(), createSelectionPopupView(), resolveLocale(), createCurrencyId(), createSelectionPopupStateStore(), getCurrencyStateFromCode() (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (7): createContentConversionRuntime(), isExtensionContextInvalidatedError(), main(), createPerfLogger(), isPerfLoggingEnabled(), createRuntimePerfContext(), createLazySelectionPopupControllerLoader()

### Community 6 - "Community 6"
Cohesion: 0.21
Nodes (11): finalizeAmountEdit(), handleAmountChange(), onAmountInputKeyDown(), revertAmountEdit(), cancelAmountEdit(), commitAmountDraft(), getCurrencyDisplayName(), getDisplayNames() (+3 more)

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (10): clearInputText(), collectPartialMatches(), expandSnippetRange(), getLocaleHint(), normalizeInput(), resetResults(), runDetection(), updateCount() (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.21
Nodes (6): assertObjectOrUndefined(), createCompiledConfig(), createCurrencyParser(), isUsernameWordCharacter(), normalizeCurrencyCode(), shouldSkipLikelyUsernameCurrencyMatch()

### Community 9 - "Community 9"
Cohesion: 0.22
Nodes (13): Background Alarm Refresh, FX Inline Clone Specification, Extension Runtime Concepts, E2E Conversion Checklist, SaaS Roadmap Delivered, Security Checklist: Network and DOM Hardening, Security Checklist: Manifest and CSP, Inline Conversion Runtime (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.35
Nodes (11): buildAliasSet(), buildProfileAliasMap(), createMagnitudeAliasResolver(), dedupeProfiles(), getAliasMapCacheKey(), getLocaleCandidates(), getProfilesForLocaleHint(), mergeProfileAliasMaps() (+3 more)

### Community 11 - "Community 11"
Cohesion: 0.38
Nodes (9): buildProfileAliasMap(), dedupeProfiles(), getAliasMapCacheKey(), getLocaleCandidates(), getMagnitudeAliasMap(), getProfilesForLocaleHint(), mergeProfileAliasMaps(), normalizeAlias() (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.28
Nodes (9): Fixed-Fee B2B Pilot Offer, Currency Detection API Rules, Currency Detection Package Scope, 2026-04-17 Revenue Review: B2B Pilot Thesis, 2026-04-18 Revenue Review: Trust and Funnel Gap, SaaS Roadmap Not in Scope, Currency Detection Package API, FX Inline Marketing Website (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.25
Nodes (8): Community Hubs Navigation, Corpus Check, Extraction Mix Metrics, God Nodes Core Abstractions, Graph Report, Graph Structure Adds Value Rationale, Hyperedges Section, Surprising Connections

### Community 14 - "Community 14"
Cohesion: 0.48
Nodes (7): Currency Conversion / Exchange, Cyan Circular Ring, Dark Rounded Square Background, Horizontal Exchange Arrows, Extension Icon Asset, Letter R Shape, Letter X Shape

### Community 15 - "Community 15"
Cohesion: 0.29
Nodes (7): Cyan Circular Ring, Currency Conversion Motif, Three Horizontal Lines, Left Arrow Shape, Right Arrow Shape, Dark Rounded Background, FX Inline Site Mark

### Community 16 - "Community 16"
Cohesion: 0.33
Nodes (6): FX Inline Logo, Bidirectional Exchange Arrows, Rounded Square Background, Horizontal Rate Lines, Sparkle Mark, Circular Ring

### Community 17 - "Community 17"
Cohesion: 0.33
Nodes (6): Date Handling Policy (Intl then date-fns), Development Phase Enables Sweeping Changes, Engineering Guidance, No Backward Compatibility Requirement in Development, Correctness, Security, and Performance Focus, Strict TypeScript Rules

### Community 18 - "Community 18"
Cohesion: 0.4
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 0.5
Nodes (2): collectMutationConversionRoots(), toConversionRoot()

### Community 20 - "Community 20"
Cohesion: 0.4
Nodes (2): createInlineConversionPerfAggregate(), runPartialConversionPass()

### Community 21 - "Community 21"
Cohesion: 0.5
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 0.5
Nodes (4): Currency Conversion Extension Icon, Cyan Circular Ring, Dark Rounded-Square Badge, Bidirectional Exchange Motif

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 0.67
Nodes (3): Architecture Diagrams, FX Inline README, Auto-Generated Repository Snapshot

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (3): Central Currency Glyph, Extension Icon, Refresh/Exchange Ring

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (2): Vertical Swap Icon, Swap Vertical Outline SVG

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (2): GitHub Issue Workflow Rules, Worktree Policy

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (2): Decision Summary Commit Body Requirement, Mandatory Git Workflow

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (1): 16px extension icon

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (1): Currency Conversion Extension Icon

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (1): Currency Conversion App Icon

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (1): Toggle On Icon

### Community 70 - "Community 70"
Cohesion: 1.0
Nodes (1): Drop Down Icon

### Community 71 - "Community 71"
Cohesion: 1.0
Nodes (1): Toggle Off Icon

### Community 72 - "Community 72"
Cohesion: 1.0
Nodes (1): Switch Icon

### Community 73 - "Community 73"
Cohesion: 1.0
Nodes (1): Add Outline Icon

## Ambiguous Edges - Review These
- `FX Inline Logo` → `Sparkle Mark`  [AMBIGUOUS]
  apps/extension/public/fx-inline-logo.svg · relation: conceptually_related_to
- `Currency Conversion / Exchange` → `Letter X Shape`  [AMBIGUOUS]
  apps/extension/public/icon/512.png · relation: conceptually_related_to
- `Currency Conversion / Exchange` → `Letter R Shape`  [AMBIGUOUS]
  apps/extension/public/icon/512.png · relation: conceptually_related_to

## Knowledge Gaps
- **47 isolated node(s):** `Architecture Diagrams`, `Auto-Generated Repository Snapshot`, `Security Checklist: Manifest and CSP`, `SaaS Roadmap Not in Scope`, `FX Inline Settings Options Page` (+42 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 26`** (2 nodes): `hardenFirefoxInnerHtmlAssignments()`, `wxt.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `Label()`, `label.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `Input()`, `input.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `Dropdown.tsx`, `Dropdown()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `CurrencyDropdown.tsx`, `CurrencyDropdown()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (2 nodes): `useCurrencyReducer.hydration.ts`, `loadCurrencyReducerHydration()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `App()`, `App.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `timers.ts`, `clearTimer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `guards.ts`, `isUserSettingsSnapshot()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `Vertical Swap Icon`, `Swap Vertical Outline SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `GitHub Issue Workflow Rules`, `Worktree Policy`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `Decision Summary Commit Body Requirement`, `Mandatory Git Workflow`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `eslint.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `data.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `index.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `json.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `currencyPresentation.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `appStorage.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `rateMath.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `constants.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `currencyUtils.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `enums.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `magnitudeProfiles.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `rates.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `Dropdown.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `Convertor.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `Convertor.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `CurrencyBox.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `CurrencyDropdown.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `content.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `perfLogger.types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `perfLogger.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `constants.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `constants.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `constants.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `vite.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `main.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `16px extension icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (1 nodes): `Currency Conversion Extension Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (1 nodes): `Currency Conversion App Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `Toggle On Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `Drop Down Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `Toggle Off Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `Switch Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (1 nodes): `Add Outline Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `FX Inline Logo` and `Sparkle Mark`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Currency Conversion / Exchange` and `Letter X Shape`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Currency Conversion / Exchange` and `Letter R Shape`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `getConvertedAmountText()` connect `Community 0` to `Community 2`, `Community 4`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `createCompiledConfig()` connect `Community 8` to `Community 10`, `Community 2`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `getCanonicalCurrencySymbolToken()` connect `Community 2` to `Community 8`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `extractCurrencyTextMatches()` (e.g. with `refreshExistingInlineConversions()` and `getSiblingCurrencyRawPrice()`) actually correct?**
  _`extractCurrencyTextMatches()` has 7 INFERRED edges - model-reasoned connections that need verification._