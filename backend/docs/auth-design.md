# Auth Design — XKLĐ CTV Points System

> **Living document.** We're designing the auth flow step by step, together. Each step is
> locked here as we agree on it; later steps get appended as we go. Grounded in the PRD:
> `docs/superpowers/specs/2026-07-06-ctv-points-business-spec-design.md`.

## Context

Auth is the first slice of the CTV points system. Everything later (Orders, Point Ledger,
Redemption, RBAC) sits on top of it. From the PRD:

- Exactly **two roles**: `SUPER_ADMIN` (a single account) and `USER`.
- **Login identity is phone + password** — for everyone, including the super admin.
- Every **normal** registration must resolve a referrer (typed code or invite link `?ref=`).
  Only the super admin creates referrer-less "root" accounts.
- Accounts **activate immediately** — no admin approval.
- RBAC: a `USER` sees only their own data; `SUPER_ADMIN` sees everything.

### Tech (decided)

| Concern | Choice |
|---|---|
| Framework | Hono on Cloudflare Workers |
| Storage | Cloudflare D1 (SQLite) |
| Password hash | WebCrypto **PBKDF2** (native to Workers, zero-dep — not bcrypt) |
| Session | Signed JWT via `Authorization: Bearer` header (`hono/jwt`) |
| Input validation | **arktype** (via `@hono/arktype-validator`) — not zod |

---

## Step 1 — Super Admin creation ✅ LOCKED

**Goal:** creating the super admin = run one thing. The admin then logs in with phone +
password exactly like a normal user.

**The snag:** a stored password is a PBKDF2 hash (`pbkdf2$<iter>$<salt>$<hash>`). SQLite/D1
**cannot compute PBKDF2 in SQL**, so a raw `INSERT` can't produce a valid hash. The hash must
be computed before the row is written.

**Decision:** a one-shot **seed script**, not a migration.
_(A migration is committed, static SQL that re-runs everywhere — putting a password hash in it
would commit the admin credential to git forever. Migrations are for schema, not secrets.)_

```bash
pnpm seed:admin --phone 0900000000 --name 'Super Admin'   # --local for dev; omit for prod
# → prompts for the password INTERACTIVELY (never in shell history)
```

The script:
1. Prompts for the password (option (b) — interactive, nothing in shell history).
2. Computes the hash in-process via the **same `hashPassword()` the app uses** (Node has
   WebCrypto), so the admin's hash is produced identically to everyone else's — one source of
   truth, imported via `tsx`.
3. Builds the `INSERT` and runs it against D1 through `wrangler d1 execute`.
4. Refuses if a super admin already exists; the DB's `one_super_admin` index is the backstop.

**Files (later):** `scripts/seed-admin.ts`, `package.json` script `seed:admin`, dev dep `tsx`.
Depends on Step 2 (schema) and the future `hashPassword()`.

---

## Step 2 — `users` table schema ✅ LOCKED

The single table every other piece reads/writes. Lives in a migration
(`migrations/0001_create_users.sql`).

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,              -- UUID
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,          -- login identity
  password_hash TEXT NOT NULL,                 -- pbkdf2$<iter>$<salt>$<hash>
  role          TEXT NOT NULL DEFAULT 'USER'
                  CHECK (role IN ('SUPER_ADMIN','USER')),
  referrer_id   TEXT REFERENCES users(id),     -- who referred them; NULL for admin + root users
  referral_code TEXT NOT NULL UNIQUE,          -- their own code, to refer others
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL                  -- ISO timestamp
);

-- at most ONE super admin, ever — enforced by the database itself
CREATE UNIQUE INDEX one_super_admin ON users(role) WHERE role = 'SUPER_ADMIN';

