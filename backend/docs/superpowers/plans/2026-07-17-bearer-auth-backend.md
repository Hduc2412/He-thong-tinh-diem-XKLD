# Bearer-Token Auth (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the API's httpOnly-cookie session with a bearer token: login/register return the
token in the JSON body, every other request sends it via `Authorization: Bearer <token>`. Add
permissive CORS since bearer auth needs no credentialed-CORS/cookie complications.

**Architecture:** The JWT itself (`signSession`/`verifySession`, HS256, `{sub, exp}`, 1-day TTL,
re-load-user-from-D1-every-request) is unchanged — only its transport changes, from `Set-Cookie` /
`Cookie` to the response body / `Authorization` header. No refresh token, no server-side
revocation — logout becomes a stateless client-side no-op.

**Tech Stack:** Hono, `hono/jwt`, `hono/cors` (already available — part of the `hono` package,
no new dependency). Cloudflare D1, Vitest + `@cloudflare/vitest-pool-workers`.

**Reference:** Design spec at `docs/superpowers/specs/2026-07-17-bearer-auth-design.md`. Working
branch: `bearer-auth` (already created and checked out, with the spec doc committed).

---

### Task 1: `src/lib/jwt.ts` — swap cookie helpers for a bearer-header helper

**Files:**
- Modify: `src/lib/jwt.ts`

- [ ] **Step 1: Replace the whole file**

The signing/verifying logic (`signSession`, `verifySession`, `SessionPayload`, `TTL_SECONDS`) is
unchanged. Remove `SESSION_COOKIE`, `setSessionCookie`, `clearSessionCookie`, `getSessionToken`,
and the `hono/cookie` import. Add `getBearerToken`.

```ts
// Session = a signed JWT (HS256), sent by the client via the `Authorization: Bearer <token>`
// header. No refresh token; TTL 1 day. The token holds only { sub, exp } — the middleware
// re-loads the user from D1 each request, so role/active status are always fresh and nothing in
// the token can go stale.
import { sign, verify } from 'hono/jwt'
import type { Context } from 'hono'

const TTL_SECONDS = 60 * 60 * 24 // 1 day

export interface SessionPayload {
  sub: string // user id
  exp: number // seconds since epoch
}

export async function signSession(secret: string, sub: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS
  return sign({ sub, exp }, secret, 'HS256')
}

// Throws on a bad or expired token — callers must try/catch.
export async function verifySession(token: string, secret: string): Promise<SessionPayload> {
  const payload = await verify(token, secret, 'HS256')
  return payload as unknown as SessionPayload
}

// Reads the token from `Authorization: Bearer <token>`. Returns undefined if the header is
// missing or doesn't use the Bearer scheme.
export function getBearerToken(c: Context): string | undefined {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) return undefined
  return header.slice('Bearer '.length)
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc`
Expected: FAILS — `src/middleware/auth.ts` and `src/routes/auth.ts` still import the now-removed
`getSessionToken`/`setSessionCookie`/`clearSessionCookie` from `src/lib/jwt.ts`. That's expected
and correct at this point in the plan; Tasks 2 and 3 fix those imports. Confirm the errors are
ONLY about those two files/imports — if `tsc` reports anything else, stop and investigate before
moving on.

- [ ] **Step 3: Commit**

```bash
git add src/lib/jwt.ts
git commit -m "feat: replace session cookie with bearer-token helper in jwt.ts"
```

---

### Task 2: `src/middleware/auth.ts` — read the token from the header

**Files:**
- Modify: `src/middleware/auth.ts`

- [ ] **Step 1: Update the import and the one line that reads the token**

Change:
```ts
import { getSessionToken, verifySession } from '../lib/jwt'
```
to:
```ts
import { getBearerToken, verifySession } from '../lib/jwt'
```

Change:
```ts
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const token = getSessionToken(c)
```
to:
```ts
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const token = getBearerToken(c)
```

