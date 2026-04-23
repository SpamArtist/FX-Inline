# B2B Control-Plane API Contract (Phase 0 Freeze)

- Date: 2026-04-23
- Schema Revision: `b2b-api-r2`
- Base Path: `/api/v1`

## Normative Language

The key words MUST, MUST NOT, REQUIRED, SHALL, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## Objective

This document defines the versioned HTTP contract for all B2B dashboard and runtime-facing workflows.

## Non-Goals

- No persistence model details (table/index design).
- No implementation language/framework constraints.
- No internal service RPC contract definitions.

## Out Of Scope For This Phase

- Backend endpoint implementation.
- Clerk dashboard/provider connection configuration code.
- Session store implementation details.
- Generated SDK/client library code.

## Versioning Strategy

- All externally supported endpoints MUST live under `/api/v1/...`.
- Breaking changes MUST ship under a new major path (for example `/api/v2/...`).
- Backward-compatible additive fields MAY be added within `v1`.
- Field removals, type changes, or semantic inversions MUST NOT occur within `v1`.
- Responses SHOULD include header `X-Contract-Revision: b2b-api-r1`.

## Global Conventions

- `Content-Type` for request/response bodies MUST be `application/json; charset=utf-8` unless otherwise noted.
- Every response MUST include `requestId`.
- Successful responses use:
  - `{ "requestId": "...", "data": ... }`
- Error responses use the global error envelope below.

## Global Error Envelope

All non-2xx responses MUST be:

```json
{
  "code": "AUTH_CLERK_TOKEN_INVALID",
  "message": "Clerk session token is invalid or expired.",
  "requestId": "req_01HT9EJQY9M6",
  "details": {
    "field": "clerkSessionToken"
  }
}
```

Field requirements:

- `code` (string, REQUIRED): Stable machine-readable error code.
- `message` (string, REQUIRED): User-safe summary.
- `requestId` (string, REQUIRED): Request trace identifier.
- `details` (object, REQUIRED but MAY be `{}`): Additional structured context.

## Auth And Session Contract

## Auth Provider Freeze (Clerk)

- Clerk MUST be the sole identity provider for authentication in `v1`.
- Password-based local authentication MUST NOT be implemented.
- `POST /api/v1/auth/login` MUST exchange a Clerk-issued session token for an API session.
- OAuth start/callback endpoints under `/api/v1/auth/oauth/:provider/*` MUST proxy Clerk-managed provider flows only.

## Session Cookie

- Name: `fxi_session`
- Type: opaque signed control-plane session ID derived from verified Clerk session
- Scope: `Path=/`
- Flags:
  - MUST be `HttpOnly`
  - MUST be `Secure` in staging/prod
  - MUST be `SameSite=Lax`
- TTL:
  - Idle timeout: 8 hours
  - Absolute timeout: 24 hours
- Session binding:
  - MUST store `clerkUserId` and `clerkSessionId` references server-side.
  - MUST reject session creation when Clerk token/session verification fails.
- Rotation:
  - MUST rotate on successful Clerk session exchange.
  - MUST rotate on successful Clerk OAuth callback.

## CSRF Contract

- Mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) MUST include `X-CSRF-Token`.
- CSRF token MUST be cryptographically random and bound to session.
- CSRF token MUST be returned by:
  - `POST /api/v1/auth/login`
  - `GET /api/v1/users/me`
- Missing/invalid CSRF on mutating endpoints MUST return `403` with `code=AUTH_CSRF_INVALID`.

## Clerk OAuth State Contract

- `start` endpoint MUST mint a one-time state token valid for 10 minutes.
- `callback` endpoint MUST reject missing, mismatched, or expired state.
- State replay MUST return `400` with `code=AUTH_CLERK_OAUTH_STATE_INVALID`.

## Canonical Entities (API Shapes)

