// User-facing points routes (PRD FR11). All self-scoped: userId is taken from the session, never
// the client (tech-spec §10). Behind requireAuth.
import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { getBalances, hasCustomerReward, listLedger, toLedgerEntry } from '../lib/ledger'
import { parsePage } from '../lib/pagination'
import type { LedgerType, Wallet } from '../domain/points/types'
import type { AppEnv } from '../types'

const LEDGER_TYPES: readonly LedgerType[] = [
  'REGISTRATION_BONUS', 'REFERRAL_SIGNUP_BONUS', 'MAINTENANCE_ACCRUAL', 'MAINTENANCE_RESET',
  'CUSTOMER_REWARD', 'CUSTOMER_REFERRAL_BONUS', 'REDEMPTION',
]

export const pointsRoutes = new Hono<AppEnv>()

pointsRoutes.use('*', requireAuth)

pointsRoutes.get('/balances', async (c) => {
  const user = c.get('user')!
  const [balances, unlocked] = await Promise.all([
    getBalances(c.env.DB, user.id),
    hasCustomerReward(c.env.DB, user.id),
  ])
  return c.json({ ...balances, redemptionUnlocked: unlocked })
})

pointsRoutes.get('/ledger', async (c) => {
  const user = c.get('user')!
  const wallet = c.req.query('wallet')
  const type = c.req.query('type')
  if (wallet !== undefined && wallet !== 'F' && wallet !== 'G') return c.json({ error: 'invalid wallet' }, 400)
  if (type !== undefined && !LEDGER_TYPES.includes(type as LedgerType)) return c.json({ error: 'invalid type' }, 400)

  const { page, limit } = parsePage(c.req.query('page'), c.req.query('limit'))
  const { rows, total } = await listLedger(c.env.DB, {
    userId: user.id,
    wallet: wallet as Wallet | undefined,
    type: type as LedgerType | undefined,
    from: c.req.query('from'),
    to: c.req.query('to'),
    page,
    limit,
  })
  return c.json({ entries: rows.map(toLedgerEntry), page, limit, total })
})