Update the comment above it from "Reads the session cookie;" to "Reads the Authorization header;"
and the `catch` comment from "Expired or tampered cookie" to "Expired or tampered token". Full
resulting file:

```ts
import { createMiddleware } from 'hono/factory'
import { getBearerToken, verifySession } from '../lib/jwt'
import { findById, toAuthUser } from '../lib/users'
import type { AppEnv } from '../types'

// Runs on every request. Reads the Authorization header; if it verifies, re-loads the user from
// D1 (so role/active status are always current) and attaches it. Never rejects — anonymous is valid.
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const token = getBearerToken(c)
  if (token) {
    try {
      const { sub } = await verifySession(token, c.env.JWT_SECRET)
      const row = await findById(c.env.DB, sub)
      if (row && row.is_active === 1) {
        c.set('user', toAuthUser(row))
      }
    } catch {
      // Expired or tampered token → degrade to anonymous, never 500.
    }
  }
  await next()
})

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('user')) return c.json({ error: 'unauthorized' }, 401)
  await next()
})

export const requireSuperAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  if (user.role !== 'SUPER_ADMIN') return c.json({ error: 'forbidden' }, 403)
  await next()
})
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware/auth.ts
git commit -m "feat: read auth token from Authorization header instead of cookie"
```

---

### Task 3: `src/routes/auth.ts` + `src/index.ts` — return token in body, stateless logout, CORS

**Files:**
- Modify: `src/routes/auth.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: routes/auth.ts — drop the cookie import, return `token` in the response body**

Change the import line:
```ts
import { signSession, setSessionCookie, clearSessionCookie } from '../lib/jwt'
```
to:
```ts
import { signSession } from '../lib/jwt'
```

In `register`, change:
```ts
    const token = await signSession(c.env.JWT_SECRET, user.id)
    setSessionCookie(c, token)
    return c.json({ user }, 201)
```
to:
```ts
    const token = await signSession(c.env.JWT_SECRET, user.id)
    return c.json({ user, token }, 201)
```

In `login`, change:
```ts
  const user = toAuthUser(row)
  const token = await signSession(c.env.JWT_SECRET, user.id)
  setSessionCookie(c, token)
  return c.json({ user })
```
to:
```ts
  const user = toAuthUser(row)
  const token = await signSession(c.env.JWT_SECRET, user.id)
  return c.json({ user, token })
```

Change `logout` from:
```ts
authRoutes.post('/logout', (c) => {
  clearSessionCookie(c)
  return c.json({ ok: true })
})
```
to:
```ts
// Bearer tokens are stateless — nothing to invalidate server-side (no refresh-token store in
// this design; see docs/superpowers/specs/2026-07-17-bearer-auth-design.md). The client just
// discards its stored token. A token that leaked before logout stays valid until its natural
// 1-day expiry. Route kept for API symmetry — the client always has something to call.
authRoutes.post('/logout', (c) => {
  return c.json({ ok: true })
})
```

- [ ] **Step 2: index.ts — add permissive CORS**

Change:
```ts
import { Hono } from 'hono'
import { authMiddleware } from './middleware/auth'
```
to:
```ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth'
```

Change:
```ts
const app = new Hono<AppEnv>()

// Attach the current user (if any) to every request.
app.use('*', authMiddleware)
```
to:
```ts
const app = new Hono<AppEnv>()

// Bearer-token auth carries no cookie, so there's no CSRF/credentialed-CORS concern — wide open
// for now (docs/superpowers/specs/2026-07-17-bearer-auth-design.md). Tighten to the real client
// origin once one exists.
app.use('*', cors({ origin: '*' }))

