# Security Checklist

_Last updated: 2026-04-25_

## 1. Manifest surface and CSP

- [ ] `permissions` are limited to `storage`, `alarms`, `activeTab`.
- [ ] `host_permissions` are limited to approved FX providers only.
- [ ] Extension-page CSP includes:
  - `default-src 'self'`
  - `script-src 'self'`
  - `style-src 'self' 'unsafe-inline'`
  - `object-src 'none'`
  - `base-uri 'none'`
  - `connect-src` restricted to self + provider origins (+ dev localhost/HMR only in development).

## 2. Network and rate-fetch hardening

- [ ] Rate requests use timeout and `AbortController`.
- [ ] Requests set `cache: "no-store"`, `credentials: "omit"`, `referrerPolicy: "no-referrer"`, `redirect: "error"`.
- [ ] Provider fallback order is deterministic and validated.
- [ ] Cached snapshot fallback only applies when cache shape/base currency is valid.

## 3. Storage integrity

- [ ] User settings are sanitized on read/write.
- [ ] `preferredCurrency` is constrained to known ISO codes.
- [ ] `globalAutoConversionEnabled` coerces to boolean default when invalid.
- [ ] `localAutoConversionByOrigin` accepts only canonical `http/https` origins and boolean values.

## 4. DOM safety and injection controls

- [ ] Inline conversions use DOM node creation/replacement APIs, not unsafe HTML injection.
- [ ] Conversion wrappers are idempotent and avoid nested duplicate wrappers.
- [ ] Conversion skips editable, hidden, and blocked-tag contexts.
- [ ] Selection popup event capture is scoped to extension UI root/portal to avoid page-side interference.

## 5. Browser-specific hardening

- [ ] Firefox manifest gecko id remains fixed (`fx-inline@xbotpc`).
- [ ] Gecko `data_collection_permissions.required = ["none"]` is present.
- [ ] Firefox build post-processing keeps generated manifest `version` and `version_name` aligned with the release tag.

## 6. Privacy and telemetry boundaries

- [ ] No user-auth/account data is collected by extension runtime.
- [ ] No browsing history payloads are transmitted; only provider rate endpoints are contacted.
- [ ] Debug/perf logging is development-default; production logging requires explicit `localStorage` opt-in (`ccx:perf=1`).

## 7. Pre-Ship Checks

- [ ] Run `npm run test:all` before shipping changes.
- [ ] For tagged releases, validate the tag/version locally:
  - `RELEASE_TAG=v0.4.1 npm run release:validate-tag`
  - `RELEASE_TAG=v0.4.1 npm run release:dry-run`
- [ ] GitHub Actions release workflow (`.github/workflows/release.yml`) keeps least-privilege permissions (only the GitHub release job requires `contents: write`).
- [ ] Store credentials (Chrome/Edge/AMO) are stored as GitHub Actions secrets and never committed to the repo.
- [ ] Re-verify permissions/CSP/host permissions after manifest or dependency changes.
- [ ] Re-test popup/options/content script behavior on Chromium and Firefox builds.