```json
{
  "User": {
    "userId": "usr_123",
    "identityProvider": "clerk",
    "identitySubject": "user_2abcXYZ",
    "email": "owner@example.com",
    "displayName": "Owner Name",
    "status": "active"
  },
  "Membership": {
    "clientId": "client_acme",
    "userId": "usr_123",
    "role": "owner",
    "status": "active"
  },
  "ClientSettings": {
    "clientId": "client_acme",
    "settingsVersion": 12,
    "preferredCurrency": "EUR",
    "allowedOrigins": ["https://acme.example"],
    "allowedPathRegex": ["^/pricing(/.*)?$"],
    "uiDefaults": {
      "badgeStyle": "compact",
      "accentColor": "#1f6feb"
    },
    "flags": {
      "killSwitch": false
    },
    "updatedAt": "2026-04-23T10:00:00Z",
    "updatedBy": "usr_123"
  },
  "PluginArtifact": {
    "artifactId": "plg_01",
    "clientId": "client_acme",
    "stage": "pre",
    "version": "1.2.0",
    "url": "https://cdn.fxi.example/artifacts/client_acme/pre/1.2.0/index.js",
    "integrity": "sha256-abc123...",
    "createdAt": "2026-04-23T10:01:00Z",
    "createdBy": "usr_123"
  }
}
```

## Endpoint Contracts

## 1) Auth: Clerk Session Exchange

- Method/Path: `POST /api/v1/auth/login`
- Auth: Public
- Rate Limit: 10 requests/minute/IP, 30 requests/hour/account

Request:

```json
{
  "clerkSessionToken": "sess_tok_abc123",
  "clerkUserId": "user_2abcXYZ"
}
```

Success `200`:

```json
{
  "requestId": "req_01",
  "data": {
    "user": {
      "userId": "usr_123",
      "identityProvider": "clerk",
      "identitySubject": "user_2abcXYZ",
      "email": "owner@example.com",
      "displayName": "Owner Name",
      "status": "active"
    },
    "csrfToken": "csrf_opaque_01"
  }
}
```

## 2) Auth: Logout

- Method/Path: `POST /api/v1/auth/logout`
- Auth: Session required
- Rate Limit: 60 requests/minute/session

Request:

```json
{}
```

Success `200`:

```json
{
  "requestId": "req_02",
  "data": {
    "loggedOut": true
  }
}
```

## 3) Clerk OAuth Start

- Method/Path: `GET /api/v1/auth/oauth/:provider/start`
- Auth: Public
- Rate Limit: 20 requests/minute/IP

Success `200`:

```json
{
  "requestId": "req_03",
  "data": {
    "authorizationUrl": "https://clerk.fxi.example/v1/oauth/authorize?...",
    "state": "clerk_oauth_state_opaque_01",
    "expiresAt": "2026-04-23T10:15:00Z"
  }
}
```

## 4) Clerk OAuth Callback

- Method/Path: `GET /api/v1/auth/oauth/:provider/callback`
- Auth: Public
- Rate Limit: 20 requests/minute/IP
- Query: `code` and `state` REQUIRED

Success `200`:

```json
{
  "requestId": "req_04",
  "data": {
    "user": {
      "userId": "usr_123",
      "identityProvider": "clerk",
      "identitySubject": "user_2abcXYZ",
      "email": "owner@example.com",
      "displayName": "Owner Name",
      "status": "active"
    },
    "csrfToken": "csrf_opaque_02"
  }
}
```

## 5) Current User

- Method/Path: `GET /api/v1/users/me`
- Auth: Session required
- Rate Limit: 240 requests/minute/session

Success `200`:

```json
{
  "requestId": "req_05",
  "data": {
    "user": {
      "userId": "usr_123",
      "identityProvider": "clerk",
      "identitySubject": "user_2abcXYZ",
      "email": "owner@example.com",
      "displayName": "Owner Name",
      "status": "active"
    },
    "memberships": [
      {
        "clientId": "client_acme",
        "userId": "usr_123",
        "role": "owner",
        "status": "active"
      }
    ],
    "csrfToken": "csrf_opaque_02"
  }
}
```

## 6) Client Membership

- Method/Path: `GET /api/v1/clients/:clientId/membership`
- Auth: Session required
- Rate Limit: 120 requests/minute/session

Success `200`:

```json
{
  "requestId": "req_06",
  "data": {
    "clientId": "client_acme",
    "userId": "usr_123",
    "role": "owner",
    "status": "active"
  }
}
```

## 7) Settings Read

- Method/Path: `GET /api/v1/clients/:clientId/settings`
- Auth: Session + membership required
- Rate Limit: 120 requests/minute/user/client