// Attach the current user (if any) to every request.
app.use('*', authMiddleware)
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc`
Expected: exits clean, no errors — this was the last file importing the now-removed cookie helpers,
so the whole cookie→bearer migration should typecheck end-to-end at this point.

- [ ] **Step 4: Commit**

```bash
git add src/routes/auth.ts src/index.ts
git commit -m "feat: return bearer token in auth responses, stateless logout, permissive CORS"
```

---

### Task 4: `test/helpers.ts` — bearer-based test helpers

**Files:**
- Modify: `test/helpers.ts`

- [ ] **Step 1: Replace the whole file**

```ts
import { env, SELF } from 'cloudflare:test'
import { createUser } from '../src/lib/users'

export const BASE = 'https://example.com'

export function post(path: string, body?: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  return SELF.fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

export function get(path: string, token?: string): Promise<Response> {
  return SELF.fetch(`${BASE}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} })
}

// Pull the bearer token out of a login/register JSON response.
export async function authToken(res: Response): Promise<string> {
  const { token } = await res.json<{ token: string }>()
  if (!token) throw new Error('no token in response body')
  return token
}

export const ADMIN_PHONE = '0900000000'
export const ADMIN_PASSWORD = 'adminpass123'

/** Seed the singleton super admin (same path seed:admin uses) and return its login token. */
export async function seedAdmin(): Promise<{ id: string; referralCode: string; token: string }> {
  const admin = await createUser(env.DB, {
    fullName: 'Super Admin',
    phone: ADMIN_PHONE,
    password: ADMIN_PASSWORD,
    role: 'SUPER_ADMIN',
    referrerId: null,
  })
  const res = await post('/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })
  return { id: admin.id, referralCode: admin.referralCode, token: await authToken(res) }
}

export interface RegisteredUser {
  id: string
  referralCode: string
  token: string
}

/** Register a USER under `referralCode`; returns their id, own referral code, and auth token. */
export async function registerUser(
  referralCode: string,
  phone: string,
  fullName = 'Test User',
  password = 'userpass123',
): Promise<RegisteredUser> {
  const res = await post('/api/auth/register', { fullName, phone, password, referralCode })
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${await res.text()}`)
  const { user, token } = await res.json<{ user: { id: string; referralCode: string }; token: string }>()
  return { id: user.id, referralCode: user.referralCode, token }
}
```

Note this drops the old `sessionCookie(res)` export entirely (replaced by `authToken(res)`) and
renames the `cookie` field on the returned objects to `token` — Task 6 updates the call sites that
depended on the old `.cookie` field name.

- [ ] **Step 2: Commit**

```bash
git add test/helpers.ts
git commit -m "test: rewrite shared test helpers for bearer tokens"
```

(This commit alone will not make the suite pass — `test/auth.test.ts` has its own inline copies of
these helpers, untouched by this file, and `orders.test.ts`/`points.test.ts`/`redemptions.test.ts`
still reference `.cookie`. That's expected; Tasks 5 and 6 fix those. Don't run the full suite yet.)

---

### Task 5: `test/auth.test.ts` — rewrite for bearer tokens

**Files:**
- Modify: `test/auth.test.ts`

`test/auth.test.ts` does NOT import from `test/helpers.ts` — it has its own local `post`/`get`/
`patch`/`sessionCookie`/`seedAdmin`. Rewrite the whole file.

- [ ] **Step 1: Replace the whole file**

```ts
import { env, SELF } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { createUser } from '../src/lib/users'

const BASE = 'https://example.com'

function post(path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  return SELF.fetch(`${BASE}${path}`, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined })
}

function patch(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  return SELF.fetch(`${BASE}${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
}

function get(path: string, token?: string) {
  return SELF.fetch(`${BASE}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} })
}

// Seed the singleton super admin directly via the shared createUser (same path seed:admin uses).
const ADMIN_PHONE = '0900000000'
const ADMIN_PASSWORD = 'adminpass123'
function seedAdmin() {
  return createUser(env.DB, {
    fullName: 'Super Admin',
    phone: ADMIN_PHONE,
    password: ADMIN_PASSWORD,
    role: 'SUPER_ADMIN',
    referrerId: null,
  })
}

