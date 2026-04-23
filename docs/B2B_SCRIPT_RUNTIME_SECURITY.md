# B2B Script Runtime Security And Privacy

## Scope

This document defines the security and privacy controls for the sample `<script>`-tag runtime at:

- `apps/website/b2b/loader.v1.js`
- `apps/website/b2b-runtime/*`
- `apps/website/public/b2b/manifests/acme.signed.json`

## Threat Model Summary

Primary trust boundaries:

1. Merchant page DOM (untrusted by default)
2. Runtime loader origin
3. Signed manifest endpoint
4. Client pre/post plugin assets
5. Optional remote UI settings

Primary abuse paths:

1. Loading wrong-tenant plugin code on another site
2. Manifest tampering or replay of unsigned content
3. Script swap in plugin URLs
4. CSS or HTML injection through post-plugin settings
5. Silent page text exfiltration

## Controls Implemented

### 1) Signed manifest verification (fail closed)

- Manifest envelopes require `manifest` + `signature`.
- Loader verifies ECDSA P-256 SHA-256 signature before runtime start.
- Invalid signatures abort startup.

Implementation:

- `apps/website/b2b-runtime/manifest.js`
- `apps/website/b2b-runtime/crypto.js`

### 2) Tenant and path isolation

- `data-fxi-client-id` must match signed `manifest.clientId`.
- Runtime only starts when current `origin` and `pathname` match allowlists in manifest.
- Out-of-scope locations no-op.

Implementation:

- `apps/website/b2b-runtime/loader.js`
- `apps/website/b2b-runtime/manifest.js`

### 3) Plugin integrity checks

- Pre and post plugins are fetched as text.
- SHA-256 integrity (`sha256-*`) is verified before execution.
- Verification failure aborts startup.

Implementation:

- `apps/website/b2b-runtime/loader.js`
- `apps/website/b2b-runtime/crypto.js`

### 4) UI settings sanitization

- Numeric values are clamped to safe ranges.
- Font family is restricted to allowlisted values.
- Color accepts only conservative formats.
- No direct interpolation into `style` attributes.

Implementation:

- `apps/website/b2b-runtime/settings.js`

### 5) Privacy defaults

- Fetch calls use `credentials: "omit"`.
- `referrerPolicy: "no-referrer"` is used for runtime network calls.
- Runtime does not transmit page text to external services.
- Rate fetch calls only request provider exchange-rate endpoints.

Implementation:

- `apps/website/b2b-runtime/loader.js`
- `apps/website/b2b-runtime/rates.js`

### 6) Operational kill switch

- Signed manifest supports `flags.killSwitch`.
- Loader exits without running conversion when enabled.

Implementation:

- `apps/website/b2b-runtime/loader.js`

## Plugin Authoring Guardrails

Pre plugins must:

1. Use deterministic selectors only.
2. Restrict detection scope to approved paths/components.
3. Return explicit candidate nodes and raw values.

Post plugins must:

1. Render through safe DOM APIs (`textContent`, `createElement`).
2. Avoid `innerHTML`, `eval`, and dynamic code paths.
3. Honor sanitized settings only.

## Manifest Signing Process

Use:

```bash
FXI_MANIFEST_PRIVATE_KEY_PATH=/abs/path/to/private.pem node scripts/b2b/sign-acme-manifest.mjs
```

The private key must never be committed.

## Demo Runtime Snippet

```html
<script
  type="module"
  src="/b2b/loader.v1.js"
  data-fxi-client-id="acme"
  data-fxi-manifest-url="/b2b/manifests/acme.signed.json"
  defer
></script>
```

## Known Hardening Follow-ups

1. Add manifest expiration (`expiresAt`) and replay windows.
2. Pin plugin hostnames in manifest policy.
3. Add runtime telemetry redaction tests for future metrics.
