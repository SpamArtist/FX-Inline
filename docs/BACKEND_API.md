# Backend API Overview

Base URL (default local): `http://127.0.0.1:8787`

Current extension builds fetch FX rates client-side and do not require these backend APIs for conversion.

## Auth

- `POST /auth/signup` `{ email, password }`
- `POST /auth/signin` `{ email, password }`
- `POST /auth/refresh` `{ refreshToken }`
- `POST /auth/logout` `{ refreshToken }`
- `GET /auth/me` (Bearer)

## Entitlements

- `GET /entitlements/me` (Bearer)

## Rates

- `GET /rates/latest`
- Query: `force=1` optional refresh hint

## Usage

- `POST /usage/events` (Bearer)
- Body: `{ inlineConversions, selectionConversions }`

## Billing

- `POST /billing/checkout-session` (Bearer)
- `POST /billing/customer-portal` (Bearer)
- `POST /billing/webhook` (Stripe signature)

## Admin

- `GET /admin`
- `GET /admin/stats`
- `GET /admin/alerts`
- Optional header: `X-Admin-Key`

## Local run

```bash
npm run backend:start
```
