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

## End-to-end workflow validation

1. Open dashboard and create account or use mock Google login.
2. Select active client workspace.
3. Save settings (for example `fontColor = #ea7118`).
4. Open Install page and copy snippet.
5. Add snippet to pricing page template or test page.
6. Reload page and verify converted values + latest styling.

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
