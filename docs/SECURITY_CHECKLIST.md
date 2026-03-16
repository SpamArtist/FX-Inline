# Security Checklist

## Token handling

- Access tokens are short-lived and refresh tokens are rotated.
- Logout revokes refresh session.
- Extension stores auth state in extension storage only.

## Logging safety

- No token values are printed in backend startup/runtime logs.
- Webhook/event errors should log message-level info only.

## CSP and permissions

- Extension CSP restricts script/object sources to self.
- `connect-src` is limited to public rate provider domains (+ local dev HMR endpoints).
- Host permissions reviewed for least privilege.

## API auth controls

- `/entitlements/me`, `/usage/events`, billing session endpoints require bearer auth.
- Admin endpoints support `ADMIN_API_KEY` gating.

## Billing/webhook checks

- Stripe webhook signature verification enabled when webhook secret is configured.
- Webhook failures create operations alerts.

## Operational monitoring

- Admin stats expose rate freshness and unresolved alerts.
- Provider failures/stale caches produce alert records for follow-up.
