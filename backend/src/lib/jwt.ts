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