-- referral lookups later
CREATE INDEX idx_users_referrer ON users(referrer_id);
```

**Constraints doing real work:**
- `CHECK (role IN (...))` — DB rejects any role outside the two the PRD allows.
- `one_super_admin` **partial unique index** — uniqueness applies only to `SUPER_ADMIN` rows, so
  a second admin insert fails at the DB level (thousands of `USER`s still allowed).
- `referrer_id REFERENCES users(id)`, nullable — encodes "everyone has exactly one referrer,
  except the admin + root users (NULL)".

**Decisions:**
- **Every row gets a `referral_code`** (`NOT NULL`), including the super admin — simplest, and
  lets people register directly under the admin if desired.
- **Keep `is_active`** (default `1`) so a user can be deactivated later without a schema change.
  Nothing flips it in this phase.

---

## Step 3 — Password hashing ✅ LOCKED

**File (later):** `src/lib/password.ts`. Pure WebCrypto, zero deps. Used by register, login, and
the `seed:admin` script (one source of truth).

```ts
hashPassword(password: string): Promise<string>          // → "pbkdf2$100000$<saltB64>$<hashB64>"
verifyPassword(password: string, stored: string): Promise<boolean>
```

**Format:** one self-describing string — `pbkdf2$<iterations>$<saltB64>$<hashB64>`. No separate
salt/iterations columns; `verifyPassword` reads everything it needs back out of the string.

**Hashing:**
1. Random **16-byte (128-bit) salt** — `crypto.getRandomValues(new Uint8Array(16))` (CSPRNG, not
   `Math.random()`).
2. `crypto.subtle.deriveBits` → **PBKDF2 / SHA-256 / 100,000 iterations → 256 bits**.
3. Base64 salt + hash, join into the string.

**Verifying:** split the stored string → recover iterations + salt → re-derive from the typed
password with that same salt+iterations → **constant-time compare** (XOR every byte, accumulate)
against the stored hash. Never `===` — a plain compare leaks timing byte-by-byte.

**Decisions:**
- **100,000 iterations** — fast on Workers, comfortably inside CPU limits; fine at our scale.
- Iteration count is **baked into the stored string**, so we can raise the cost later (and
  transparently re-hash on next login) with **zero migration** — old hashes carry their own count.
- Base64 via `btoa`/`atob` + a `Uint8Array` ↔ binary-string loop (no deps).

---

## Step 4 — Session tokens & Authorization header ✅ LOCKED

**File (later):** `src/lib/jwt.ts` — thin wrapper over `hono/jwt`.
**Approach:** JWT only, **no refresh token**, **TTL = 1 day**. Re-login daily.

**Token:** signed JWT, `HS256`, signed with `JWT_SECRET`. Signed (tamper-evident) but **not
encrypted** — payload is public, so only non-secret identity goes in it.

**Payload (minimal):**
```jsonc
{ "sub": "<userId>", "exp": <issuedSeconds + 86400> }   // exp in SECONDS, not ms
```

**Transport** — the client stores the token itself (e.g. `localStorage`) and sends it back as
`Authorization: Bearer <token>` on every request.

**Design history** — this supersedes an earlier httpOnly-cookie design; see
`docs/superpowers/specs/2026-07-17-bearer-auth-design.md` for the full rationale. Accepted
trade-off: a cookie is invisible to JS, so XSS can't steal it; a bearer token in client-readable
storage can be, for up to its 1-day lifetime. Accepted in exchange for a simpler client/server
split — the frontend can call the API's real URL directly from any origin, instead of routing every
request through a same-origin reverse proxy just to keep the cookie same-site.

**Helpers:** `signSession`, `verifySession` (throws on bad/expired), `getBearerToken`.

**Decision — re-load user from DB every request** (not trust-the-JWT): the token carries only
`sub`; the auth middleware looks the user up in D1 each request for current `role` + `is_active`.
Role changes and deactivations take effect **immediately** (next request rejected), at the cost of
one tiny indexed read. Keeps the payload minimal — nothing to go stale.

**Gotchas:** `sign`/`verify` need the explicit `'HS256'` arg in this Hono version; `verify`
*throws* on expired/invalid — callers must `try/catch`.

---

## Step 5 — `createUser` helper + lookups ✅ LOCKED

**File:** `src/lib/users.ts`. The **one shared INSERT path** for register, `seed:admin`, and the
admin route (no drift). `createUser(db, { fullName, phone, password, role, referrerId })`:
`crypto.randomUUID()` id, `hashPassword`, **`referral_code = phone`** (default — unique because
phone is unique), `created_at = new Date().toISOString()`, one parameterized INSERT.

- **No random code generator** (dropped) and **no collision handling this phase**: the code equals
  the unique phone and is **not editable**, so a duplicate is impossible. See "Future & edge cases".
- Uniqueness is the DB's job: catch the D1 `UNIQUE` error → typed `ConflictError { field:
  'phone' | 'role' }` (no pre-check race).
- Lookups: `findById`, `findByPhone`, `findByReferralCode`, `superAdminExists`. `updateFullName`
  for profile edits. `toAuthUser(row)` strips `password_hash` + camelCases — used for every
  returned user. Shared arktype validators (`phone`, `fullName`) live in `src/lib/validators.ts`.

## Step 6 — Middleware & guards ✅ LOCKED

**File:** `src/middleware/auth.ts` (`hono/factory`). `authMiddleware` (global) reads the
Authorization header,
`try/catch` verifies, **re-loads the user from D1**, and sets it only if `is_active`; never
rejects. `requireAuth` → 401 if none. `requireSuperAdmin` → 401 none / 403 not admin. `AppEnv`
(`src/types.ts`) uses `Bindings: CloudflareBindings`, `Variables: { user?: AuthUser }`.

## Step 7 — Auth routes ✅ LOCKED

**File:** `src/routes/auth.ts` (arktype-validated). `POST /register` (referrer **required**: body
`referralCode` then `?ref=`; 400 if none/unknown, 409 dup phone), `POST /login` (vague 401, runs a
`verifyPassword` against a constant `DUMMY_HASH` when phone unknown → no timing/enumeration leak),
`POST /logout`, `GET /me` (`requireAuth`), `PATCH /me` (`requireAuth`, **`fullName` only** this
phase). Phone normalized `+84`→`0`, matched `^0\d{9}$`; password min 8.

## Step 8 — Admin route ✅ LOCKED

**File:** `src/routes/admin.ts`. `use('*', requireSuperAdmin)`; `POST /users` → `createUser(role:
'USER', referrerId: null)` → 201. Seeds referrer-less "root" users (PRD FR1).

## Step 9 — Seed script + wire-up ✅ LOCKED

`scripts/seed-admin.ts` (run via `tsx`, `pnpm seed:admin`): args `--phone/--name/--local`,
**interactive password prompt** (raw-mode, nothing in shell history), imports the app's
`hashPassword`, builds the INSERT, runs it via `pnpm exec wrangler d1 execute`; friendly message
if the `one_super_admin` index rejects a second admin. `src/index.ts` mounts `authMiddleware`
globally + `/api/auth` + `/api/admin`, keeps `GET /` health check.

---

## Resolved decisions

1. **Phone is not editable** — it's the login identity / de-facto unique id.
2. **`referral_code` is not editable this phase** — it stays `= phone`, so duplicate codes are
   impossible and `PATCH /me` handles only `fullName`.

## Future & edge cases (deferred — document only)

When we later **allow editing `referral_code`**, an ordering edge case appears: user A renames
their code to a phone-shaped string nobody owns yet; later a real user registers with that phone,
whose default code (`= phone`) now collides. A plain edit-time uniqueness check can't prevent it.
**Rules to add when enabling editing:** (1) new code must be **UNIQUE** (else 409, block the edit);
(2) new code must **not be phone-shaped** (`^0\d{9}$` rejected) — keeping default codes (always
phone-shaped) and custom codes (never) in disjoint namespaces, so the collision is impossible.

**Avatar (R2):** deferred — later adds a nullable `avatar_url` column + an upload endpoint; `PATCH
/me` then also accepts `avatarUrl`.

## Step 10 — Tests (next)

`test/auth.test.ts` via `cloudflare:test` + `SELF.fetch`; per-test `reset()` + re-migrate. Covers
register/login/me/logout, `PATCH /me`, admin `/users` RBAC, and seed→login.
