// User-facing order routes (PRD FR9/FR10). Behind requireAuth; SUPER_ADMIN cannot create orders.
import { Hono } from 'hono'
import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { requireAuth } from '../middleware/auth'
import { createOrder, findOrderByIdForUser, listOrders, toOrder } from '../lib/orders'
import { parsePage } from '../lib/pagination'
import type { OrderStatus } from '../domain/points/types'
import type { AppEnv } from '../types'

const ORDER_STATUSES: readonly OrderStatus[] = ['PENDING', 'APPROVED', 'REJECTED']

// Only `note` is accepted; extra keys (e.g. a smuggled status/userId) hard-fail 400 (tech-spec §10).
const createOrderSchema = type({ 'note?': 'string <= 500' }).onUndeclaredKey('reject')

export const orderRoutes = new Hono<AppEnv>()

orderRoutes.use('*', requireAuth)

orderRoutes.post('/', arktypeValidator('json', createOrderSchema), async (c) => {
  const user = c.get('user')!
  if (user.role === 'SUPER_ADMIN') return c.json({ error: 'admins cannot create orders' }, 403)

  const { note } = c.req.valid('json')
  const now = new Date().toISOString()
  const result = await createOrder(c.env.DB, user.id, note ?? null, now)
  if (!result.ok) return c.json({ error: 'too many pending orders', code: 'PENDING_LIMIT' }, 409)
  return c.json({ order: result.order }, 201)
})

orderRoutes.get('/', async (c) => {
  const user = c.get('user')!
  const status = c.req.query('status')
  if (status !== undefined && !ORDER_STATUSES.includes(status as OrderStatus)) {
    return c.json({ error: 'invalid status' }, 400)
  }

  const { page, limit } = parsePage(c.req.query('page'), c.req.query('limit'))
  const { rows, total } = await listOrders(c.env.DB, {
    userId: user.id, // self-scoped
    status: status as OrderStatus | undefined,
    page,
    limit,
  })
  return c.json({ orders: rows.map(toOrder), page, limit, total })
})

orderRoutes.get('/:id', async (c) => {
  const user = c.get('user')!
  // A foreign order id returns 404, not 403 — no existence leak (tech-spec §10).
  const row = await findOrderByIdForUser(c.env.DB, c.req.param('id'), user.id)
  if (!row) return c.json({ error: 'not found' }, 404)
  return c.json({ order: toOrder(row) })
})
