import { Hono } from 'hono'
import { arktypeValidator } from '@hono/arktype-validator'
import { type } from 'arktype'
import { banUser, ConflictError, createUser, findById, listUsers, toAuthUser, unbanUser } from '../lib/users'
import { requireSuperAdmin } from '../middleware/auth'
import { approveOrder, listOrders, rejectOrder, toOrder } from '../lib/orders'
import { redeem } from '../lib/redemptions'
import { getBalances, hasCustomerReward, listLedger, toAdminLedgerEntry } from '../lib/ledger'
import { parsePage } from '../lib/pagination'
import { phone, fullName } from '../lib/validators'
import type { LedgerType, OrderStatus, Wallet } from '../domain/points/types'
import type { AppEnv } from '../types'

const ORDER_STATUSES: readonly OrderStatus[] = ['PENDING', 'APPROVED', 'REJECTED']
const LEDGER_TYPES: readonly LedgerType[] = [
  'REGISTRATION_BONUS', 'REFERRAL_SIGNUP_BONUS', 'MAINTENANCE_ACCRUAL', 'MAINTENANCE_RESET',
  'CUSTOMER_REWARD', 'CUSTOMER_REFERRAL_BONUS', 'REDEMPTION',
]

const createRootUserSchema = type({
  fullName,
  phone,
  password: 'string >= 8',
})

// At least one wallet amount; extra keys rejected (tech-spec §10). Amounts are positive integers.
const redemptionSchema = type({
  userId: 'string >= 1',
  'f?': 'number.integer > 0',
  'g?': 'number.integer > 0',
  'note?': 'string <= 500',
  idempotencyKey: 'string >= 1',
})
  .onUndeclaredKey('reject')
  .narrow((d, ctx) => (d.f !== undefined || d.g !== undefined ? true : ctx.mustBe('at least one of f or g')))

export const adminRoutes = new Hono<AppEnv>()

// Everything under /api/admin requires the super admin.
adminRoutes.use('*', requireSuperAdmin)

// Create a referrer-less "root" USER to seed the referral network (PRD FR1). Normal /register
// requires a referrer, so the very first users can only come from here.
adminRoutes.post('/users', arktypeValidator('json', createRootUserSchema), async (c) => {
  const { fullName, phone, password } = c.req.valid('json')
  try {
    const user = await createUser(c.env.DB, { fullName, phone, password, role: 'USER', referrerId: null })
    return c.json({ user }, 201)
  } catch (err) {
    if (err instanceof ConflictError && err.field === 'phone') {
      return c.json({ error: 'phone already registered' }, 409)
    }
    throw err
  }
})

// Browse/search all users (SUPER_ADMIN + USER rows). `q` matches a full_name/phone substring.
adminRoutes.get('/users', async (c) => {
  const { page, limit } = parsePage(c.req.query('page'), c.req.query('limit'))
  const { rows, total } = await listUsers(c.env.DB, { q: c.req.query('q'), page, limit })
  return c.json({ users: rows.map(toAuthUser), page, limit, total })
})

// Ban or unban a normal user manually. SUPER_ADMIN accounts are protected.
adminRoutes.post('/users/:id/ban', async (c) => {
  const result = await banUser(c.env.DB, c.req.param('id'))
  if (result === 'NOT_FOUND') return c.json({ error: 'user not found' }, 404)
  if (result === 'SUPER_ADMIN') return c.json({ error: 'super admin cannot be banned', code: 'SUPER_ADMIN_PROTECTED' }, 403)
  if (result === 'ALREADY_BANNED') return c.json({ error: 'user already banned', code: 'ALREADY_BANNED' }, 409)
  return c.json({ ok: true, userId: c.req.param('id'), isActive: false })
})

adminRoutes.post('/users/:id/unban', async (c) => {
  const result = await unbanUser(c.env.DB, c.req.param('id'))
  if (result === 'NOT_FOUND') return c.json({ error: 'user not found' }, 404)
  if (result === 'SUPER_ADMIN') return c.json({ error: 'super admin cannot be unbanned', code: 'SUPER_ADMIN_PROTECTED' }, 403)
  if (result === 'ALREADY_ACTIVE') return c.json({ error: 'user already active', code: 'ALREADY_ACTIVE' }, 409)
  return c.json({ ok: true, userId: c.req.param('id'), isActive: true })
})

