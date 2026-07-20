# Admin: list/search users — design

**Date:** 2026-07-18
**Repo:** `xkld-tools`
**Scope:** Add `GET /api/admin/users`, a paginated, searchable list of all users. This is
the one missing piece blocking the client's Phase 2b admin screens
(`xkld-tools-client`, `/admin/users` and the redemption user-picker) — every other admin
list endpoint (`orders`, `ledger`) already exists; this is the users equivalent.

## Why

`docs/API.md` §6.4 documents `POST /api/admin/users` (create a root user) and
`GET /api/admin/users/:id/balances` (balances for a *known* id), but there is no way to
browse or search the user table at all. The client's Admin "Người dùng" screen and the
Redemption screen's user picker both need this.

## Endpoint

`GET /api/admin/users` — auth: `SUPER_ADMIN` (mounted under the existing
`adminRoutes.use('*', requireSuperAdmin)` in `src/routes/admin.ts`, same as every other
`/api/admin/*` route).

**Query params**

| Param | Type | Notes |
| --- | --- | --- |
| `q` | string | Optional. Case-insensitive substring match against `full_name` **or** `phone`. |
| `page`, `limit` | pagination | Same `parsePage()` helper as every other list endpoint (default page 1, limit 20, clamped 1–100). |

**Response — `200`**

```json
{ "users": [ /* User, per docs/API.md §4 */ ], "page": 1, "limit": 20, "total": 3 }
```

`User` is the existing public shape (`toAuthUser()` in `src/lib/users.ts`) — no balances
inlined, matching the existing split where balances are a separate per-user call
(`GET /api/admin/users/:id/balances`). This also matches the client's decision not to
fetch balances in bulk on the list screen.

**Errors:** `401`/`403` per the shared admin-auth convention (not repeated per-route in
`docs/API.md`, same as every other `/api/admin/*` endpoint).

## Implementation

- `src/lib/users.ts`: add `listUsers(db, { q, page, limit })`, mirroring `listOrders()` /
  `listLedger()`'s `WHERE`-builder + `COUNT(*)` + `LIMIT/OFFSET` pattern exactly. The `q`
  filter becomes `WHERE (full_name LIKE ? OR phone LIKE ?)` with both bind params set to
  `%${q}%`; SQLite's default `LIKE` is case-insensitive **for ASCII only** — a search for
  `nguyễn` won't match `Nguyễn` (diacritics fall outside ASCII case-folding). Phone-number
  search is unaffected (digits are ASCII); this is an accepted limitation for name search,
  not a bug — full Unicode collation is out of scope here. Order: `created_at DESC, id
  DESC`, same tie-break as the other list queries.
- `src/routes/admin.ts`: add `adminRoutes.get('/users', ...)` following the same
  query-parsing shape as the existing `GET /orders` handler (`parsePage`, then map rows
  through `toAuthUser`).
- `docs/API.md`: add this endpoint under §6.4, alongside the existing
  `POST /api/admin/users` entry.

## Testing

TDD, following this repo's existing convention (`test/orders.test.ts` /
`test/redemptions.test.ts` patterns, `test/helpers.ts`'s `seedAdmin()` / `registerUser()`).
New cases in `test/admin-users.test.ts`:
- Returns all users (root admin + registered users) with the correct `total`.
- `q` matches a substring of `full_name`.
- `q` matches a substring of `phone`.
- `q` with no match returns `{ users: [], total: 0 }`.
- Pagination (`page`/`limit`) slices correctly, same shape as `orders`/`ledger` tests.
- `401` anonymous, `403` for a logged-in `USER`.

## Out of scope

- Any change to `POST /api/admin/users` or `GET /api/admin/users/:id/balances` — both
  stay exactly as they are.
- Filtering by `role` or `isActive` — not requested; add later if needed.
- Bulk balances in the list response — deliberately kept separate (see above).