Success `200`:

```json
{
  "requestId": "req_07",
  "data": {
    "clientId": "client_acme",
    "settingsVersion": 12,
    "preferredCurrency": "EUR",
    "allowedOrigins": ["https://acme.example"],
    "allowedPathRegex": ["^/pricing(/.*)?$"],
    "uiDefaults": {
      "badgeStyle": "compact",
      "accentColor": "#1f6feb"
    },
    "flags": {
      "killSwitch": false
    },
    "updatedAt": "2026-04-23T10:00:00Z",
    "updatedBy": "usr_123"
  }
}
```

## 8) Settings Write

- Method/Path: `PUT /api/v1/clients/:clientId/settings`
- Auth: Session + membership + CSRF required
- Rate Limit: 60 requests/minute/user/client

Request:

```json
{
  "preferredCurrency": "USD",
  "allowedOrigins": ["https://acme.example", "https://www.acme.example"],
  "allowedPathRegex": ["^/pricing(/.*)?$"],
  "uiDefaults": {
    "badgeStyle": "compact",
    "accentColor": "#e05d44"
  },
  "flags": {
    "killSwitch": false
  }
}
```

Success `200`:

```json
{
  "requestId": "req_08",
  "data": {
    "clientId": "client_acme",
    "settingsVersion": 13,
    "updatedAt": "2026-04-23T10:20:00Z"
  }
}
```

## 9) Plugin Version List

- Method/Path: `GET /api/v1/clients/:clientId/plugins`
- Auth: Session + membership required
- Rate Limit: 120 requests/minute/user/client

Success `200`:

```json
{
  "requestId": "req_09",
  "data": {
    "clientId": "client_acme",
    "pre": [
      {
        "artifactId": "plg_pre_01",
        "version": "1.2.0",
        "url": "https://cdn.fxi.example/artifacts/client_acme/pre/1.2.0/index.js",
        "integrity": "sha256-prehash...",
        "createdAt": "2026-04-23T10:01:00Z",
        "createdBy": "usr_123"
      }
    ],
    "post": [
      {
        "artifactId": "plg_post_01",
        "version": "2.0.1",
        "url": "https://cdn.fxi.example/artifacts/client_acme/post/2.0.1/index.js",
        "integrity": "sha256-posthash...",
        "createdAt": "2026-04-23T10:02:00Z",
        "createdBy": "usr_123"
      }
    ]
  }
}
```

## 10) Plugin Version Publish

- Method/Path: `POST /api/v1/clients/:clientId/plugins/publish`
- Auth: Session + membership + CSRF required
- Rate Limit: 20 requests/minute/user/client

Request:

```json
{
  "stage": "pre",
  "version": "1.3.0",
  "url": "https://cdn.fxi.example/artifacts/client_acme/pre/1.3.0/index.js",
  "integrity": "sha256-publishedhash..."
}
```

Success `201`:

```json
{
  "requestId": "req_10",
  "data": {
    "artifactId": "plg_pre_02",
    "clientId": "client_acme",
    "stage": "pre",
    "version": "1.3.0",
    "url": "https://cdn.fxi.example/artifacts/client_acme/pre/1.3.0/index.js",
    "integrity": "sha256-publishedhash...",
    "createdAt": "2026-04-23T10:30:00Z",
    "createdBy": "usr_123"
  }
}
```

## 11) Manifest Fetch (Runtime)

- Method/Path: `GET /api/v1/public/manifests/:clientId`
- Auth: Public runtime endpoint
- Rate Limit: 600 requests/minute/IP/clientId
- Required request headers:
  - `X-FXI-Page-Origin`: current page origin only
  - `X-FXI-Page-Path`: current page path only (no query string)

Success `200`:

```json
{
  "requestId": "req_11",
  "data": {
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
            "integrity": "sha256-publishedhash..."
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
}
```

## 12) Manifest Issue

- Method/Path: `POST /api/v1/clients/:clientId/manifests/issue`
- Auth: Session + membership + CSRF required
- Rate Limit: 30 requests/minute/user/client

Request:

```json
{
  "reason": "settings-update",
  "ttlSeconds": 600
}
```