describe('register', () => {
  it('registers a USER under a referrer and returns an auth token', async () => {
    const admin = await seedAdmin()
    const res = await post('/api/auth/register', {
      fullName: 'Nguyen Van A',
      phone: '0912345678',
      password: 'userpass123',
      referralCode: admin.referralCode, // = admin phone
    })
    expect(res.status).toBe(201)
    const { user, token } = await res.json<{
      user: { role: string; referrerId: string; referralCode: string }
      token: string
    }>()
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
    expect(user.role).toBe('USER')
    expect(user.referrerId).toBe(admin.id)
    expect(user.referralCode).toBe('0912345678') // defaults to phone
  })

  it('rejects an over-long full name with 400', async () => {
    const admin = await seedAdmin()
    const res = await post('/api/auth/register', {
      fullName: 'x'.repeat(101),
      phone: '0912345678',
      password: 'userpass123',
      referralCode: admin.referralCode,
    })
    expect(res.status).toBe(400)
  })

  it('rejects a missing referral code with 400', async () => {
    await seedAdmin()
    const res = await post('/api/auth/register', { fullName: 'A', phone: '0912345678', password: 'userpass123' })
    expect(res.status).toBe(400)
  })

  it('rejects an unknown referral code with 400', async () => {
    await seedAdmin()
    const res = await post('/api/auth/register', {
      fullName: 'A',
      phone: '0912345678',
      password: 'userpass123',
      referralCode: 'does-not-exist',
    })
    expect(res.status).toBe(400)
  })

  it('rejects a weak password with 400', async () => {
    await seedAdmin()
    const res = await post('/api/auth/register', {
      fullName: 'A',
      phone: '0912345678',
      password: 'short',
      referralCode: ADMIN_PHONE,
    })
    expect(res.status).toBe(400)
  })

  it('rejects a duplicate phone with 409', async () => {
    const admin = await seedAdmin()
    const body = { fullName: 'A', phone: '0912345678', password: 'userpass123', referralCode: admin.referralCode }
    expect((await post('/api/auth/register', body)).status).toBe(201)
    expect((await post('/api/auth/register', body)).status).toBe(409)
  })

  it('accepts the referrer via the ?ref= query when no body code is given', async () => {
    const admin = await seedAdmin()
    const res = await post(`/api/auth/register?ref=${admin.referralCode}`, {
      fullName: 'A',
      phone: '0912345678',
      password: 'userpass123',
    })
    expect(res.status).toBe(201)
    const { user } = await res.json<{ user: { referrerId: string } }>()
    expect(user.referrerId).toBe(admin.id)
  })
})

