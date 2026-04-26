# E2E Extension Checklist

_Last updated: 2026-04-25_

## Preconditions

- Build and load the unpacked extension.
- Ensure host permissions are granted for the configured rate providers.
- Use a page with visible prices and dynamic updates (SPA/news feed/e-commerce).
- Test at least once on Chromium and once on Firefox.

## 1. Fresh install welcome page

1. Install the extension in a clean browser profile.
2. Confirm a `Welcome to FX Inline` tab opens only for the fresh install flow.
3. Click `Open Settings` and confirm the options page opens.
4. Close the welcome page and verify it does not reopen on extension startup or update.

Expected:
- Fresh installs open the onboarding page once.
- The welcome page can open Settings with the runtime fallback path.

## 2. Popup converter and settings actions

1. Open extension popup from toolbar.
2. Verify two rows render with editable amount displays and currency dropdowns.
3. Change amount in row A, confirm row B recalculates.
4. Use swap button, confirm row positions/rates swap correctly.
5. Toggle global auto-conversion off/on, then local origin toggle off/on.
6. Click settings button and confirm options page opens.
7. Click `Feedback ↗` and confirm external tab opens.

Expected:
- Conversion stays live while editing/committing amounts.
- Local toggle is disabled when active tab origin is unavailable.
- Global/local toggle states persist after reopening popup.

## 3. Options page preferred currency persistence

1. Open options page.
2. Change preferred currency to another code.
3. Confirm status message shows: `Preferred currency updated to <CODE>.`
4. Reopen popup and verify secondary/default row reflects preferred currency logic.

Expected:
- Preferred currency persists across popup/content runtime.

## 4. Selection popup on arbitrary pages

1. Select values in formats:
- `100`
- `USD 100`
- `100USD`
- `R$ 10`
- `￥39,000`
- `yen 6M`
2. Verify selection popup appears near selection and converts using preferred target currency.
3. Click outside with cleared selection and confirm popup is removed.
4. Repeat show/remove cycle several times.

Expected:
- Popup lifecycle remains stable; no duplicate roots or stuck overlays.

## 5. Inline conversion in text nodes

1. Load a page with plain text prices (mixed formats and currencies).
2. Confirm each converted instance renders as `original (converted)`.
3. Verify no conversion occurs inside editable or hidden/assistive-only contexts.
4. Confirm no nested duplicate wrappers after repeated reruns/navigation.

Expected:
- Wrapper class: `fx-inline-conversion`.
- Converted amount node: `.fx-inline-converted-amount`.

## 6. Structured price conversion coverage

1. Test Amazon-like split prices (`symbol + whole + decimal + fraction` fragments).
2. Test sibling symbol/amount layouts, including `yen/month` style text near numeric amount.
3. Trigger DOM updates (client-side route changes or inserted product cards).

Expected:
- Add-on wrappers are appended to structured roots/amount nodes and refresh in place.
- Existing add-ons are removed if source snippet becomes invalid.

## 7. False-positive safety checks

1. Visit content containing usernames/handles (for example `@kes11av`, `kes11buddy`).
2. Include valid prices nearby (for example `USD350/week`, `KES 11`).
3. Confirm valid prices convert while handle-like tokens remain untouched.
4. Verify lowercase prose words matching ISO-like codes (`top`, `all`, `try`, `mad`) do not convert unless uppercase currency tokens are explicit.

Expected:
- No handle/prose false-positive wrappers.

## 8. Rate fetch and refresh behavior

1. Trigger a conversion with normal network access.
2. Confirm rate snapshot is cached and reused within market-day policy.
3. Restart browser (startup path) and keep extension enabled.
4. Wait for/force alarm cycle path and confirm rates still hydrate without errors.

Expected:
- Alarm `fx-inline-refresh-rates` refreshes rates every 30 minutes.
- If fetch fails and cache is valid, conversions still work from cache.

## 9. Runtime stability on dynamic pages

1. On a high-mutation SPA page, trigger repeated content updates.
2. Verify conversions continue appearing on newly inserted content.
3. Navigate or reload quickly to force content script invalidation edges.

Expected:
- No persistent console spam for extension context invalidation during teardown.
- Conversion runtime remains responsive without runaway mutation loops.
