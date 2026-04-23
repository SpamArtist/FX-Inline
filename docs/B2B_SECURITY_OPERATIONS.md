# B2B Security Operations

_Last updated: 2026-04-23_

## Scope

Operational controls for the B2B runtime stack:

- `apps/control-plane-api`
- `apps/dashboard`
- `apps/website/b2b-runtime`
- `packages/b2b-plugin-sdk`

## Control Objectives

1. Tenant isolation across all API paths.
2. Signed manifest verification for runtime startup.
3. Integrity checks for pre/post plugin artifacts.
4. No runtime transmission of raw page text or price strings.
5. Recoverability via manifest kill switch and key rotation.

## Mandatory Controls

1. API authorization
- All `/api/v1/clients/:clientId/*` endpoints require an authenticated member.
- Write endpoints require owner or editor role.

2. Session protection
- Session cookie must be `HttpOnly` and `SameSite=Lax`.
- State-changing endpoints require `x-csrf-token` from `/api/v1/auth/csrf`.

3. Runtime trust
- Runtime must verify manifest signature before plugin loading.
- Runtime must verify `sha256-*` integrity for each plugin artifact.
- Runtime must no-op when origin/path is out of allowlist scope.

4. Privacy defaults
- Runtime network calls use `credentials: omit` and `referrerPolicy: no-referrer`.
- Runtime must never upload page text payloads.

## Key Management

1. Production
- Configure `CONTROL_PLANE_MANIFEST_PRIVATE_KEY_PATH`.
- Private key must be stored in external secret storage.
- Public key is distributed through install snippets.

2. Local development
- If no configured key is provided, the API generates a local dev key pair under:
  - `apps/control-plane-api/.data/manifest-dev-private.pem`
  - `apps/control-plane-api/.data/manifest-dev-public.pem`
- Dev private key must not be committed.

3. Rotation runbook
- Generate new key pair.
- Deploy API with new private key.
- Refresh install snippets so embedded pages receive new public key.
- Keep old public key available until all clients refresh snippets.

## Incident Handling

1. If plugin artifact compromise is suspected:
- Set `killSwitch=true` in manifest generation logic for affected client.
- Revoke compromised plugin artifact versions.
- Publish clean pre/post versions with new integrities.

2. If signing key compromise is suspected:
- Rotate key immediately.
- Invalidate old manifests using short expiry and forced cache bypass.
- Issue updated snippets/public key metadata.

## Audit Events

Control plane records:

- `auth.register`
- `auth.login`
- `settings.update`
- `plugin.publish`

Recommended follow-up:
- Stream audit events to external immutable log storage.
