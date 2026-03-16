# E2E Extension Checklist

## Preconditions

- Extension built/loaded with host permissions for public FX provider domains.
- Network access available for client-side rate provider calls.

## 1. Selection popup on dynamic pages

1. Open a dynamic page (news feed or SPA).
2. Select values in formats: `100`, `USD 100`, `100 USD`, `$100`, `100$`, `USD100`, `100USD`.
3. Confirm popup appears near selection and conversion renders.
4. Clear selection; confirm popup dismisses.

## 2. Auto conversion on static + SPA pages

1. Open static page with multiple currency values.
2. Confirm inline converted values appear as `original (converted)`.
3. Navigate SPA route without full reload.
4. Confirm mutation observer catches newly inserted price nodes.

## 3. Rate refresh behavior across day boundaries

1. Load extension on day N and trigger conversion.
2. Confirm day-N snapshot is reused within cache policy.
3. Force refresh (reopen browser/startup alarm path).
4. Confirm a fresh snapshot is fetched and conversions update.
