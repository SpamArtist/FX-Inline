# B2B Privacy And Data-Handling Technical Policy (Phase 0 Freeze)

- Date: 2026-04-23
- Schema Revision: `b2b-privacy-r1`
- Scope: Dashboard, control-plane API, manifest/artifact serving, runtime loader telemetry boundaries

## Normative Language

The key words MUST, MUST NOT, REQUIRED, SHALL, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## Objective

This document freezes technical privacy controls and operational data policies for B2B runtime and control-plane workflows.

## Non-Goals

- No legal-text replacement for public privacy policy pages.
- No jurisdiction-specific legal interpretation.
- No vendor contract language.

## Out Of Scope For This Phase

- Analytics product instrumentation implementation.
- SIEM vendor integration implementation.
- DLP platform implementation.

## Data Inventory By Category

## 1) Account Data

Data elements:

- `User.userId`
- `email`
- `displayName`
- auth provider subject ID (OAuth)
- session metadata (`sessionId`, expiry timestamps)

Purpose:

- Authentication and account lifecycle management.

Storage class:

- Restricted, tenant-admin operational access only.

## 2) Client Configuration Data

Data elements:

- `Client.clientId`, name, status
- `Membership` role bindings
- `ClientSettings` (allowed origins/path patterns, preferred currency, ui defaults, kill switch)
- `PluginArtifact` metadata (`url`, `integrity`, stage, version)
- Manifest issuance metadata (`manifestId`, `kid`, `issuedAt`, `expiresAt`)

Purpose:

- Tenant-scoped policy and runtime behavior control.

Storage class:

- Restricted, tenant-scoped access control.

## 3) Runtime Operational Data

Data elements:

- Manifest fetch status code class
- Runtime diagnostic code (for example `MANIFEST_SIG_INVALID`)
- Loader version
- Timestamp bucket (minute-level)
- Tenant key (`clientId`)

Purpose:

- Operational reliability and security incident triage.

Storage class:

- Minimal operational telemetry, no page content.

## Data Minimization Rules

- Runtime MUST NOT transmit raw page text, DOM fragments, or detected price strings.
- Runtime MUST NOT send merchant URL query parameters or fragments in any network request.
- Runtime manifest requests MUST include only:
  - `X-FXI-Page-Origin`
  - `X-FXI-Page-Path` (pathname only)
- Runtime network requests MUST use `referrerPolicy=no-referrer`.
- Runtime requests to manifest/settings/plugin URLs SHOULD use `credentials=omit` unless explicit same-origin credentials are required and approved by Security Platform.
- Dashboard and API logs MUST avoid storing plaintext passwords, OAuth auth codes, session IDs, CSRF tokens, and signatures.

## Logging Policy

## Allowlist-Only Logging

Only the following fields MAY be logged by default:

| Component | Allowed Fields |
| --- | --- |
| Auth endpoints | `requestId`, timestamp, route, status, userId (if known), normalized email hash, source IP hash |
| Client settings endpoints | `requestId`, timestamp, route, status, userId, clientId, settingsVersion |
| Manifest issue endpoint | `requestId`, timestamp, route, status, userId, clientId, manifestId, kid, expiresAt |
| Public manifest fetch | `requestId`, timestamp, route, status, clientId, origin hostname only, path hash |
| Runtime diagnostics (if enabled) | timestamp bucket, clientId, loaderVersion, diagnostic code, count |

## Redaction Rules

- The following fields MUST be redacted or excluded entirely:
  - `password`
  - OAuth `code`, `access_token`, `refresh_token`, `id_token`
  - `Set-Cookie`, session cookie value, CSRF token
  - Raw `X-FXI-Page-Path` when it may contain identifiers (store hashed form)
  - Any page content payload
- Email addresses SHOULD be stored in hashed form in request logs; plaintext email MAY appear only in account records.

## Retention And Deletion Policy

| Data Class | Default Retention | Deletion Rule |
| --- | --- | --- |
| Session records | 24h after expiration | Hard delete automatically after retention window |
| Auth event logs | 90 days | Auto-delete; no indefinite archive in hot storage |
| Account profile records | Until account deletion request + 30 days grace | Hard delete or irreversible anonymization |
| Membership/client config audit logs | 365 days | Tenant deletion triggers purge within 30 days |
| Manifest issuance records | 180 days | Purge by age; retain only aggregate counters beyond window |
| Runtime operational aggregates | 30 days | Auto-delete by partition age |
| Plugin artifact binaries | Until superseded + 30 days rollback window | Purge non-referenced artifacts after rollback window |

Deletion guarantees:

- Tenant deletion workflow MUST purge tenant-scoped configuration and operational records within 30 days.
- Backup copies MUST age out within 35 days maximum.

## Telemetry Policy

- Default mode is OFF for per-page runtime telemetry.
- Without explicit tenant owner opt-in, system MUST collect only platform-level aggregate metrics with no page-level context.
- If tenant enables minimal diagnostics, payload MUST be aggregate counters only (no raw event stream, no path plaintext, no content).
- No runtime endpoint for custom arbitrary telemetry is defined in `v1`; adding one requires a new contract revision.

## Incident Response And Kill-Switch Expectations

## Incident Classification

- `P1`: Signing key compromise, cross-tenant data exposure, widespread unauthorized runtime execution.
- `P2`: Tenant-isolated misconfiguration or partial manifest verification failures.
- `P3`: Non-sensitive logging policy drift without confirmed exposure.

## Response Requirements

- P1 incidents MUST trigger global incident response within 15 minutes.
- P1 incidents MUST force global runtime disable path:
  - Set global runtime disable in control plane.
  - Force manifest issue endpoint to produce `flags.killSwitch=true` for all clients until recovery.
- Tenant-scoped incidents MUST allow per-client kill switch activation via `ClientSettings.flags.killSwitch`.
- Key compromise response MUST rotate signing key (`kid`) and revoke compromised key trust immediately.

## Verification Expectations For Later Phases

- Security tests MUST prove runtime fails closed when policy/signature validation fails.
- Privacy tests MUST prove no query-string transmission in runtime fetches.
- Log pipeline tests MUST prove redaction and allowlist compliance.

## Cross-Document Dependencies

- Endpoint and auth details: `docs/B2B_API_CONTRACT.md`.
- Manifest policy and verification fields: `docs/B2B_MANIFEST_SCHEMA.md`.
- Workflow/runtime behavior traceability: `docs/B2B_ARCHITECTURE.md`.
