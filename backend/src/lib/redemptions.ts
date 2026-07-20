// Redemption: the admin deducts points for cash already paid outside the system. The guarded
// batch is the authority on unlock + sufficiency; validateRedemption only pre-flights a friendly
// message (tech-spec §6.2). A negative balance is structurally impossible under the single writer.
import { validateRedemption } from '../domain/points/redemption'
import type { Wallet } from '../domain/points/types'
import { getBalances, hasCustomerReward, toAdminLedgerEntry, type AdminLedgerEntry, type LedgerRow } from './ledger'

export interface RedeemInput {
  userId: string
  f?: number // positive integer (ArkType-validated upstream)
  g?: number
  note: string | null
  idempotencyKey: string
  adminId: string
  now: string
}

export type RedeemResult =
  | { ok: true; entries: AdminLedgerEntry[]; balances: { f: number; g: number } }
  | { ok: false; error: 'LOCKED' | 'INSUFFICIENT_BALANCE' | 'DUPLICATE' }

export async function redeem(db: D1Database, input: RedeemInput): Promise<RedeemResult> {
  const { userId, f, g, note, idempotencyKey, adminId, now } = input

  // Idempotency first: a key already on the ledger means this is a replay of a committed
  // redemption. Report DUPLICATE regardless of the current balance — otherwise a retry after the
  // original succeeded (which lowered the balance) would be masked as INSUFFICIENT_BALANCE. R4
  // remains the backstop for the concurrent case where neither submit has committed yet.
  const replay = await db
    .prepare(`SELECT 1 AS x FROM point_ledger WHERE idempotency_key = ? LIMIT 1`)
    .bind(idempotencyKey)
    .first()
  if (replay) return { ok: false, error: 'DUPLICATE' }

  // Pre-flight for a specific error message. The SQL guards below are the real authority.
  const pre = validateRedemption({
    hasCustomerReward: await hasCustomerReward(db, userId),
    balances: await getBalances(db, userId),
    amounts: { f, g },
  })
  if (!pre.ok) return { ok: false, error: pre.error === 'LOCKED' ? 'LOCKED' : 'INSUFFICIENT_BALANCE' }

  const wallets: Wallet[] = []
  if (f !== undefined) wallets.push('F')
  if (g !== undefined) wallets.push('G')
  const amount: Record<Wallet, number> = { F: f ?? 0, G: g ?? 0 }
  const rowId: Record<Wallet, string> = { F: crypto.randomUUID(), G: crypto.randomUUID() }
  const [first, ...rest] = wallets

  const statements: D1PreparedStatement[] = [
    // First row carries ALL guards for the whole redemption: unlock + both wallets sufficient.
    // The absent wallet's amount is 0, so its guard (SUM >= 0) is trivially true.
    db
      .prepare(
        `INSERT INTO point_ledger
           (id, user_id, wallet, type, points, idempotency_key, note, created_by, created_at)
         SELECT ?, ?, ?, 'REDEMPTION', ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM point_ledger WHERE user_id = ? AND type = 'CUSTOMER_REWARD')
           AND (SELECT COALESCE(SUM(points),0) FROM point_ledger WHERE user_id = ? AND wallet = 'F') >= ?
           AND (SELECT COALESCE(SUM(points),0) FROM point_ledger WHERE user_id = ? AND wallet = 'G') >= ?`,
      )
      .bind(
        rowId[first], userId, first, -amount[first], idempotencyKey, note, adminId, now,
        userId, userId, amount.F, userId, amount.G,
      ),
    // Second wallet (if any) fires iff the first row committed — chained on its concrete id.
    ...rest.map((w) =>
      db
        .prepare(
          `INSERT INTO point_ledger
             (id, user_id, wallet, type, points, idempotency_key, note, created_by, created_at)
           SELECT ?, ?, ?, 'REDEMPTION', ?, ?, ?, ?, ?
           WHERE EXISTS (SELECT 1 FROM point_ledger WHERE id = ?)`,
        )
        .bind(rowId[w], userId, w, -amount[w], idempotencyKey, note, adminId, now, rowId[first]),
    ),
  ]

  let results: D1Result[]
  try {
    results = await db.batch(statements)
  } catch (err) {
    if (isDuplicateRedemption(err)) return { ok: false, error: 'DUPLICATE' }
    throw err
  }

  // All-or-nothing: the last statement chains on the first, so if it wrote nothing, nothing landed.
  if (results[results.length - 1].meta.changes === 0) {
    // A race changed the state between pre-flight and commit — re-derive the reason.
    return { ok: false, error: (await hasCustomerReward(db, userId)) ? 'INSUFFICIENT_BALANCE' : 'LOCKED' }
  }

  const ids = wallets.map((w) => rowId[w])
  const { results: rows } = await db
    .prepare(`SELECT * FROM point_ledger WHERE id IN (${ids.map(() => '?').join(', ')}) ORDER BY wallet`)
    .bind(...ids)
    .all<LedgerRow>()

  return { ok: true, entries: rows.map(toAdminLedgerEntry), balances: await getBalances(db, userId) }
}

// R4 (uq_ledger_idem) rejects a replayed idempotencyKey → whole batch rolls back (tech-spec §6.2).
// D1 reports the violation by columns ("...point_ledger.idempotency_key, point_ledger.wallet"), not
// the partial index name; match either form, scoped to a UNIQUE failure so the linkage CHECK on
// idempotency_key can't be misread as a replay. Pinned by test/constraints.test.ts.
function isDuplicateRedemption(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('uq_ledger_idem') ||
    (msg.includes('UNIQUE constraint failed') && msg.includes('idempotency_key'))
  )
}
