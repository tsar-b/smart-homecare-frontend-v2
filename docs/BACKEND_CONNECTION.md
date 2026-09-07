# SHC V2 backend connection

Verified on 2026-09-03 against backend commit
`fa86c2a134720656b679302aa2c472951bf4670f` from
`tsar-b/smart-homecare-backend-v2`.

## Frontend base URL

The frontend accepts either the server origin or the same origin with an exact
`/api` suffix. Internally, requests use canonical `/api/...` paths, so these two
values are equivalent:

```text
EXPO_PUBLIC_API_URL=http://127.0.0.1:5050
EXPO_PUBLIC_API_URL=http://127.0.0.1:5050/api
```

Use HTTPS outside local development. A physical phone cannot use the computer's
`127.0.0.1`; use a development-only LAN address or an HTTPS tunnel instead.
For Expo web, the backend allowlist includes the usual localhost and
`127.0.0.1` port 8081 origins in the supplied `.env.example`.

## Verified read-only checks

The exact Mac backend commit was built with Node 24. After the focused safety
patch, all 25 backend tests passed. It then connected to the configured
Supabase project and returned:

- `/health`: HTTP 200
- `/ready`: HTTP 200; Supabase Auth and database both ready
- `/openapi.json`: OpenAPI 3.1 with 34 paths after separating the deprecated
  singular booking route from the canonical server-priced route
- `/api/app/initialize`: HTTP 200
- `/api/catalog/initialize`: HTTP 200
- `/api/bookings/availability`: HTTP 200 with 33 configured slots

Catalog counts observed during the check:

| Collection | Rows |
| --- | ---: |
| Categories | 4 |
| Service types | 4 |
| Subtypes | 6 |
| Pricing tiers | 30 |
| Option groups | 20 |
| Assets | 138 |
| Time-slot groups | 1 |

All 30 real pricing-tier cases and one real choice from each of the 20 option
groups passed the backend quote engine read-only. No booking was inserted.

## Authentication state

The project currently contains three migrated SHC profiles but no linked
Supabase Auth users. This is expected to link lazily only after an existing
standard user proves the correct legacy password. Do not bulk-link identities
by email or phone without ownership proof.

The frontend stores the Supabase access and refresh token together, performs at
most one refresh/retry after a 401, and calls the backend logout endpoint before
clearing local credentials.

## Deliberately unavailable operations

These capabilities remain unavailable until the backend has the missing proof
or lifecycle workflow:

- guest registration, pending phone OTP verification;
- self-service account deletion, pending transactional erasure/anonymization
  and external-provider revocation.

Standard email registration may create an unconfirmed Supabase Auth identity,
but it must not link, mutate, or return an existing migrated SHC profile until
email ownership is confirmed.

## Booking contract

New frontend work uses the canonical booking API:

```text
POST  /api/bookings
GET   /api/bookings/history
GET   /api/bookings/availability?date=YYYY-MM-DD
GET   /api/bookings/:id
PATCH /api/bookings/:id/cancel
```

Creation sends the same UUID in `client_request_id` and `Idempotency-Key`.
Every selected option includes both `option_id` and its chosen `value`.
The canonical endpoint requires service, subtype, and pricing-tier IDs and does
not accept a client-authored authoritative total.

## What this verification does not prove

The destructive live smoke suite was not run against this project. It creates
and deletes Auth users, bookings, idempotency records, audit rows, and temporary
catalog data. Provider login still needs physical-device tests for Apple and
Kakao, and production still needs a hosted HTTPS API URL, migration/reconciliation
evidence, monitoring, and a rollback window.
