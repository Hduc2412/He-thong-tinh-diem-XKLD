import { createMiddleware } from 'hono/factory'
import { getBearerToken, verifySession } from '../lib/jwt'
import { findById, toAuthUser, touchLastSeen } from '../lib/users'
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
        await touchLastSeen(c.env.DB, row.id, new Date().toISOString())
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