Success `201`:

```json
{
  "requestId": "req_12",
  "data": {
    "manifestId": "mf_001",
    "clientId": "client_acme",
    "issuedAt": "2026-04-23T10:31:00Z",
    "expiresAt": "2026-04-23T10:41:00Z",
    "schemaVersion": "1.0.0",
    "kid": "k_2026_04_prod"
  }
}
```

## 13) Install Snippet Generation

- Method/Path: `GET /api/v1/clients/:clientId/install-snippet`
- Auth: Session + membership required
- Rate Limit: 120 requests/minute/user/client

Success `200`:

```json
{
  "requestId": "req_13",
  "data": {
    "clientId": "client_acme",
    "loaderVersion": "v1",
    "manifestUrl": "https://api.fxi.example/api/v1/public/manifests/client_acme",
    "snippet": "<script type=\"module\" src=\"https://cdn.fxi.example/loader.v1.js\" data-fxi-client-id=\"client_acme\" data-fxi-manifest-url=\"https://api.fxi.example/api/v1/public/manifests/client_acme\" defer></script>"
  }
}
```

## Authorization Matrix

Legend: `ALLOW`, `DENY`, `PUBLIC`

| Endpoint | owner | editor | viewer | unauthenticated |
| --- | --- | --- | --- | --- |
| `POST /api/v1/auth/login` | PUBLIC | PUBLIC | PUBLIC | PUBLIC |
| `POST /api/v1/auth/logout` | ALLOW | ALLOW | ALLOW | DENY |
| `GET /api/v1/auth/oauth/:provider/start` | PUBLIC | PUBLIC | PUBLIC | PUBLIC |
| `GET /api/v1/auth/oauth/:provider/callback` | PUBLIC | PUBLIC | PUBLIC | PUBLIC |
| `GET /api/v1/users/me` | ALLOW | ALLOW | ALLOW | DENY |
| `GET /api/v1/clients/:clientId/membership` | ALLOW | ALLOW | ALLOW | DENY |
| `GET /api/v1/clients/:clientId/settings` | ALLOW | ALLOW | ALLOW | DENY |
| `PUT /api/v1/clients/:clientId/settings` | ALLOW | ALLOW | DENY | DENY |
| `GET /api/v1/clients/:clientId/plugins` | ALLOW | ALLOW | ALLOW | DENY |
| `POST /api/v1/clients/:clientId/plugins/publish` | ALLOW | ALLOW | DENY | DENY |
| `POST /api/v1/clients/:clientId/manifests/issue` | ALLOW | ALLOW | DENY | DENY |
| `GET /api/v1/clients/:clientId/install-snippet` | ALLOW | ALLOW | ALLOW | DENY |
| `GET /api/v1/public/manifests/:clientId` | PUBLIC | PUBLIC | PUBLIC | PUBLIC |

Authorization rules:

- `viewer` MUST have read-only access.
- Cross-client access MUST return `404` (`CLIENT_NOT_FOUND`) instead of leaking tenant existence.
- Authorization MUST evaluate membership against path `:clientId` before handler logic.

## Sensitive Endpoint Rate-Limit Expectations

| Endpoint | Limit | Key |
| --- | --- | --- |
| `POST /api/v1/auth/login` | 10/min + 30/hour | IP + clerkUserId |
| `GET /api/v1/auth/oauth/:provider/start` | 20/min | IP |
| `GET /api/v1/auth/oauth/:provider/callback` | 20/min | IP |
| `PUT /api/v1/clients/:clientId/settings` | 60/min | userId + clientId |
| `POST /api/v1/clients/:clientId/plugins/publish` | 20/min | userId + clientId |
| `POST /api/v1/clients/:clientId/manifests/issue` | 30/min | userId + clientId |
| `GET /api/v1/public/manifests/:clientId` | 600/min | IP + clientId |

## Traceability Anchors

- Settings propagation-on-reload is implemented contractually by:
  - `PUT /api/v1/clients/:clientId/settings`
  - `POST /api/v1/clients/:clientId/manifests/issue`
  - `GET /api/v1/public/manifests/:clientId`
- Tenant isolation is enforced by `:clientId`-scoped membership checks on all non-public client endpoints.
