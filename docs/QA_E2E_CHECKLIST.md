# E2E Extension Checklist

_Last updated: 2026-05-01_

## Preconditions

- Build and load the unpacked extension with `npm run build` for Chromium and `npm run build:firefox` for Firefox. These commands run admin settings export, optimized extension assets, and build-output assertions.
- Use `npm run zip -- --sources` when validating Chrome/source archives; `prezip` runs admin settings export and extension asset optimization before WXT zips.
- Ensure host permissions are granted for the configured rate providers.
- Use a page with visible prices and dynamic updates (SPA/news feed/e-commerce).
- Test at least once on Chromium and once on Firefox.
- For admin settings checks, run `npm run admin:api` and `npm run dev:admin`.

## 1. Fresh install welcome page

1. Install the extension in a clean browser profile.
2. Confirm a `Welcome to FX Inline` tab opens only for the fresh install flow.
3. Click `Open Settings` and confirm the options page opens.
4. Close the welcome page and verify it does not reopen on extension startup or update.

Expected:
- Fresh installs open the onboarding page once.
- The DOM-rendered welcome page can open Settings with the runtime fallback path.

## 2. Admin scoped runtime settings and export

1. Open the admin workbench from the Vite URL.
2. Confirm settings load from `/api/settings`.
3. Add a domain scope and an exact page override on that domain.
4. Change target currency, converted amount position, display style, and highlight color.
5. Save all settings and confirm the success toast appears.
6. Confirm `apps/extension/generated/inlineRuntimeSettingsManifest.ts` contains the saved scopes.
7. Use the admin build action or run `npm run build` and confirm the export step runs before WXT.
8. Run `npm run compile`, `npm run test:frontend`, or `npm run test:content` and confirm the npm lifecycle export runs before TypeScript consumes the generated manifest.

Expected:
- The admin API binds locally and persists sanitized settings to SQLite.
- Saved all-pages, domain, and page settings are exported into the generated manifest.
- The generated manifest remains local ignored build output and is refreshed by export/build/compile/test-build commands.
- Page scopes override domain scopes, and domain scopes override the all-pages default.

## 3. Popup converter and settings actions

1. Open extension popup from toolbar.
2. Verify two rows render with editable amount displays and styled native currency selectors.
3. Change amount in row A, confirm row B recalculates.
4. Use swap button, confirm row positions/rates swap correctly.
5. Change currency with mouse and keyboard navigation, then confirm the chip display and converted value update.
6. Toggle global auto-conversion off/on, then local page-origin toggle off/on.
7. Click settings button and confirm options page opens.
8. Click `Feedback ↗` and confirm external tab opens.
9. Confirm popup, options, welcome, and selection popup UI load the shared `/theme.css` stylesheet without missing theme styles.

Expected:
- Conversion stays live while editing/committing amounts.
- Native selector behavior remains accessible without loading the old Radix popup menu path.
- Shared theme styling is consistent across extension pages and the selection popup Shadow DOM.
- Local toggle is disabled when active tab origin is unavailable.
- Global toggle updates the all-pages scope; local toggle writes a domain scope for the active origin.

## 4. Options page preferred currency persistence

1. Open options page.
2. Change preferred currency to another code.
3. Confirm status message shows: `Preferred currency updated to <CODE>.`
4. Reopen popup and verify secondary/default row reflects preferred currency logic.

Expected:
- Preferred currency persists as the first target currency in the all-pages settings scope.

## 5. Selection popup on arbitrary pages

1. Select values in formats:
- `100`
- `USD 100`
- `100USD`
- `BOB 123`
- `R$ 10`
- `￥39,000`
- `yen 6M`
2. Verify selection popup appears near selection and converts using preferred target currency.
3. Click outside with cleared selection and confirm popup is removed.
4. Repeat show/remove cycle several times.

Expected:
- Popup lifecycle remains stable; no duplicate roots or stuck overlays.
- Numeric-only selections default to EUR as the source currency.

## 6. Inline conversion in text nodes

1. Load a page with plain text prices (mixed formats and currencies).
2. Confirm each converted instance renders as `original (converted)` unless scoped settings choose another display style.
3. Verify no conversion occurs inside editable or hidden/assistive-only contexts.
4. Confirm no nested duplicate wrappers after repeated reruns/navigation.

Expected:
- Wrapper class: `fx-inline-conversion`.
- Converted amount node: `.fx-inline-converted-amount`.
- Scoped runtime settings can change target currency, position, display style, and highlight color.

## 7. Structured price conversion coverage

1. Test Amazon-like split prices (`symbol + whole + decimal + fraction` fragments).
2. Test sibling symbol/amount layouts, including `yen/month` style text near numeric amount.
3. Test a supported Little Hotelier pricing URL path.
4. Trigger DOM updates (client-side route changes or inserted product cards).

Expected:
- Add-on wrappers are appended to structured roots/amount nodes and refresh in place.
- Existing add-ons are removed if source snippet becomes invalid.
- Site-specific plugins do not duplicate the shared text-node conversion path.

## 8. False-positive safety checks

1. Visit content containing usernames/handles (for example `@kes11av`, `kes11buddy`).
2. Include valid prices nearby (for example `USD350/week`, `KES 11`).
3. Confirm valid prices convert while handle-like tokens remain untouched.
4. Verify lowercase prose words matching ISO-like codes (`top`, `all`, `try`, `mad`) do not convert unless uppercase currency tokens are explicit.
5. Confirm `BOV`, `COU`, and `VED` do not convert, while `BOB`, `COP`, and `VES` do.

Expected:
- No handle/prose false-positive wrappers.
- Active country currency codes are accepted; non-circulating unit codes are rejected.

## 9. Rate fetch and refresh behavior

1. Trigger a conversion with normal network access.
2. Confirm rate snapshot is cached and reused within market-day policy.
3. Restart browser (startup path) and keep extension enabled.
4. Wait for/force alarm cycle path and confirm rates still hydrate without errors.

Expected:
- Alarm `fx-inline-refresh-rates` refreshes rates every 30 minutes.
- If fetch fails and cache is valid, conversions still work from cache.

## 10. Runtime stability on dynamic pages

1. Visit an `http`/`https` page without visible price text and confirm no conversion UI appears before a price signal.
2. Select a valid price-like snippet and confirm the selection popup appears after the content worker starts.
3. On a high-mutation SPA page, trigger repeated content updates.
4. Verify conversions continue appearing on newly inserted content.
5. Change scoped settings and confirm delayed reconversion applies without duplicate wrappers.
6. Navigate or reload quickly to force content script invalidation edges.

Expected:
- The lightweight all-URLs shim only starts the full worker after initial text, inserted-node, or selection activation signals.
- No persistent console spam for extension context invalidation during teardown.
- Conversion runtime remains responsive without runaway mutation loops.
