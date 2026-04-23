# B2B Delivery Phases (Index)

- Date: 2026-04-23
- Schema Revision: `b2b-phases-r2`
- Purpose: One-line goals and measurable acceptance gates for Phases 1-14

## Normative Language

The key words MUST, MUST NOT, REQUIRED, SHALL, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## Non-Goals

- This file is not a design spec replacement.
- This file is not a sprint plan with story points.

## Out Of Scope For This Phase

- Detailed task breakdown per team member.
- Project management tooling integration.

## Phase Goals And Gates

| Phase | Goal | Measurable Gate |
| --- | --- | --- |
| 1 | Establish tenant/auth domain model in control plane | Contract tests pass for `User`, `Client`, `Membership`, Clerk identity mappings (`clerkUserId`, `clerkSessionId`), and role checks on all `/api/v1/clients/:clientId/*` routes |
| 2 | Implement Clerk-based login/logout/oauth/session lifecycle | End-to-end auth tests pass for Clerk session token exchange, Clerk OAuth callback, session rotation, and CSRF rejection paths |
| 3 | Implement settings read/write with optimistic versioning | `GET/PUT /clients/:clientId/settings` pass validation tests and produce monotonic `settingsVersion` |
| 4 | Implement plugin artifact publish/list immutability | Publish endpoint rejects duplicate `stage+version`; list endpoint returns immutable digest/url pairs |
| 5 | Implement manifest issue service and signing integration | `POST /manifests/issue` returns signed envelope; signature verification test vector suite passes 100% |
| 6 | Integrate runtime loader manifest bootstrap path | Runtime loads manifest only when signature/time/policy checks pass in controlled integration tests |
| 7 | Enforce allow-origin/path and fail-closed behavior | Negative tests prove no DOM mutation for disallowed origin/path, invalid manifest, or hash mismatch |
| 8 | Settings propagation on reload | Updating settings + issuing manifest changes runtime styling after page reload in E2E test |
| 9 | Apply privacy and logging controls | Log snapshots match allowlist and redact forbidden fields; runtime sends no query params/page text |
| 10 | Enforce rate limits and abuse controls | Load tests show endpoint-specific rate limits trigger expected error codes without tenant leakage |
| 11 | Security hardening and threat-path validation | Threat-model-derived attack tests (replay, key confusion, CSRF, tenant escalation) all pass |
| 12 | Staging validation and NFR certification | Staging runbook completes with p95 latency and error-budget targets met for 7 consecutive days |
| 13 | Production readiness and key-rotation drill | Key rotation drill succeeds with zero unsigned manifest acceptance and no runtime bypass |
| 14 | Launch gate and post-launch operational guardrails | Go-live checklist signed off; incident kill-switch drill and rollback procedure complete within SLA |

## Ownership Defaults

- Phases 1-5: Platform API Team + Security Platform Team
- Phases 6-8: Runtime Team + Web App Team
- Phases 9-14: Cross-functional (Platform, Security, SRE, Runtime)
