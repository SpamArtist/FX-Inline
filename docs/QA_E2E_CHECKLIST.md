# E2E Extension Checklist

## Preconditions

- Backend running (`npm run backend:start`) with reachable URL.
- Extension built/loaded with host permissions for backend URL.
- User account available in backend.

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

## 3. Free vs paid refresh behavior across day boundaries

1. Sign in but keep free/canceled state.
2. Trigger sync, then observe same-day free snapshot reuse.
3. Move account to paid/trial in backend (or via Stripe test webhook).
4. Confirm paid tier updates within short TTL windows.

## 4. Billing and entitlement flow

1. In popup, sign in and click `Checkout`.
2. Complete checkout in Stripe test mode (or mock flow).
3. Send webhook event (if Stripe configured).
4. Click `Sync Plan` in popup and confirm entitlement transitions to paid/trial.

## 5. Usage limits and telemetry safety

1. Generate many inline conversions as free user.
2. Confirm backend usage counters increment without page URL/content fields.
3. Confirm limit behavior once daily quota is exhausted.