describe('login', () => {
  it('logs in with correct phone + password (200 + token)', async () => {
    await seedAdmin()
    const res = await post('/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    const { token } = await res.json<{ token: string }>()
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })

  it('normalizes +84 to 0 on login', async () => {
    await seedAdmin()
    const res = await post('/api/auth/login', { phone: '+84900000000', password: ADMIN_PASSWORD })
    expect(res.status).toBe(200)
  })

  it('returns a vague 401 for a wrong password', async () => {
    await seedAdmin()
    const res = await post('/api/auth/login', { phone: ADMIN_PHONE, password: 'wrongpass123' })
    expect(res.status).toBe(401)
  })

  it('returns the same 401 for an unknown phone (no enumeration)', async () => {
    await seedAdmin()
    const res = await post('/api/auth/login', { phone: '0988888888', password: 'whatever123' })
    expect(res.status).toBe(401)
  })
})

describe('me + logout', () => {
  it('returns the current user with a token, 401 without', async () => {
    await seedAdmin()
    const login = await post('/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })
    const { token } = await login.json<{ token: string }>()

    const withToken = await get('/api/auth/me', token)
    expect(withToken.status).toBe(200)
    const { user } = await withToken.json<{ user: { phone: string } }>()
    expect(user.phone).toBe(ADMIN_PHONE)

    expect((await get('/api/auth/me')).status).toBe(401)
  })

  it('PATCH /me renames the user', async () => {
    await seedAdmin()
    const login = await post('/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })
    const { token } = await login.json<{ token: string }>()
    const res = await patch('/api/auth/me', { fullName: 'Renamed Admin' }, token)
    expect(res.status).toBe(200)
    const { user } = await res.json<{ user: { fullName: string } }>()
    expect(user.fullName).toBe('Renamed Admin')
  })

  it('logout is a stateless no-op that always succeeds', async () => {
    await seedAdmin()
    const login = await post('/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })
    const { token } = await login.json<{ token: string }>()
    expect((await post('/api/auth/logout', undefined, token)).status).toBe(200)
  })
})

describe('admin /users (RBAC)', () => {
  const rootBody = { fullName: 'Root User', phone: '0955555555', password: 'rootpass123' }

  it('lets the super admin create a referrer-less root user (201)', async () => {
    await seedAdmin()
    const login = await post('/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })
    const { token } = await login.json<{ token: string }>()
    const res = await post('/api/admin/users', rootBody, token)
    expect(res.status).toBe(201)
    const { user } = await res.json<{ user: { role: string; referrerId: string | null } }>()
    expect(user.role).toBe('USER')
    expect(user.referrerId).toBeNull()
  })

  it('forbids a normal USER (403)', async () => {
    const admin = await seedAdmin()
    const reg = await post('/api/auth/register', {
      fullName: 'A',
      phone: '0912345678',
      password: 'userpass123',
      referralCode: admin.referralCode,
    })
    const { token } = await reg.json<{ token: string }>()
    const res = await post('/api/admin/users', rootBody, token)
    expect(res.status).toBe(403)
  })

  it('rejects an anonymous request (401)', async () => {
    await seedAdmin()
    const res = await post('/api/admin/users', rootBody)
    expect(res.status).toBe(401)
  })
})

describe('single super admin invariant', () => {
  it('the DB rejects a second super admin', async () => {
    await seedAdmin()
    await expect(
      createUser(env.DB, {
        fullName: 'Impostor',
        phone: '0911111111',
        password: 'impostor123',
        role: 'SUPER_ADMIN',
        referrerId: null,
      }),
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run just this file**

Run: `pnpm exec vitest run test/auth.test.ts`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add test/auth.test.ts
git commit -m "test: rewrite auth.test.ts for bearer tokens"
```

---

### Task 6: Rename `.cookie` → `.token` in the three dependent test files

**Files:**
- Modify: `test/orders.test.ts`
- Modify: `test/points.test.ts`
- Modify: `test/redemptions.test.ts`

Every occurrence of the word `cookie` in these three files is either the `.cookie` property access
on a `seedAdmin()`/`registerUser()` result (now named `.token` per Task 4), or a local parameter/
variable holding that same value (e.g. `function balanceF(cookie: string)`, `admin.cookie`). This
was verified with `grep -n "cookie" test/orders.test.ts test/points.test.ts test/redemptions.test.ts`
before writing this plan — every match is one of those two cases, nothing else. A literal find-
and-replace of the word `cookie` → `token` across these three files is therefore correct and
complete.

- [ ] **Step 1: Replace every occurrence**

```bash
sed -i 's/cookie/token/g' test/orders.test.ts test/points.test.ts test/redemptions.test.ts
```

- [ ] **Step 2: Confirm no `cookie` occurrences remain, and nothing else changed unexpectedly**

Run: `grep -n "cookie" test/orders.test.ts test/points.test.ts test/redemptions.test.ts`
Expected: no output (no matches).

Run: `git diff --stat test/orders.test.ts test/points.test.ts test/redemptions.test.ts`
Expected: only these three files changed, no unrelated lines touched (spot-check `git diff` — every
changed line should be a `cookie`→`token` substitution, nothing structurally different).

- [ ] **Step 3: Run the full suite**

Run: `pnpm test`
Expected: all test files pass (10 files, same count as before this plan started).

- [ ] **Step 4: Commit**

```bash
git add test/orders.test.ts test/points.test.ts test/redemptions.test.ts
git commit -m "test: rename .cookie to .token in orders/points/redemptions tests"
```

---

### Task 7: `docs/API.md` — document the bearer-token auth model

**Files:**
- Modify: `docs/API.md`

- [ ] **Step 1: Replace the "## 1. Authentication" section**

Find the section starting at `## 1. Authentication` and ending right before `## 2. Conventions`
(currently the block starting `**Auth is a session cookie, not a bearer token.**` through the
`| 403 | ...` table row). Replace it entirely with:

```markdown
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
const res = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ phone, password }),
})
const { user, token } = await res.json()
localStorage.setItem('token', token)

// later requests
await fetch('/api/points/balances', {
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/API.md
git commit -m "docs: update API.md for bearer-token auth"
```

---

### Task 8: `docs/auth-design.md` — update the locked auth design

**Files:**
- Modify: `docs/auth-design.md`

- [ ] **Step 1: Update the tech table row**

Change:
```
| Session | Signed JWT in an httpOnly cookie (`hono/jwt` + `hono/cookie`) |
```
to:
```
| Session | Signed JWT via `Authorization: Bearer` header (`hono/jwt`) |
```

- [ ] **Step 2: Replace the "Step 4 — Session tokens & cookies" section**

Find the section starting `## Step 4 — Session tokens & cookies ✅ LOCKED` and ending right before
`## Step 5 — \`createUser\` helper + lookups ✅ LOCKED`. Replace it entirely with:

```markdown
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
`Authorization: Bearer <token>` on every request. **Superseded from an earlier httpOnly-cookie
design** — see `docs/superpowers/specs/2026-07-17-bearer-auth-design.md` for the rationale and the
accepted trade-off: a cookie is invisible to JS, so XSS can't steal it; a bearer token in
client-readable storage can be, for up to its 1-day lifetime — accepted in exchange for a simpler
transport with no same-origin proxy requirement.

**Helpers:** `signSession`, `verifySession` (throws on bad/expired), `getBearerToken`.

**Decision — re-load user from DB every request** (not trust-the-JWT): the token carries only
`sub`; the auth middleware looks the user up in D1 each request for current `role` + `is_active`.
Role changes and deactivations take effect **immediately** (next request rejected), at the cost of
one tiny indexed read. Keeps the payload minimal — nothing to go stale.

**Gotchas:** `sign`/`verify` need the explicit `'HS256'` arg in this Hono version; `verify`
*throws* on expired/invalid — callers must `try/catch`.
```

- [ ] **Step 3: Update the Step 6 mention**

Change:
```
**File:** `src/middleware/auth.ts` (`hono/factory`). `authMiddleware` (global) reads the cookie,
```
to:
```
**File:** `src/middleware/auth.ts` (`hono/factory`). `authMiddleware` (global) reads the
Authorization header,
```

- [ ] **Step 4: Commit**

```bash
git add docs/auth-design.md
git commit -m "docs: update auth-design.md for bearer-token auth"
```

---

### Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all test files pass, same total test count as the pre-change baseline (run `git stash`
+ `pnpm test` first if you want a literal before/after count — otherwise just confirm zero
failures and no skipped files).

- [ ] **Step 2: Grep for any leftover cookie references in source (not docs/specs, which
      intentionally reference the old design for context)**

Run: `grep -rn "setSessionCookie\|clearSessionCookie\|getSessionToken\|SESSION_COOKIE\|hono/cookie" src/ test/`
Expected: no output. If anything matches, it's a missed spot from Tasks 1-6 — fix it.

- [ ] **Step 3: Commit (only if Step 2 found and fixed something — otherwise nothing to commit)**

Run: `git status --short`

If clean, this task is done with no commit needed.
