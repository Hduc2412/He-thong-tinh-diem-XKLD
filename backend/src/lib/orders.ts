// Orders repository: creation (with the PENDING cap), lookups, listing, and the approve/reject
// batches that atomically flip status and emit F-wallet bonuses (tech-spec §6.1).
import { MAX_PENDING_ORDERS, POINTS } from '../domain/points/constants'
import type { OrderStatus } from '../domain/points/types'

export interface OrderRow {
  id: string
  user_id: string
  note: string | null
  status: OrderStatus
  decided_by: string | null
  decided_at: string | null
  created_at: string
}

export interface Order {
  id: string
  userId: string
  note: string | null
  status: OrderStatus
  decidedBy: string | null
  decidedAt: string | null
  createdAt: string
}

export function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.user_id,
    note: row.note,
    status: row.status,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  }
}

export function findOrderById(db: D1Database, id: string): Promise<OrderRow | null> {
  return db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRow>()
}

/** Ownership baked into SQL: a foreign id returns null → the route maps to 404 (no leak, §10). */
export function findOrderByIdForUser(db: D1Database, id: string, userId: string): Promise<OrderRow | null> {
  return db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').bind(id, userId).first<OrderRow>()
}

export type CreateOrderResult = { ok: true; order: Order } | { ok: false; error: 'PENDING_LIMIT' }

/** Create a PENDING order, guarded so a user never exceeds MAX_PENDING_ORDERS concurrent ones (A9). */
export async function createOrder(
  db: D1Database,
  userId: string,
  note: string | null,
  now: string,
): Promise<CreateOrderResult> {
  const id = crypto.randomUUID()
  const res = await db
    .prepare(
      `INSERT INTO orders (id, user_id, note, status, created_at)
       SELECT ?, ?, ?, 'PENDING', ?
       WHERE (SELECT COUNT(*) FROM orders WHERE user_id = ? AND status = 'PENDING') < ?`,
    )
    .bind(id, userId, note, now, userId, MAX_PENDING_ORDERS)
    .run()

  if (res.meta.changes === 0) return { ok: false, error: 'PENDING_LIMIT' }
  return {
    ok: true,
    order: { id, userId, note, status: 'PENDING', decidedBy: null, decidedAt: null, createdAt: now },
  }
}

export interface OrderFilter {
  userId?: string // admin filter; omitted = all users
  status?: OrderStatus
  page: number
  limit: number
}

export async function listOrders(db: D1Database, filter: OrderFilter): Promise<{ rows: OrderRow[]; total: number }> {
  const where: string[] = []
  const args: unknown[] = []
  if (filter.userId) {
    where.push('user_id = ?')
    args.push(filter.userId)
  }
  if (filter.status) {
    where.push('status = ?')
    args.push(filter.status)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM orders ${whereSql}`)
    .bind(...args)
    .first<{ n: number }>()

  const offset = (filter.page - 1) * filter.limit
  const { results } = await db
    .prepare(`SELECT * FROM orders ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .bind(...args, filter.limit, offset)
    .all<OrderRow>()

  return { rows: results, total: totalRow?.n ?? 0 }
}

export type DecideResult =
  | { ok: true; order: Order }
  | { ok: false; error: 'NOT_FOUND' }
  | { ok: false; error: 'ALREADY_DECIDED'; status: OrderStatus }

/**
 * Reject: flip PENDING→REJECTED, no ledger rows. One guarded UPDATE; changes===0 means the order
 * is gone or already decided.
 */
export async function rejectOrder(db: D1Database, orderId: string, adminId: string, now: string): Promise<DecideResult> {
  const res = await db
    .prepare(`UPDATE orders SET status = 'REJECTED', decided_by = ?, decided_at = ? WHERE id = ? AND status = 'PENDING'`)
    .bind(adminId, now, orderId)
    .run()
  return finishDecision(db, orderId, res.meta.changes)
}

/**
 * Approve: one batch that flips status and pays +50 (creator) / +10 (referrer, if any). S2/S3 are
 * conditional inserts guarded on THIS batch's own flip (decided_at = our ?now), so a double-approve
 * writes zero rows and every point row is chained to exactly one real flip (tech-spec §6.1).
 */
export async function approveOrder(db: D1Database, orderId: string, adminId: string, now: string): Promise<DecideResult> {
  const results = await db.batch([
    // S1: flip status, guarded on PENDING
    db
      .prepare(`UPDATE orders SET status = 'APPROVED', decided_by = ?, decided_at = ? WHERE id = ? AND status = 'PENDING'`)
      .bind(adminId, now, orderId),
    // S2: +50 to the creator
    db
      .prepare(
        `INSERT INTO point_ledger (id, user_id, wallet, type, points, order_id, created_at)
         SELECT ?, o.user_id, 'F', 'CUSTOMER_REWARD', ?, o.id, ?
         FROM orders o WHERE o.id = ? AND o.status = 'APPROVED' AND o.decided_at = ?`,
      )
      .bind(crypto.randomUUID(), POINTS.CUSTOMER_REWARD, now, orderId, now),
    // S3: +10 to the direct referrer — only when the creator has one AND that referrer is a USER.
    // A SUPER_ADMIN referrer records the link but earns no points (A2); the JOIN to r also excludes
    // a null referrer_id. Deactivated USER referrers still earn (A3), so is_active is not filtered.
    db
      .prepare(
        `INSERT INTO point_ledger (id, user_id, wallet, type, points, order_id, created_at)
         SELECT ?, r.id, 'F', 'CUSTOMER_REFERRAL_BONUS', ?, o.id, ?
         FROM orders o
         JOIN users u ON u.id = o.user_id
         JOIN users r ON r.id = u.referrer_id
         WHERE o.id = ? AND o.status = 'APPROVED' AND o.decided_at = ? AND r.role = 'USER'`,
      )
      .bind(crypto.randomUUID(), POINTS.CUSTOMER_REFERRAL, now, orderId, now),
  ])
  return finishDecision(db, orderId, results[0].meta.changes)
}

// Shared tail: on a successful flip re-read the row; otherwise classify NOT_FOUND vs ALREADY_DECIDED.
async function finishDecision(db: D1Database, orderId: string, flipped: number): Promise<DecideResult> {
  const row = await findOrderById(db, orderId)
  if (!row) return { ok: false, error: 'NOT_FOUND' }
  if (flipped === 1) return { ok: true, order: toOrder(row) }
  return { ok: false, error: 'ALREADY_DECIDED', status: row.status }
}
