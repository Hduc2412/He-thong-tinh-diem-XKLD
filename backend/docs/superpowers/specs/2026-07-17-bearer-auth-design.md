# Bearer-token auth — design

**Date:** 2026-07-17
**Repos affected:** `xkld-tools` (API, new branch — name TBD by implementer, e.g. `bearer-auth`) and
`xkld-tools-client` (frontend, on `main`).
**Scope:** Replace the API's cookie-based session with a bearer token returned in the login/register
JSON response and sent back via the `Authorization` header. Update the client to store that token
and attach it to every request, calling the API's absolute URL directly instead of proxying through
a same-origin Worker. No refresh-token/rotation mechanism — this mirrors the current cookie
session's simplicity (one JWT, one TTL, no refresh), just changes *where the token lives and how
it travels*.

## Why

The client (`xkld-tools-client`) previously called the API through a same-origin proxy (Vite dev
proxy locally, a Cloudflare service-binding Worker in production) specifically so the browser never
made a cross-origin request — this let the existing `httpOnly`/`sameSite=Lax` session cookie keep
working with zero backend changes (see the original scaffold design spec,
`2026-07-17-client-scaffold-design.md`, §2).

That proxy layer added real complexity (a service binding, `run_worker_first` routing, a
proxy-only Worker script) purely to avoid touching the backend's auth model. After comparing
against a sibling project's much plainer `fetch` + typed-error pattern, the call was made to
instead change the auth transport itself — drop the proxy, call the API's real URL directly, and
carry the session as a bearer token instead of a cookie.

**Security trade-off, explicitly accepted:** the session cookie was `httpOnly` specifically so
client-side JavaScript — including anything injected via an XSS bug — could never read the session
token. A bearer token stored in `localStorage` (this design) is plain JS-readable: an XSS
vulnerability anywhere in the client app can exfiltrate it directly, for the full lifetime of the
token (1 day). This is a deliberate, informed trade-off in exchange for a simpler, more familiar
transport (no proxy infrastructure, no `sameSite`/`Secure` cookie complications for a client on a
different domain than the API). It is NOT compensated by a refresh-token/rotation scheme — that
would meaningfully mitigate the exposure window (as a comparable sibling project does), but is
explicitly out of scope here; adding it later is a natural next step if this app's risk profile
changes.

## 1. Backend (`xkld-tools`)

**New branch** (implementer picks the name, e.g. `bearer-auth`), off `main`.

- `src/lib/jwt.ts`:
  - Keep `signSession(secret, sub)` / `verifySession(token, secret)` exactly as they are — same
    `{ sub, exp }` payload, same 1-day TTL, same HS256 secret. The token's internal shape doesn't
    change, only how it's delivered.
  - Remove `SESSION_COOKIE`, `setSessionCookie`, `clearSessionCookie`, `getSessionToken` (all
    cookie-specific).
  - Add a way to read the bearer token from the `Authorization: Bearer <token>` request header
    (a small helper, or inline in the middleware — implementer's call).
- `src/middleware/auth.ts`: read the token via the header instead of the cookie. The rest of the
  logic — verify the JWT, re-load the user fresh from D1 by `sub`, check `is_active`, attach to
  context — is unchanged. Anonymous (no/invalid header) still degrades gracefully, same as today.
- `src/routes/auth.ts`:
  - `POST /api/auth/register` and `POST /api/auth/login`: instead of `setSessionCookie(c, token)`,
    return `{ user, token }` in the JSON body (keep the existing status codes: 201 for register,
    200 for login).
  - `POST /api/auth/logout`: becomes a stateless no-op (`{ ok: true }`) — there is no server-side
    token revocation in this design (matches the "no refresh/rotation" scope decision above), so
    logging out is purely the client discarding its stored token. Keep the route for API symmetry
    and so the client has something to call, but note the limitation in a comment: a token that
    leaked before logout remains valid until its natural expiry.
  - `GET /api/auth/me`, `PATCH /api/auth/me`: unchanged (already just read `c.get('user')`, which
    the middleware populates the same way regardless of transport).
- CORS: add `hono/cors` with `origin: '*'` (explicitly permissive for now, revisit when the client
  has a real production domain). Because bearer tokens travel in a header, not a cookie, this does
  NOT need `credentials: true` / `Access-Control-Allow-Credentials` — the CORS config is simpler
  than a cookie-based setup would have required.
- Tests (`test/auth.test.ts` and any shared test helpers that currently extract the session cookie
  from a response): rewrite to read `token` from the JSON response body and send it back as
  `Authorization: Bearer <token>` on subsequent requests in the same test.
- Docs: update `docs/API.md` (auth section: bearer token instead of cookie, note the CORS `*`) and
  `docs/auth-design.md` (the rationale section needs the trade-off from "Why" above reflected, since
  it currently documents and justifies the httpOnly-cookie choice this design reverses).

## 2. Frontend (`xkld-tools-client`)

Stays on `main` (per existing precedent — no separate branch for this repo).

- `src/lib/api.ts`: replace entirely with a `req<T>()` fetch wrapper:
  - Builds the URL from `API_URL` (see below) + a relative path.
  - Attaches `Authorization: Bearer <token>` when a token is present (reads via the auth-token
    helper below).
  - Parses the JSON body; on a non-2xx response, throws `AppError` (a small typed error class:
    `status: number`, `message: string`) instead of returning an error shape — callers use
    try/catch or TanStack Query's `isError`/`error`, not a discriminated-union return value.
- `src/lib/error.ts`: the `AppError` class described above.
- `src/lib/authToken.ts` (new): `getToken()`, `setToken(token)`, `clearToken()` — a thin wrapper
  around `localStorage` under one fixed key. This is the only place that touches `localStorage`
  for auth.
- `API_URL`: `import.meta.env.VITE_API_URL ?? 'http://localhost:8787'`. Add a `.env.example`
  documenting `VITE_API_URL` (and note in it that production's value isn't known yet — the API
  hasn't been deployed anywhere — so it stays a placeholder until a real deploy exists).
- Remove `server.proxy` from `vite.config.ts` — no longer needed, `req()` calls `API_URL` directly.
- Remove `src/worker.ts` and the `services` / `run_worker_first` blocks from `wrangler.jsonc` —
  the client becomes a plain static-assets Worker (SPA only, no proxying Worker script). This
  supersedes the service-binding proxy design from the original scaffold plan's Task 7.
- `checkApi()` (or whatever the health-check page's probe function is renamed to, given it now
  calls a real absolute URL rather than a same-origin proxy path) and the health-check page itself
  get updated to use `req<T>()` and surface `AppError` messages.

## Out of scope

- Refresh tokens, token rotation, reuse detection — see the accepted trade-off in "Why".
- Restricting CORS to specific origins (currently `*`, revisit once there's a real client domain).
- Any real login/register UI — the health-check page keeps proving connectivity; a login form is a
  separate future task once this transport change lands.
- Server-side session/token revocation (logout is client-only, as stated above).
