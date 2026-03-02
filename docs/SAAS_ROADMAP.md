# Currency Conversion SaaS Roadmap

## Delivered in extension app

1. Selection popup trigger
- Detects selected values when numeric-only, symbol-prefixed/suffixed, or ISO-prefixed/suffixed.
- Supports examples: `100`, `USD 100`, `100 USD`, `$100`, `100$`, `USD100`, `100USD`.

2. Preferred currency persistence
- Preferred currency is stored in extension storage and reused across popup + content conversions.

3. Free vs paid rate behavior
- Plan behavior is now entitlement-driven from backend state.
- Free users: market-day snapshot behavior.
- Paid/trial users: short TTL refresh behavior.

4. Background refresh
- Background worker runs alarm-based refresh and keeps rates warm.
- Also refreshes auth + entitlement state when available.

5. Auto webpage conversion
- Content script scans text nodes, decorates detected currency prices, and responds to DOM mutations.
- Telemetry-safe usage counters are sent without page content/URL payloads.

6. Popup settings UI
- Preferred currency selector.
- Auth actions: sign up/sign in/sign out.
- Entitlement sync + checkout + billing portal actions.

## Delivered in backend app

1. Authentication service
- `POST /auth/signup`, `POST /auth/signin`.
- Access + refresh token issuance.
- Refresh token rotation (`POST /auth/refresh`) and logout revocation (`POST /auth/logout`).

2. Subscription + entitlements API
- `GET /entitlements/me` returns `free|paid|trial|canceled` with plan metadata.
- Extension validates entitlement from backend instead of local paid toggle.

3. Payment integration
- `POST /billing/checkout-session` and `POST /billing/customer-portal`.
- Stripe webhook processor (`POST /billing/webhook`) updates entitlement records.
- Works in mock mode when Stripe env vars are absent.

4. Rate-source hardening
- Primary + fallback provider fetch flow in backend.
- Server-side normalization + quality checks + cache policies.
- Provider health tracking and alert generation.

5. Extension-backend messaging
- Extension fetches backend rates/entitlements.
- Telemetry-safe usage counters with plan-based daily limits.

6. Admin + operations
- `GET /admin`, `GET /admin/stats`, `GET /admin/alerts`.
- Dashboard includes subscription counts, rate freshness, provider health, and failures.

## QA tasks

1. Unit tests (automated)
- Parser coverage for roadmap formats and extraction behavior.
- Rate conversion math and rate-cache policy helpers.
- Run with: `npm run test:unit`.

2. E2E extension checks (runbook)
- Added manual checklist in [QA_E2E_CHECKLIST.md](/Users/xbotpc/Desktop/XBOTPC/Work/Code/currency-conversion-extension-tool/docs/QA_E2E_CHECKLIST.md).

3. Security checks (runbook)
- Added token/log/CSP/permissions checklist in [SECURITY_CHECKLIST.md](/Users/xbotpc/Desktop/XBOTPC/Work/Code/currency-conversion-extension-tool/docs/SECURITY_CHECKLIST.md).

## External production steps remaining

These require external environment setup, not local code changes:
- Configure real Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`).
- Deploy backend to a reachable host and update extension backend base URL.
- Set `ADMIN_API_KEY` and integrate alert forwarding (email/Slack/PagerDuty).
