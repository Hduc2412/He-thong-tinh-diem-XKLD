# XKLD Tools — API Reference (Frontend Handoff)

REST API for the points/rewards system. Backend is Hono on Cloudflare Workers with a
D1 database. This document is the single source of truth for building the frontend
against the API: every endpoint, its request/response schema, and concrete examples.

- **Base URL:** all endpoints live under `/api` (e.g. `https://<host>/api/auth/login`).
- **Content type:** requests and responses are JSON (`Content-Type: application/json`).
- **Health check:** `GET /` → `200 {"ok":true,"service":"xkld-tools"}`.

Routers:

| Prefix | Purpose | Auth |
| --- | --- | --- |
| `/api/auth` | Register, login, logout, current user | Public (except `/me`) |
| `/api/orders` | Create & view your own orders | Logged-in `USER` |
| `/api/points` | Your wallet balances & ledger history | Logged-in user |
| `/api/admin` | User seeding, order decisions, redemptions, ledger | `SUPER_ADMIN` only |

---

## 1. Authentication

**Auth is a bearer token, not a cookie.** `POST /api/auth/login` and `POST
/api/auth/register` return `{ "user": {...}, "token": "<jwt>" }` in the JSON body. Send
that token back on every subsequent request as:

```
Authorization: Bearer <token>
```

- The token is a signed JWT (`HS256`), payload `{ sub, exp }` only — no role or name.
  The server reloads the user from the database on **every request**, so role and
  active-status changes take effect immediately.
- **No refresh token, TTL = 1 day.** After a day the token expires and the user must
  log in again. There is no server-side revocation — `POST /api/auth/logout` is a
  stateless no-op the client calls purely to discard its own copy of the token; a
  token that leaked before logout stays valid until it naturally expires.
- A missing/expired/invalid token is treated as **anonymous** (the request is not
  rejected at the auth-header layer); individual endpoints then enforce their own auth.
- CORS is wide open (`origin: '*'`) for now — there's no cookie in play, so this
  carries none of the CSRF/credentialed-CORS risk a cookie-based origin policy would.

### What the frontend must do

Store the token yourself after login/register (e.g. `localStorage`) and attach it to
every request:

```js
// API_URL is this backend's real deployed URL — the frontend calls it directly,
// there's no same-origin proxy to route through (see docs/auth-design.md Step 4).
const res = await fetch(`${API_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ phone, password }),
})
const { user, token } = await res.json()
localStorage.setItem('token', token)

// later requests
await fetch(`${API_URL}/api/points/balances`, {
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
})
```

`credentials: 'include'` is not needed — nothing here rides on cookies. "Am I logged
in?" is answered by calling `GET /api/auth/me` with the token attached.

### Auth failures

| Status | Body | Meaning |
| --- | --- | --- |
| `401` | `{"error":"unauthorized"}` | Endpoint needs a logged-in user; none present. |
| `403` | `{"error":"forbidden"}` | Logged in, but not a `SUPER_ADMIN` (admin routes). |

---

## 2. Conventions

### Error shapes

There are **two** distinct error formats:

1. **Handler errors** — everything the route logic returns:
   ```json
   { "error": "human-readable message" }
   ```
   Some also include a stable machine-readable `code` (and occasionally extra fields):
   ```json
   { "error": "order already decided", "code": "ALREADY_DECIDED", "status": "APPROVED" }
   ```
   Branch on `code` when present; treat `error` as display text.

2. **Body validation errors** — when a request body fails its schema (bad type,
   missing required field, unknown key, value out of range). Produced by
   `@hono/arktype-validator` and always returned as **HTTP 400**:
   ```json
   {
     "success": false,
     "errors": [
       { "message": "password must be at least length 8 (was 4)", "path": ["password"] }
     ]
   }
   ```
   The `errors` array is arktype's problem list. Do **not** expect the `{ "error": ... }`
   shape here — validation failures use `{ "success": false, "errors": [...] }`.

### Pagination

List endpoints accept two query params and return a **flat envelope** (no nested
`meta`):

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | integer ≥ 1 | `1` | |
| `limit` | integer | `20` | Clamped to `1`–`100`. |

Out-of-range or non-integer values are silently clamped/defaulted — they never error.

Response envelope (the data array key varies by endpoint):

```json
{ "orders": [ /* ... */ ], "page": 1, "limit": 20, "total": 137 }
```

`total` is the full count of matching rows (ignoring pagination), for building page
controls. Lists are ordered newest-first (`createdAt DESC`).

### Phone numbers

Phone is the login identity. It is normalized server-side: a leading `+84` becomes `0`,
then it must match `^0\d{9}$` — a Vietnamese mobile number, **10 digits total**
(e.g. `0912345678`). The normalized `0…` form is what gets stored and returned.

---

## 3. Enums

| Enum | Values |
| --- | --- |
| `Role` | `SUPER_ADMIN`, `USER` |
| `OrderStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `Wallet` | `F`, `G` |
| `LedgerType` | `REGISTRATION_BONUS`, `REFERRAL_SIGNUP_BONUS`, `MAINTENANCE_ACCRUAL`, `MAINTENANCE_RESET`, `CUSTOMER_REWARD`, `CUSTOMER_REFERRAL_BONUS`, `REDEMPTION` |

