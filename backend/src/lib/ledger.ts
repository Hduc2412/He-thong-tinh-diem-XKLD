// Ledger repository: derived balances, the unlock check, history listing, and the shared
// draft→statement helper. Balances are always summed from point_ledger, never stored (PRD §5).
import type { LedgerDraft, LedgerType, Wallet } from '../domain/points/types'

// Raw DB row (snake_case, all nullable reference columns).
export interface LedgerRow {
  id: string
  user_id: string
  wallet: Wallet
  type: LedgerType
  points: number
  order_id: string | null
  subject_user_id: string | null
  period_index: number | null
  idempotency_key: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

// User-facing shape (PRD §8): no subjectUserId / idempotencyKey.
export interface LedgerEntry {
  id: string
  userId: string
  wallet: Wallet
  type: LedgerType
  points: number
  orderId: string | null
  periodIndex: number | null
  note: string | null
  createdBy: string | null
  createdAt: string
}

// Admin shape adds the two internal linkage columns.
export interface AdminLedgerEntry extends LedgerEntry {
  subjectUserId: string | null
  idempotencyKey: string | null
}

export function toLedgerEntry(row: LedgerRow): LedgerEntry {
  return {
    id: row.id,
    userId: row.user_id,
    wallet: row.wallet,
    type: row.type,
    points: row.points,
    orderId: row.order_id,
    periodIndex: row.period_index,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export function toAdminLedgerEntry(row: LedgerRow): AdminLedgerEntry {
  return {
    ...toLedgerEntry(row),
    subjectUserId: row.subject_user_id,
    idempotencyKey: row.idempotency_key,
  }
}

/** Derived F & G balances for a user (covering index makes this touch no table rows). */
export async function getBalances(db: D1Database, userId: string): Promise<{ f: number; g: number }> {
  const { results } = await db
    .prepare(
      `SELECT wallet, COALESCE(SUM(points), 0) AS total
       FROM point_ledger WHERE user_id = ? GROUP BY wallet`,
    )
    .bind(userId)
    .all<{ wallet: Wallet; total: number }>()

  let f = 0
  let g = 0
  for (const r of results) {
    if (r.wallet === 'F') f = r.total
    else if (r.wallet === 'G') g = r.total
  }
  return { f, g }
}

/** Redemption unlock (PRD §6.5.1): has the user ever earned a CUSTOMER_REWARD? Permanent once true. */
export async function hasCustomerReward(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 AS x FROM point_ledger WHERE user_id = ? AND type = 'CUSTOMER_REWARD' LIMIT 1`)
    .bind(userId)
    .first()
  return row !== null
}

/** Highest accrued maintenance period for a user, or 0 if none yet (feeds planMaintenance). */
export async function maxAccruedPeriod(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(MAX(period_index), 0) AS n
       FROM point_ledger WHERE user_id = ? AND type = 'MAINTENANCE_ACCRUAL'`,
    )
    .bind(userId)
    .first<{ n: number }>()
  return row?.n ?? 0
}

export interface LedgerFilter {
  userId?: string // omitted = all users (admin ledger); user routes always pass their own id
  wallet?: Wallet
  type?: LedgerType
  from?: string // ISO, inclusive
  to?: string // ISO, exclusive
  page: number
  limit: number
}

/** Paginated ledger history (created_at DESC, id DESC), optionally scoped to one user. */
export async function listLedger(db: D1Database, filter: LedgerFilter): Promise<{ rows: LedgerRow[]; total: number }> {
  const where: string[] = []
  const args: unknown[] = []
  if (filter.userId) {
    where.push('user_id = ?')
    args.push(filter.userId)
  }
  if (filter.wallet) {
    where.push('wallet = ?')
    args.push(filter.wallet)
  }
  if (filter.type) {
    where.push('type = ?')
    args.push(filter.type)
  }
  if (filter.from) {
    where.push('created_at >= ?')
    args.push(filter.from)
  }
  if (filter.to) {
    where.push('created_at < ?')
    args.push(filter.to)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM point_ledger ${whereSql}`)
    .bind(...args)
    .first<{ n: number }>()

  const offset = (filter.page - 1) * filter.limit
  const { results } = await db
    .prepare(
      `SELECT * FROM point_ledger ${whereSql}
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .bind(...args, filter.limit, offset)
    .all<LedgerRow>()

  return { rows: results, total: totalRow?.n ?? 0 }
}

/**
 * Turn a fixed-amount draft into a plain INSERT statement (used inside batches — registration
 * bonuses in §6.3). Resets and order-approval guards are NOT built here; they are conditional
 * writes assembled in their own lib functions (tech-spec §1.1 rule 2, §6.1).
 */
export function draftToStatement(db: D1Database, draft: LedgerDraft, now: string): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO point_ledger
         (id, user_id, wallet, type, points, order_id, subject_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      draft.userId,
      draft.wallet,
      draft.type,
      draft.points,
      draft.orderId ?? null,
      draft.subjectUserId ?? null,
      now,
    )
}
