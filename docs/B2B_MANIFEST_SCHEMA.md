# B2B Manifest Schema And Verification Contract (Phase 0 Freeze)

- Date: 2026-04-23
- Schema Revision: `b2b-manifest-r1`
- Manifest `schemaVersion`: `1.0.0`

## Normative Language

The key words MUST, MUST NOT, REQUIRED, SHALL, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## Objective

This document defines the canonical manifest payload shape, signing and verification rules, URL resolution behavior, and cache/replay policy for the B2B runtime bootstrap contract.

## Non-Goals

- No runtime implementation code.
- No key-management system implementation.
- No plugin business-logic specification.

## Out Of Scope For This Phase

- Runtime loader source changes.
- Cryptographic library selection and code integration.
- CDN configuration and deployment mechanics.

## Manifest Envelope

Runtime manifest responses MUST return this envelope structure:

```json
{
  "manifestId": "mf_001",
  "schemaVersion": "1.0.0",
  "manifest": {
    "schemaVersion": "1.0.0",
    "clientId": "client_acme",
    "allowedOrigins": ["https://acme.example"],
    "allowedPathRegex": ["^/pricing(/.*)?$"],
    "preferredCurrency": "USD",
    "plugins": {
      "pre": [
        {
          "url": "https://cdn.fxi.example/artifacts/client_acme/pre/1.3.0/index.js",
          "integrity": "sha256-prehash..."
        }
      ],
      "post": []
    },
    "settings": {
      "url": "https://cdn.fxi.example/settings/client_acme/13.json",
      "integrity": "sha256-settingshash..."
    },
    "uiDefaults": {
      "badgeStyle": "compact",
      "accentColor": "#e05d44"
    },
    "flags": {
      "killSwitch": false
    },
    "issuedAt": "2026-04-23T10:31:00Z",
    "expiresAt": "2026-04-23T10:41:00Z",
    "kid": "k_2026_04_prod"
  },
  "alg": "ECDSA_P256_SHA256",
  "signature": "MEUCIB..."
}
```

## Canonical Manifest Payload Shape

All fields below are REQUIRED unless marked optional.

| Field | Type | Constraints |
| --- | --- | --- |
| `schemaVersion` | string | MUST equal `1.0.0` for this revision |
| `clientId` | string | Lowercase slug format: `client_[a-z0-9_]+` |
| `allowedOrigins` | string[] | 1..50 entries, each absolute origin (`https://host[:port]`) |
| `allowedPathRegex` | string[] | 1..50 anchored regular expressions (MUST start with `^`) |
| `preferredCurrency` | string | ISO-4217 uppercase code |
| `plugins.pre` | object[] | 0..10 entries, each with `url` + `integrity` |
| `plugins.post` | object[] | 0..10 entries, each with `url` + `integrity` |
| `settings.url` | string | REQUIRED runtime settings URL |
| `settings.integrity` | string (optional by rule) | See integrity optional rule below |
| `uiDefaults` | object | Runtime-safe defaults for UI tokens |
| `flags.killSwitch` | boolean | `true` MUST disable all conversion behavior |
| `issuedAt` | string | RFC 3339 UTC timestamp |
| `expiresAt` | string | RFC 3339 UTC timestamp, MUST be later than `issuedAt` |
| `kid` | string | Signing key identifier used by verifier trust set |

Plugin object shape (`plugins.pre[]` and `plugins.post[]`):

| Field | Type | Constraints |
| --- | --- | --- |
| `url` | string | URL resolution rules apply |
| `integrity` | string | MUST be `sha256-<base64-value>` |

`settings` integrity optional rule:

- `settings.integrity` SHOULD be present.
- `settings.integrity` MAY be omitted only when ALL are true:
  - `settings.url` resolves to same origin as manifest URL.
  - `settings.url` path contains immutable hash token (minimum 8 hex chars).
  - `Cache-Control` on settings response is immutable (`max-age>=300` and no-store absent).
- If the above conditions are not met, runtime MUST reject manifest when `settings.integrity` is missing.

## Signing Rules

## Canonicalization Algorithm

- The signer MUST canonicalize only the `manifest` object (not envelope metadata) using RFC 8785 JSON Canonicalization Scheme (JCS).
- UTF-8 bytes of canonicalized JSON are the exact signing input.

## Signing Algorithm

- Algorithm MUST be `ECDSA_P256_SHA256`.
- Signer computes SHA-256 over canonical bytes, then signs digest using ECDSA P-256 private key for `kid`.
- Signature MUST be base64url-encoded DER.

## Verification Requirements

Runtime verifier MUST execute these checks in order:

1. Envelope structure valid and required fields present.
2. `schemaVersion` in envelope and payload equals supported version.
3. `kid` exists in trusted key set.
4. Canonicalize `manifest` using RFC 8785.
5. Verify signature with public key selected by `kid` and `alg`.
6. Validate time window (`issuedAt`, `expiresAt`, skew policy).
7. Validate origin/path policy (`allowedOrigins`, `allowedPathRegex`).
8. Validate plugin/settings URL + integrity policy.

Verification failure behavior:

- Runtime MUST fail closed.
- Runtime MUST NOT execute plugins.
- Runtime MUST NOT mutate merchant DOM.
- Runtime MUST emit local diagnostic code only (for example `MANIFEST_SIG_INVALID`, `MANIFEST_EXPIRED`, `MANIFEST_POLICY_DENY`).

## URL Resolution Rules

These rules apply to `plugins.pre[].url`, `plugins.post[].url`, and `settings.url`.

- Absolute URLs:
  - MUST use `https://` in staging/prod.
  - MAY use `http://localhost` or `http://127.0.0.1` in local only.
- Relative URLs:
  - MAY be root-relative (`/path`) or file-relative (`./file.js`).
  - MUST resolve against manifest response URL.
- Forbidden URL patterns:
  - Protocol-relative (`//host/path`)
  - Non-HTTP schemes (`data:`, `javascript:`, `file:`)
  - Encoded or raw traversal markers intended to bypass normalization

Resolution output MUST be normalized absolute URL before fetch.

## Cache And Replay Policy

## Max-Age And Cache Rules

- Runtime MAY cache successful manifest envelopes.
- Effective manifest cache TTL MUST be:
  - `min(server_cache_max_age, expiresAt-now, 300 seconds)`
- Runtime MUST NOT use cached manifest past `expiresAt`.

## Clock Skew Tolerance

- Runtime MUST allow +/-120 seconds skew when evaluating `issuedAt`/`expiresAt`.
- If current time is outside tolerated window, manifest MUST be rejected.

## Replay Constraints

- `expiresAt` MUST be <= `issuedAt + 24h`.
- Manifest with `issuedAt` older than 24h from verifier clock (after skew adjustment) MUST be rejected.
- Runtime MUST bind accepted manifest to requested `clientId`; cross-client replay MUST be rejected.

## Expired Manifest Behavior

- If fetched manifest is expired, runtime MUST fail closed.
- Runtime MUST NOT fallback to any expired cached manifest.
- If an unexpired cached manifest exists and network fetch fails, runtime MAY use cached manifest until cache TTL ends.

## Cross-Document Dependencies

- Endpoint transport for this schema is defined in `docs/B2B_API_CONTRACT.md`.
- Privacy/logging constraints for runtime fetch and diagnostics are defined in `docs/B2B_PRIVACY_POLICY_TECH.md`.
- Workflow mapping is defined in `docs/B2B_ARCHITECTURE.md`.
