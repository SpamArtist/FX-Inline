# B2B Architecture Contract (Phase 0 Freeze)

- Date: 2026-04-23
- Schema Revision: `b2b-arch-r2`
- Status: Normative contract for implementation phases

## Normative Language

The key words MUST, MUST NOT, REQUIRED, SHALL, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## Objective

This document freezes the implementation-ready architecture for the B2B control plane and runtime delivery model so later phases can execute without contract ambiguity.

## Non-Goals

- This document does not define pixel-level UI implementation.
- This document does not define DB schema migration scripts.
- This document does not define Clerk SDK-level integration internals beyond endpoint contracts.
- This document does not define billing or invoicing workflows.

## Out Of Scope For This Phase

- Runtime code changes in `apps/website/b2b-runtime/**`.
- Backend app implementation.
- Authentication implementation details in code.
- UI/dashboard implementation.
- Infrastructure provisioning scripts.

## System Context

The system is composed of five primary subsystems:

1. Dashboard App
- Used by `owner`, `editor`, and `viewer` users.
- Calls control-plane APIs under `/api/v1/...`.
- Never directly writes runtime artifacts.

2. Control-Plane API
- Authoritative API for auth, membership, settings, plugin artifacts, manifest issue, and snippet generation.
- Uses Clerk as the sole identity provider for login/session validation.
- Enforces tenant isolation and role-based authorization.
- Emits request-scoped IDs for auditability.

3. Runtime Loader
- Merchant-embedded script loader.
- Fetches signed manifest and optional settings artifact.
- Verifies signature/integrity before executing plugins.
- Fails closed on trust violations.

4. Plugin Artifact Hosting
- Immutable artifact host for pre/post plugin bundles.
- Stores versioned artifacts with integrity digests.
- Rejects mutable overwrite semantics.

5. Manifest Signing Service
- Issues signed manifest envelopes.
- Signs canonical manifest payloads using key identified by `kid`.
- Provides public key metadata to verifier trust stores.

## Auth Provider Freeze (Clerk)

- Clerk MUST be the only auth provider for this architecture revision.
- `/api/v1/auth/login` MUST exchange Clerk session tokens; local password auth MUST NOT be implemented.
- `/api/v1/auth/oauth/:provider/*` flows MUST execute through Clerk-managed OAuth connections.
- `User` and `Session` entities MUST maintain Clerk identity references (`clerkUserId`, `clerkSessionId`).

## Canonical Data Entities

All workflows MUST use the following canonical entities:

- `User`
  - `userId`, `clerkUserId`, `email`, `displayName`, `status`
- `Client`
  - `clientId`, `name`, `status`, `createdAt`
- `Membership`
  - `clientId`, `userId`, `role` (`owner|editor|viewer`), `status`
- `ClientSettings`
  - `clientId`, `settingsVersion`, `preferredCurrency`, `allowedOrigins`, `allowedPathRegex`, `uiDefaults`, `flags`, `updatedAt`, `updatedBy`
- `PluginArtifact`
  - `artifactId`, `clientId`, `stage` (`pre|post`), `version`, `url`, `integrity`, `createdAt`, `createdBy`
- `ManifestEnvelope`
  - `manifestId`, `schemaVersion`, `manifest`, `signature`, `alg`, `kid`, `issuedAt`, `expiresAt`
- `Session`
  - `sessionId`, `userId`, `clerkSessionId`, `csrfToken`, `issuedAt`, `expiresAt`

## Trust Boundaries And Threat Surface

## Boundary 1: Browser Runtime vs Merchant DOM

- Merchant DOM content MUST be treated as untrusted input.
- Runtime MUST NOT trust arbitrary script order outside its own loader chain.

Primary threats:
- DOM/script injection attempts to alter runtime behavior.
- Attempted runtime invocation on non-authorized pages.

## Boundary 2: Dashboard Client vs Control-Plane API

- All mutating endpoints MUST require authenticated session and CSRF validation.
- Authenticated session creation MUST require successful Clerk token/session verification.
- Authorization MUST be membership- and role-based.

Primary threats:
- Session theft and CSRF.
- Horizontal tenant privilege escalation.

## Boundary 3: Control Plane vs Artifact Storage

- Artifact publish MUST be authenticated and role-gated.
- Artifact digest and URL MUST be immutable once published.

Primary threats:
- Artifact tampering/replacement.
- Digest mismatch attacks.

## Boundary 4: Runtime Loader vs Manifest Endpoint

- Manifest signature MUST be verified before any plugin/settings fetch.
- Host/path policy MUST be enforced before conversion logic runs.

Primary threats:
- Manifest replay and tampering.
- Wrong-tenant configuration issuance.

## Boundary 5: Signing Service Key Boundary

- Private signing keys MUST NOT be exposed to runtime or dashboard.
- Runtime trust MUST be key-ID (`kid`) bound to trusted public keys.

