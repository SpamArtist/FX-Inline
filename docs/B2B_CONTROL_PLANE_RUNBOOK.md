# B2B Control Plane Runbook

## Apps

- Control plane API: `apps/control-plane-api`
- Dashboard: `apps/dashboard`
- Runtime loader/core: `apps/website/b2b-runtime`

## Local startup

1. Start API:

```bash
npm run dev:control-plane
```

2. Start website (loader + demo + plugin assets):

```bash
npm run dev:website
```

3. Start dashboard:

```bash
npm run dev:dashboard
```

## Default local URLs

- API: `http://127.0.0.1:8787`
- Website: `http://127.0.0.1:5173`
- Dashboard: `http://127.0.0.1:5174`

## Admin bootstrap (required once)

First platform admin identities are bootstrapped directly in the database.

```sql
INSERT INTO platform_admin_identities (
  email,
  clerk_user_id,
  created_by_user_id,
  created_at,
  updated_at
) VALUES (
  'admin@yourcompany.com',
  NULL,
  NULL,
  EXTRACT(EPOCH FROM NOW())::bigint * 1000,
  EXTRACT(EPOCH FROM NOW())::bigint * 1000
)
ON CONFLICT (email) DO NOTHING;
```

Notes:
- `email` MUST match the Clerk account email.
- `clerk_user_id` is optional during bootstrap. It auto-binds on first successful admin login.

## Login and allowlist policy

- Dashboard login uses Clerk hosted auth only (Google SSO and email/password).
- Backend verifies Clerk session tokens through `POST /api/v1/auth/login`.
- Admin users (from `platform_admin_identities`) bypass domain restrictions.
- Non-admin users are allowed only when their email domain exactly matches an entry in `allowed_email_domains`.
- If `allowed_email_domains` is empty, all non-admin logins are denied.

## Domain allowlist operations

1. Sign in as a platform admin.
2. Open Dashboard `#/admin`.
3. Add or remove allowed domains (exact values like `acme.com`).
4. Changes are effective for the next non-admin login attempt.

## End-to-end workflow validation

1. Admin logs in and adds `acme.com` in `#/admin`.
2. A non-admin `user@acme.com` logs in.
3. Select active client workspace.
4. Save settings (for example `fontColor = #ea7118`).
5. Open Install page and copy snippet.
6. Add snippet to pricing page template or test page.
7. Reload page and verify converted values + latest styling.

## Settings propagation behavior

- Runtime manifest endpoint returns signed payload with short expiry.
- Runtime settings endpoint returns latest versioned settings.
- Reloading a page re-fetches manifest/settings and applies latest values.

## Plugin publication workflow

1. Build deterministic plugin artifact with LLM assistance.
2. Publish artifact metadata in dashboard Plugins page or API.
3. Manifest responses pick up latest approved artifact versions.

## Key handling

- Production: set `CONTROL_PLANE_MANIFEST_PRIVATE_KEY_PATH`.
- Local: API auto-generates dev key pair in `apps/control-plane-api/.data/`.
- Install snippets include public key PEM for runtime signature verification.
