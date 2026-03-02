# Backend API

Local backend for authentication, entitlements, billing, rates hardening, usage limits, and admin operations.

## Run

```bash
npm run backend:start
```

The server starts on `http://127.0.0.1:8787` by default.

## Key Endpoints

- `POST /auth/signup`
- `POST /auth/signin`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /entitlements/me`
- `GET /rates/latest`
- `POST /usage/events`
- `POST /billing/checkout-session`
- `POST /billing/customer-portal`
- `POST /billing/webhook`
- `GET /admin`, `GET /admin/stats`, `GET /admin/alerts`

## Notes

- Stripe endpoints run in mock mode when Stripe env vars are not configured.
- Data persists to `backend/data/db.json`.
- Admin endpoints can be locked using `ADMIN_API_KEY`.