Primary threats:
- Signing key misuse.
- Key confusion and downgrade attempts.

## Component Responsibilities And Ownership

| Component | Responsibility | Owned By | Contract Surface |
| --- | --- | --- | --- |
| Dashboard App | Auth UX, settings UX, plugin/version management UX | Web App Team | `/api/v1/auth/*`, `/api/v1/users/me`, `/api/v1/clients/*` |
| Control-Plane API | Clerk-backed auth/session, authz, tenant isolation, settings, snippets, manifest issue | Platform API Team | `/api/v1/**` |
| Manifest Signing Service | Canonicalization, signature issuance, key rotation metadata | Security Platform Team | Internal signer API + `kid` distribution policy |
| Plugin Artifact Hosting | Immutable plugin artifact hosting and retrieval | Artifact Platform Team | Artifact URLs referenced by manifest |
| Runtime Loader | Signature verification, allowlist/path checks, plugin execution guardrails | Runtime Team | Public manifest/settings/plugin fetch behavior |

## API Surface Index (Architecture-Level)

- Auth
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/oauth/:provider/start`
  - `GET /api/v1/auth/oauth/:provider/callback`
- Identity
  - `GET /api/v1/users/me`
- Membership
  - `GET /api/v1/clients/:clientId/membership`
- Settings
  - `GET /api/v1/clients/:clientId/settings`
  - `PUT /api/v1/clients/:clientId/settings`
- Plugin Artifacts
  - `GET /api/v1/clients/:clientId/plugins`
  - `POST /api/v1/clients/:clientId/plugins/publish`
- Manifest
  - `GET /api/v1/public/manifests/:clientId`
  - `POST /api/v1/clients/:clientId/manifests/issue`
- Install Snippet
  - `GET /api/v1/clients/:clientId/install-snippet`

## Manifest Field Contract Linkage

| Manifest Field | Source Entity | Runtime Decision Point |
| --- | --- | --- |
| `schemaVersion` | `ManifestEnvelope.manifest` | Loader accepts only supported schema version |
| `clientId` | `ManifestEnvelope.manifest` | Loader enforces `data-fxi-client-id` match to prevent tenant confusion |
| `allowedOrigins` | `ClientSettings` snapshot in manifest | Loader checks page origin before any conversion |
| `allowedPathRegex` | `ClientSettings` snapshot in manifest | Loader checks pathname policy before plugin/settings fetch |
| `preferredCurrency` | `ClientSettings` snapshot in manifest | Runtime conversion target currency selection |
| `plugins.pre/post` | `PluginArtifact` references in manifest | Runtime fetches and integrity-verifies plugin chain |
| `settings` | `ClientSettings` artifact reference | Runtime fetches and applies style/UX settings on reload |
| `uiDefaults` | `ClientSettings` snapshot in manifest | Runtime fallback defaults when remote settings are absent |
| `flags.killSwitch` | `ClientSettings` snapshot in manifest | Runtime hard-disable behavior |
| `issuedAt` + `expiresAt` | Manifest issuance metadata | Runtime cache validity and replay window checks |
| `kid` | Signing service key metadata | Public-key selection for signature verification |

## End-To-End Sequence Flows

## Flow A: Login

| Step | Endpoint(s) | Entity | Runtime Behavior |
| --- | --- | --- | --- |
| Dashboard submits Clerk session token | `POST /api/v1/auth/login` | `Session`, `User` | Runtime unaffected |
| Session established | `Set-Cookie: fxi_session` + response csrf token after Clerk verification | `Session` | Dashboard stores CSRF token in memory; runtime still unauthenticated |
| User state resolved | `GET /api/v1/users/me` | `User`, `Membership` | Dashboard can conditionally display client scopes |

## Flow B: Settings Update

| Step | Endpoint(s) | Entity | Runtime Behavior |
| --- | --- | --- | --- |
| Dashboard loads current settings | `GET /api/v1/clients/:clientId/settings` | `ClientSettings` | Runtime unaffected |
| Editor updates settings | `PUT /api/v1/clients/:clientId/settings` | `ClientSettings` | New `settingsVersion` becomes canonical, not auto-pushed to active pages |
| New manifest issued for activation | `POST /api/v1/clients/:clientId/manifests/issue` | `ManifestEnvelope`, `ClientSettings` | Next runtime reload fetches the new manifest/settings and applies updated style values |

## Flow C: Manifest Issue

| Step | Endpoint(s) | Entity | Runtime Behavior |
| --- | --- | --- | --- |
| Authorized user requests issue | `POST /api/v1/clients/:clientId/manifests/issue` | `Client`, `ClientSettings`, `PluginArtifact` | Runtime unaffected until reload |
| Signer canonicalizes and signs payload | internal signer call (no public endpoint) | `ManifestEnvelope` | Signature and `kid` become verifier inputs |
| Manifest becomes retrievable | `GET /api/v1/public/manifests/:clientId` | `ManifestEnvelope` | Loader can bootstrap only if signature, host, and path checks pass |

## Flow D: Script Embed Runtime Execution

| Step | Endpoint(s) | Entity | Runtime Behavior |
| --- | --- | --- | --- |
| Merchant page includes snippet | `GET /api/v1/clients/:clientId/install-snippet` (dashboard generation step) | `Client` | Snippet injects loader with `data-fxi-client-id` and manifest URL |
| Loader requests manifest | `GET /api/v1/public/manifests/:clientId` | `ManifestEnvelope` | Loader verifies signature and policy (`allowedOrigins`, `allowedPathRegex`) using origin/path headers only (no query-string leakage) |
| Loader resolves settings/plugins | URLs from manifest (`settings.url`, `plugins.pre[].url`, `plugins.post[].url`) | `ClientSettings`, `PluginArtifact` | Loader validates integrities and executes deterministic plugin chain |

## Flow E: Style Update Reflected On Reload

| Step | Endpoint(s) | Entity | Runtime Behavior |
| --- | --- | --- | --- |
| Settings updated and manifest re-issued | `PUT /api/v1/clients/:clientId/settings`, `POST /api/v1/clients/:clientId/manifests/issue` | `ClientSettings`, `ManifestEnvelope` | Existing tab remains on old manifest until reload |
| User reloads merchant page | `GET /api/v1/public/manifests/:clientId` + `GET settings.url` | `ManifestEnvelope`, `ClientSettings` | Loader obtains latest signed settings and applies updated styles |
| Policy mismatch detected (if any) | N/A (local runtime validation) | `ManifestEnvelope` | Runtime MUST fail closed and apply no conversion changes |

## Deployment Topology

## Runtime Topology

- Dashboard and control-plane API are same trust domain (`dashboard.<env>.fxi.internal` and `api.<env>.fxi.internal`) but separate deploy units.
- Public manifest and artifact hosts are internet-facing read endpoints with no mutation API exposure.
- Signing service runs in a restricted private network segment and is reachable only by control-plane API.

## Environment Matrix

| Environment | Dashboard Host | API Host | Manifest Host | Artifact Host | Signer Key Class |
| --- | --- | --- | --- | --- | --- |
| local | `http://localhost:3000` | `http://localhost:8787` | `http://localhost:8787/api/v1/public/manifests` | `http://localhost:8787/artifacts` | `dev-local` non-production key |
| staging | `https://dashboard.staging.fxi.example` | `https://api.staging.fxi.example` | `https://api.staging.fxi.example/api/v1/public/manifests` | `https://cdn.staging.fxi.example/artifacts` | `staging-rotating` |
| prod | `https://dashboard.fxi.example` | `https://api.fxi.example` | `https://api.fxi.example/api/v1/public/manifests` | `https://cdn.fxi.example/artifacts` | `prod-hsm-managed` |