---

## 4. Entity shapes

All response bodies use these camelCase shapes. Field order below matches the API output.

### User

Returned by register, login, `/me`, `PATCH /me`, and admin user creation. The password
hash is **never** included.

```json
{
  "id": "b3f1c8e2-...",
  "fullName": "Nguyễn Văn A",
  "phone": "0912345678",
  "role": "USER",
  "referrerId": "a1d2...",
  "referralCode": "0912345678",
  "isActive": true,
  "createdAt": "2026-07-10T02:15:30.000Z"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string (UUID) | |
| `fullName` | string | |
| `phone` | string | Normalized `0…` form. |
| `role` | `Role` | |
| `referrerId` | string \| null | `null` for admin/root users. |
| `referralCode` | string | Defaults to the user's phone. |
| `isActive` | boolean | Deactivated users can't log in. |
| `createdAt` | string | ISO 8601. |
| `lastLoginAt` | string \| null | Lần đăng nhập thành công gần nhất. |
| `lastSeenAt` | string \| null | Lần cuối tài khoản gọi API với phiên hợp lệ. |
| `loginCount` | number | Tổng số lần đăng nhập thành công. |

### Order

```json
{
  "id": "0c9a...",
  "userId": "b3f1...",
  "note": "Order for client X",
  "status": "PENDING",
  "decidedBy": null,
  "decidedAt": null,
  "createdAt": "2026-07-10T02:20:00.000Z"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string (UUID) | |
| `userId` | string | The creator (= beneficiary). |
| `note` | string \| null | Optional, ≤ 500 chars. |
| `status` | `OrderStatus` | `PENDING` on creation. |
| `decidedBy` | string \| null | Admin who approved/rejected; `null` while pending. |
| `decidedAt` | string \| null | ISO 8601; `null` while pending. |
| `createdAt` | string | ISO 8601. |

### LedgerEntry (user-facing)

Returned by `GET /api/points/ledger`.

```json
{
  "id": "9f2b...",
  "userId": "b3f1...",
  "wallet": "F",
  "type": "CUSTOMER_REWARD",
  "points": 50,
  "orderId": "0c9a...",
  "periodIndex": null,
  "note": null,
  "createdBy": null,
  "createdAt": "2026-07-10T03:00:00.000Z"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string (UUID) | |
| `userId` | string | Wallet owner / beneficiary. |
| `wallet` | `Wallet` | |
| `type` | `LedgerType` | |
| `points` | number | Signed: credits positive, debits (`REDEMPTION`, `MAINTENANCE_RESET`) negative. |
| `orderId` | string \| null | Set for `CUSTOMER_REWARD` / `CUSTOMER_REFERRAL_BONUS`. |
| `periodIndex` | number \| null | Set for `MAINTENANCE_*`. |
| `note` | string \| null | |
| `createdBy` | string \| null | Admin id for `REDEMPTION`; `null` = system-generated. |
| `createdAt` | string | ISO 8601. |

### AdminLedgerEntry

Returned by the admin ledger/redemption endpoints. Same as `LedgerEntry` **plus**:

| Field | Type | Notes |
| --- | --- | --- |
| `subjectUserId` | string \| null | The registrant, for `REGISTRATION_BONUS` / `REFERRAL_SIGNUP_BONUS`. |
| `idempotencyKey` | string \| null | For `REDEMPTION` rows. |

---

## 5. Domain rules (for UI expectations)

Point amounts are fixed (not configurable):

| Event | Points | Wallet | To whom |
| --- | --- | --- | --- |
| Registration | +10 | F | The new user |
| Referral signup | +2 | F | The direct referrer |
| Maintenance accrual | +10 / month | G | The user |
| Customer reward (order approved) | +50 | F | Order creator |
| Customer referral bonus (order approved) | +10 | F | Creator's direct referrer |

Other rules:

- **Pending order limit:** a user may have at most **5** `PENDING` orders at once.
- **Redemption is locked** until a user has earned at least one `CUSTOMER_REWARD`
  (i.e. had an order approved). Once unlocked it stays unlocked. Expose this via the
  `redemptionUnlocked` flag on the balances endpoints.
- **Maintenance windowing:** 3-month warm-up, then a rolling 3-month activity check
  (backend cron; no direct API surface).

---

## 6. Endpoints

### 6.1 `/api/auth`

---

#### `POST /api/auth/register`

Create a `USER`. **A referral code is mandatory** — from the body, or from a `?ref=`
query param on an invite link. On success, returns a bearer token along with the user
(see §1) — the caller stores it and attaches it to subsequent requests.

**Auth:** public.

**Query params:** `ref` (optional) — referral code fallback if `referralCode` is not in the body.

**Request body**

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `fullName` | string | yes | Non-empty after trim. |
| `phone` | string | yes | VN mobile, normalized to `0XXXXXXXXX`. |
| `password` | string | yes | Min length 8. |
| `referralCode` | string | no | Min length 1. Falls back to `?ref=`. |

```json
{
  "fullName": "Nguyễn Văn A",
  "phone": "0912345678",
  "password": "s3cretpw",
  "referralCode": "0900000000"
}
```

**Success — `201`**

```json
{ "user": { "id": "b3f1...", "fullName": "Nguyễn Văn A", "phone": "0912345678", "role": "USER", "referrerId": "a1d2...", "referralCode": "0912345678", "isActive": true, "createdAt": "2026-07-10T02:15:30.000Z" }, "token": "eyJhbGciOiJIUzI1NiIs..." }
```

**Errors**

| Status | Body | When |
| --- | --- | --- |
| `400` | `{"error":"a referral code is required"}` | No code in body or `?ref=`. |
| `400` | `{"error":"unknown referral code"}` | Code doesn't match any user. |
| `409` | `{"error":"phone already registered"}` | Phone in use. |
| `400` | `{"success":false,"errors":[...]}` | Body failed validation. |

---

#### `POST /api/auth/login`

**Auth:** public.

**Request body**

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `phone` | string | yes | VN mobile. |
| `password` | string | yes | Min length 1. |

```json
{ "phone": "0912345678", "password": "s3cretpw" }
```

**Success — `200`**

```json
{ "user": { "id": "b3f1...", "fullName": "Nguyễn Văn A", "phone": "0912345678", "role": "USER", "referrerId": "a1d2...", "referralCode": "0912345678", "isActive": true, "createdAt": "2026-07-10T02:15:30.000Z" }, "token": "eyJhbGciOiJIUzI1NiIs..." }
```

**Errors**

| Status | Body | When |
| --- | --- | --- |
| `401` | `{"error":"invalid phone or password"}` | Unknown phone, wrong password, **or** deactivated account (deliberately indistinguishable). |
| `400` | `{"success":false,"errors":[...]}` | Body failed validation. |

---

#### `POST /api/auth/logout`

**Auth:** public. Stateless no-op (see §1) — nothing to clear server-side; the caller discards its own stored token. No body.

**Success — `200`**

```json
{ "ok": true }
```

---

#### `GET /api/auth/me`

Return the currently logged-in user. Use this to bootstrap session state on app load.

**Auth:** logged-in.

**Success — `200`**

```json
{ "user": { "id": "b3f1...", "fullName": "Nguyễn Văn A", "phone": "0912345678", "role": "USER", "referrerId": "a1d2...", "referralCode": "0912345678", "isActive": true, "createdAt": "2026-07-10T02:15:30.000Z" } }
```

**Errors:** `401 {"error":"unauthorized"}`.

---

#### `PATCH /api/auth/me`

Update your own profile. Only `fullName` is editable in this phase.

**Auth:** logged-in.

**Request body**

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `fullName` | string | yes | Non-empty after trim. |

```json
{ "fullName": "Nguyễn Văn B" }
```

**Success — `200`** — the updated `{ "user": ... }`.

**Errors:** `401 {"error":"unauthorized"}`; `400 {"success":false,"errors":[...]}`.

---

### 6.2 `/api/orders`

All order routes require a logged-in user.

---

#### `POST /api/orders`

Create an order (starts as `PENDING`). The `userId` is taken from the session — you
cannot create an order for someone else.

**Auth:** logged-in **`USER`**. A `SUPER_ADMIN` is forbidden (admins don't create orders).

**Request body** — only `note` is accepted; **any other key hard-fails with 400**.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `note` | string | no | ≤ 500 chars. Body may be `{}`. |

```json
{ "note": "Order for client X" }
```

**Success — `201`**

```json
{ "order": { "id": "0c9a...", "userId": "b3f1...", "note": "Order for client X", "status": "PENDING", "decidedBy": null, "decidedAt": null, "createdAt": "2026-07-10T02:20:00.000Z" } }
```

**Errors**

| Status | Body | When |
| --- | --- | --- |
| `403` | `{"error":"admins cannot create orders"}` | Caller is `SUPER_ADMIN`. |
| `409` | `{"error":"too many pending orders","code":"PENDING_LIMIT"}` | Already at 5 pending orders. |
| `400` | `{"success":false,"errors":[...]}` | Bad body / unknown key / note > 500. |
| `401` | `{"error":"unauthorized"}` | Not logged in. |

---

#### `GET /api/orders`

List **your own** orders, newest first.

**Auth:** logged-in.

**Query params**

| Param | Type | Notes |
| --- | --- | --- |
| `status` | `OrderStatus` | Optional filter. Invalid value → 400. |
| `page`, `limit` | pagination | See §2. |

**Success — `200`**

```json
{
  "orders": [
    { "id": "0c9a...", "userId": "b3f1...", "note": "Order for client X", "status": "APPROVED", "decidedBy": "a1d2...", "decidedAt": "2026-07-10T05:00:00.000Z", "createdAt": "2026-07-10T02:20:00.000Z" }
  ],
  "page": 1,
  "limit": 20,
  "total": 1
}
```

**Errors:** `400 {"error":"invalid status"}`; `401 {"error":"unauthorized"}`.

---

#### `GET /api/orders/:id`

Fetch one of **your own** orders.

**Auth:** logged-in.

**Success — `200`** — `{ "order": ... }`.

**Errors**

| Status | Body | When |
| --- | --- | --- |
| `404` | `{"error":"not found"}` | No such order **or** it belongs to another user (no existence leak). |
| `401` | `{"error":"unauthorized"}` | Not logged in. |

---

### 6.3 `/api/points`

All points routes require a logged-in user and are self-scoped to that user.

---

#### `GET /api/points/balances`

Current wallet balances plus the redemption-unlock flag. No params.

**Auth:** logged-in.

**Success — `200`**

```json
{ "f": 110, "g": 30, "redemptionUnlocked": true }
```

| Field | Type | Notes |
| --- | --- | --- |
| `f` | number | F-wallet balance (0 if none). |
| `g` | number | G-wallet balance (0 if none). |
| `redemptionUnlocked` | boolean | `true` once the user has ever earned a `CUSTOMER_REWARD`. |

**Errors:** `401 {"error":"unauthorized"}`.

---

#### `GET /api/points/ledger`

Paginated ledger history for the logged-in user, newest first.

**Auth:** logged-in.

**Query params**

| Param | Type | Notes |
| --- | --- | --- |
| `wallet` | `F` \| `G` | Optional. Invalid → 400. |
| `type` | `LedgerType` | Optional. Invalid → 400. |
| `from` | ISO datetime | Optional, **inclusive** lower bound on `createdAt`. |
| `to` | ISO datetime | Optional, **exclusive** upper bound on `createdAt`. |
| `page`, `limit` | pagination | See §2. |

**Success — `200`** — `entries` are user-facing `LedgerEntry` objects (no `subjectUserId` / `idempotencyKey`).

```json
{
  "entries": [
    { "id": "9f2b...", "userId": "b3f1...", "wallet": "F", "type": "CUSTOMER_REWARD", "points": 50, "orderId": "0c9a...", "periodIndex": null, "note": null, "createdBy": null, "createdAt": "2026-07-10T05:00:00.000Z" }
  ],
  "page": 1,
  "limit": 20,
  "total": 1
}
```

**Errors:** `400 {"error":"invalid wallet"}`; `400 {"error":"invalid type"}`; `401 {"error":"unauthorized"}`.

---

### 6.4 `/api/admin`

**Every** admin route requires `SUPER_ADMIN`. All can return
`401 {"error":"unauthorized"}` (anonymous) or `403 {"error":"forbidden"}` (logged-in
non-admin); these are omitted from the per-endpoint error tables below.

---

#### `POST /api/admin/users`

Create a referrer-less "root" `USER` to seed the referral network. (Normal
`/register` requires a referrer, so the first users must come from here.)

**Request body**

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `fullName` | string | yes | Non-empty after trim. |
| `phone` | string | yes | VN mobile. |
| `password` | string | yes | Min length 8. |

```json
{ "fullName": "Root User", "phone": "0900000000", "password": "rootpass1" }
```

**Success — `201`** — `{ "user": ... }` with `referrerId: null`.

**Errors:** `409 {"error":"phone already registered"}`; `400 {"success":false,"errors":[...]}`.

---

#### `GET /api/admin/users`

Browse/search all users (both roles), newest first. No balances included — use
`GET /api/admin/users/:id/balances` for a specific user's balances.

**Query params**

| Param | Type | Notes |
| --- | --- | --- |
| `q` | string | Optional. Substring match against `fullName` **or** `phone`. ASCII-only case-insensitive (accented names are case-sensitive; phone search is unaffected). |
| `page`, `limit` | pagination | See §2. |

**Success — `200`**

```json
{
  "users": [
    { "id": "b3f1...", "fullName": "Nguyễn Văn A", "phone": "0912345678", "role": "USER", "referrerId": "a1d2...", "referralCode": "0912345678", "isActive": true, "createdAt": "2026-07-10T02:15:30.000Z" }
  ],
  "page": 1,
  "limit": 20,
  "total": 1
}
```

---

#### `GET /api/admin/orders`

List orders across all users (the admin approval queue), newest first.

**Query params**

| Param | Type | Notes |
| --- | --- | --- |
| `status` | `OrderStatus` | Optional. Invalid → 400. |
| `userId` | string | Optional filter to one user. |
| `page`, `limit` | pagination | See §2. |

**Success — `200`** — same envelope as `GET /api/orders` (`{ orders, page, limit, total }`).

**Errors:** `400 {"error":"invalid status"}`.

---

#### `POST /api/admin/orders/:id/approve`

Approve a pending order. This pays out F-wallet bonuses: **+50** `CUSTOMER_REWARD` to
the creator and **+10** `CUSTOMER_REFERRAL_BONUS` to the creator's referrer (if any). No body.

**Success — `200`** — `{ "order": ... }` with `status: "APPROVED"`, `decidedBy`, `decidedAt` set.

**Errors**

| Status | Body | When |
| --- | --- | --- |
| `404` | `{"error":"not found"}` | No such order. |
| `409` | `{"error":"order already decided","code":"ALREADY_DECIDED","status":"APPROVED"}` | Already approved/rejected; `status` = current status. |

---

#### `POST /api/admin/orders/:id/reject`

Reject a pending order. No ledger changes. No body.

**Success — `200`** — `{ "order": ... }` with `status: "REJECTED"`.

**Errors:** identical to approve — `404 {"error":"not found"}`; `409 {"error":"order already decided","code":"ALREADY_DECIDED","status":...}`.

---

#### `POST /api/admin/redemptions`

Deduct points for cash paid out to a user outside the system. Debits the F and/or G
wallet. Idempotent via `idempotencyKey`.

**Request body** — at least one of `f` / `g` is required; **any other key hard-fails with 400**.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `userId` | string | yes | Min length 1. |
| `f` | number | conditional | Positive integer. F-wallet amount to deduct. |
| `g` | number | conditional | Positive integer. G-wallet amount to deduct. |
| `note` | string | no | ≤ 500 chars. |
| `idempotencyKey` | string | yes | Min length 1. Replaying the same key is rejected. |

At least one of `f` or `g` must be present, else `400` with `"at least one of f or g"`.

```json
{ "userId": "b3f1...", "f": 50, "note": "Paid 500k cash", "idempotencyKey": "redeem-2026-07-10-001" }
```

**Success — `201`**

```json
{
  "entries": [
    { "id": "e1...", "userId": "b3f1...", "wallet": "F", "type": "REDEMPTION", "points": -50, "orderId": null, "periodIndex": null, "note": "Paid 500k cash", "createdBy": "a1d2...", "createdAt": "2026-07-10T06:00:00.000Z", "subjectUserId": null, "idempotencyKey": "redeem-2026-07-10-001" }
  ],
  "balances": { "f": 60, "g": 30 }
}
```

- `entries` — one `AdminLedgerEntry` per wallet redeemed, `points` negative.
- `balances` — the user's derived F/G balances **after** the redemption.

**Errors**

| Status | Body | When |
| --- | --- | --- |
| `404` | `{"error":"user not found"}` | `userId` doesn't exist. |
| `409` | `{"error":"duplicate redemption","code":"DUPLICATE_REDEMPTION"}` | `idempotencyKey` already used. |
| `422` | `{"error":"redemption locked","code":"REDEMPTION_LOCKED"}` | User has never earned a `CUSTOMER_REWARD`. |
| `422` | `{"error":"insufficient balance","code":"INSUFFICIENT_BALANCE"}` | Not enough points in a targeted wallet. |
| `400` | `{"success":false,"errors":[...]}` | Bad body / unknown key / neither f nor g. |

---

#### `POST /api/admin/users/:id/ban`

Khóa thủ công một tài khoản `USER` bằng cách đặt `is_active = 0`. Không có request body.
Phiên đăng nhập hiện tại của user bị vô hiệu ở request tiếp theo. Giai đoạn này chưa hỗ trợ mở khóa.

**Success — `200`**

```json
{ "ok": true, "userId": "user-uuid", "isActive": false }
```

**Errors:** `404` user không tồn tại; `403 SUPER_ADMIN_PROTECTED`; `409 ALREADY_BANNED`.

---

#### `POST /api/admin/users/:id/unban`

Mở lại một tài khoản `USER` đã bị khóa bằng cách đặt `is_active = 1`. Không có request body.

**Success — `200`**

```json
{ "ok": true, "userId": "user-uuid", "isActive": true }
```

**Errors:** `404` user không tồn tại; `403 SUPER_ADMIN_PROTECTED`; `409 ALREADY_ACTIVE`.

---

#### `GET /api/admin/users/:id/balances`

Balances for any user (admin view of §6.3's balances).

**Success — `200`**

```json
{ "f": 110, "g": 30, "redemptionUnlocked": true }
```

**Errors:** `404 {"error":"user not found"}`.

---

#### `GET /api/admin/ledger`

Ledger across all users, newest first. Returns `AdminLedgerEntry` objects (with
`subjectUserId` / `idempotencyKey`).

**Query params**

| Param | Type | Notes |
| --- | --- | --- |
| `wallet` | `F` \| `G` | Optional. Invalid → 400. |
| `type` | `LedgerType` | Optional. Invalid → 400. |
| `userId` | string | Optional filter to one user. |
| `from` | ISO datetime | Optional, inclusive lower bound. |
| `to` | ISO datetime | Optional, exclusive upper bound. |
| `page`, `limit` | pagination | See §2. |

**Success — `200`**

```json
{
  "entries": [
    { "id": "9f2b...", "userId": "b3f1...", "wallet": "F", "type": "REGISTRATION_BONUS", "points": 10, "orderId": null, "periodIndex": null, "note": null, "createdBy": null, "createdAt": "2026-07-10T02:15:30.000Z", "subjectUserId": "b3f1...", "idempotencyKey": null }
  ],
  "page": 1,
  "limit": 20,
  "total": 1
}
```

**Errors:** `400 {"error":"invalid wallet"}`; `400 {"error":"invalid type"}`.
