# Currency Conversion Extension + SaaS Backend

This repository now contains:

- Browser extension (WXT + React)
- Local SaaS backend (auth, entitlements, billing hooks, rates hardening, usage limits, admin ops)

## Project Layout

- `apps/extension/` -> extension app (assets, components, entrypoints, hooks, utils, tests)
- `backend/src/` -> backend API
- `packages/shared/` -> shared API contracts
- `docs/` -> roadmap + QA/security runbooks

## Commands

- `npm run dev` -> extension development
- `npm run build` -> extension build
- `npm run compile` -> TypeScript check
- `npm run backend:start` -> build + run backend
- `npm run test:unit` -> unit tests

## Backend Environment

Copy values from `backend/.env.example` into your environment before running backend in non-dev setups.

## Important Notes

- Stripe endpoints run in mock mode when Stripe env vars are absent.
- In this sandbox, opening a listening port is blocked, so backend runtime must be validated on your local machine.