## Failure Behavior (Fail-Closed Defaults)

## Manifest Invalid

- Condition: signature invalid, unknown `kid`, malformed payload, or policy schema mismatch.
- Runtime MUST stop before plugin/settings fetch.
- Runtime MUST emit only local diagnostic event code (`MANIFEST_INVALID`) with no page-content payload.

## Plugin Hash Mismatch

- Condition: downloaded plugin bytes hash does not match manifest integrity.
- Runtime MUST skip plugin execution and abort conversion pipeline.
- Runtime MUST NOT fallback to previously cached mismatched plugin.

## Disallowed Host Or Path

- Condition: current page origin/path does not match `allowedOrigins` and `allowedPathRegex`.
- Runtime MUST no-op with zero DOM mutation.
- Runtime MUST NOT call plugin or settings URLs.

## Non-Functional Requirements (Frozen)

- Security
  - Runtime verification MUST be fail-closed.
  - Tenant data reads/writes MUST be client-scoped by `clientId` and membership.
- Privacy
  - Runtime MUST NOT transmit raw page text.
  - Runtime fetches MUST NOT include query strings from merchant page URL.
- Reliability
  - Manifest issue endpoint SHOULD maintain p95 latency <= 500ms excluding artifact upload.
  - Public manifest fetch SHOULD maintain p95 latency <= 300ms in-region.
- Observability
  - Every API response MUST include `requestId`.
  - Logs MUST use allowlisted fields only (see privacy policy contract).

## Cross-Document Consistency Pointers

- API details are authoritative in `docs/B2B_API_CONTRACT.md`.
- Manifest field semantics are authoritative in `docs/B2B_MANIFEST_SCHEMA.md`.
- Privacy/logging/retention rules are authoritative in `docs/B2B_PRIVACY_POLICY_TECH.md`.