// --- Orders (PRD FR2/FR3/FR4) ---

adminRoutes.get('/orders', async (c) => {
  const status = c.req.query('status')
  if (status !== undefined && !ORDER_STATUSES.includes(status as OrderStatus)) {
    return c.json({ error: 'invalid status' }, 400)
  }
  const { page, limit } = parsePage(c.req.query('page'), c.req.query('limit'))
  const { rows, total } = await listOrders(c.env.DB, {
    userId: c.req.query('userId'),
    status: status as OrderStatus | undefined,
    page,
    limit,
  })
  return c.json({ orders: rows.map(toOrder), page, limit, total })
})

adminRoutes.post('/orders/:id/approve', async (c) => {
  const admin = c.get('user')!
  const result = await approveOrder(c.env.DB, c.req.param('id'), admin.id, new Date().toISOString())
  if (result.ok) return c.json({ order: result.order })
  if (result.error === 'NOT_FOUND') return c.json({ error: 'not found' }, 404)
  return c.json({ error: 'order already decided', code: 'ALREADY_DECIDED', status: result.status }, 409)
})

adminRoutes.post('/orders/:id/reject', async (c) => {
  const admin = c.get('user')!
  const result = await rejectOrder(c.env.DB, c.req.param('id'), admin.id, new Date().toISOString())
  if (result.ok) return c.json({ order: result.order })
  if (result.error === 'NOT_FOUND') return c.json({ error: 'not found' }, 404)
  return c.json({ error: 'order already decided', code: 'ALREADY_DECIDED', status: result.status }, 409)
})

// --- Redemption (PRD FR5) ---

adminRoutes.post('/redemptions', arktypeValidator('json', redemptionSchema), async (c) => {
  const admin = c.get('user')!
  const { userId, f, g, note, idempotencyKey } = c.req.valid('json')

  // Unknown user → 404 before touching the ledger.
  if (!(await findById(c.env.DB, userId))) return c.json({ error: 'user not found' }, 404)

  const result = await redeem(c.env.DB, {
    userId, f, g, note: note ?? null, idempotencyKey, adminId: admin.id, now: new Date().toISOString(),
  })
  if (result.ok) return c.json({ entries: result.entries, balances: result.balances }, 201)
  if (result.error === 'DUPLICATE') return c.json({ error: 'duplicate redemption', code: 'DUPLICATE_REDEMPTION' }, 409)
  if (result.error === 'LOCKED') return c.json({ error: 'redemption locked', code: 'REDEMPTION_LOCKED' }, 422)
  return c.json({ error: 'insufficient balance', code: 'INSUFFICIENT_BALANCE' }, 422)
})

// --- Balances & ledger (PRD FR6/FR7) ---

adminRoutes.get('/users/:id/balances', async (c) => {
  const id = c.req.param('id')
  if (!(await findById(c.env.DB, id))) return c.json({ error: 'user not found' }, 404)
  const [balances, unlocked] = await Promise.all([getBalances(c.env.DB, id), hasCustomerReward(c.env.DB, id)])
  return c.json({ ...balances, redemptionUnlocked: unlocked })
})

adminRoutes.get('/ledger', async (c) => {
  const wallet = c.req.query('wallet')
  const type = c.req.query('type')
  if (wallet !== undefined && wallet !== 'F' && wallet !== 'G') return c.json({ error: 'invalid wallet' }, 400)
  if (type !== undefined && !LEDGER_TYPES.includes(type as LedgerType)) return c.json({ error: 'invalid type' }, 400)

  const { page, limit } = parsePage(c.req.query('page'), c.req.query('limit'))
  const { rows, total } = await listLedger(c.env.DB, {
    userId: c.req.query('userId'),
    wallet: wallet as Wallet | undefined,
    type: type as LedgerType | undefined,
    from: c.req.query('from'),
    to: c.req.query('to'),
    page,
    limit,
  })
  return c.json({ entries: rows.map(toAdminLedgerEntry), page, limit, total })
})
