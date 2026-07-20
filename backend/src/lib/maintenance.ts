// Monthly maintenance engine (tech-spec §6.4). Directly testable: takes `now: Date`, no cron
// harness. Idempotent by (user, period) under R3, self-healing after missed runs, isolated per user.
import { POINTS } from '../domain/points/constants'
import { planMaintenance } from '../domain/points/maintenance'
import type { MaintenancePlanItem } from '../domain/points/types'

export async function runMaintenance(db: D1Database, now: Date): Promise<void> {
  const nowIso = now.toISOString()

  // Three cheap bulk queries assembled in JS — fine at <1,000 users (tech-spec §6.4.1).
  const { results: users } = await db
    .prepare(`SELECT id, created_at FROM users WHERE role = 'USER'`)
    .all<{ id: string; created_at: string }>()

  const { results: accruals } = await db
    .prepare(
      `SELECT user_id, MAX(period_index) AS n FROM point_ledger
       WHERE type = 'MAINTENANCE_ACCRUAL' GROUP BY user_id`,
    )
    .all<{ user_id: string; n: number }>()
  const lastAccruedByUser = new Map(accruals.map((r) => [r.user_id, r.n]))

  const { results: approved } = await db
    .prepare(`SELECT user_id, decided_at FROM orders WHERE status = 'APPROVED'`)
    .all<{ user_id: string; decided_at: string }>()
  const approvedDatesByUser = new Map<string, Date[]>()
  for (const r of approved) {
    const list = approvedDatesByUser.get(r.user_id) ?? []
    list.push(new Date(r.decided_at))
    approvedDatesByUser.set(r.user_id, list)
  }

  for (const user of users) {
    // Failure isolation: one bad user never sinks the run; the next daily pass retries idempotently.
    try {
      const plan = planMaintenance({
        registeredAt: new Date(user.created_at),
        lastAccruedPeriod: lastAccruedByUser.get(user.id) ?? 0,
        approvedOrderDates: approvedDatesByUser.get(user.id) ?? [],
        now,
      })
      // Ascending order matters: each period's reset amount is the G balance at that point.
      for (const item of plan) {
        await applyPeriod(db, user.id, item, nowIso)
      }
    } catch (err) {
      console.error(`maintenance failed for user ${user.id}`, err)
    }
  }
}

// One (user, period): reset-then-accrue in a single transaction. Reset amount is computed
// in-transaction so it zeroes exactly the pre-accrual balance; the +10 always follows (PRD §6.4).
async function applyPeriod(db: D1Database, userId: string, item: MaintenancePlanItem, nowIso: string): Promise<void> {
  const statements: D1PreparedStatement[] = []

  if (item.resetRequired) {
    // Skipped entirely when G <= 0 (no zero-point rows, which would violate points <> 0; A8).
    statements.push(
      db
        .prepare(
          `INSERT INTO point_ledger (id, user_id, wallet, type, points, period_index, created_at)
           SELECT ?, ?, 'G', 'MAINTENANCE_RESET',
                  -(SELECT SUM(points) FROM point_ledger WHERE user_id = ? AND wallet = 'G'),
                  ?, ?
           WHERE (SELECT COALESCE(SUM(points),0) FROM point_ledger WHERE user_id = ? AND wallet = 'G') > 0`,
        )
        .bind(crypto.randomUUID(), userId, userId, item.periodIndex, nowIso, userId),
    )
  }

  // Plain INSERT (not OR IGNORE): a cron-overlap duplicate violates R3 and rolls back the whole
  // (user, period) batch — including the reset — which we classify as already-processed below.
  statements.push(
    db
      .prepare(
        `INSERT INTO point_ledger (id, user_id, wallet, type, points, period_index, created_at)
         VALUES (?, ?, 'G', 'MAINTENANCE_ACCRUAL', ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), userId, POINTS.MAINTENANCE, item.periodIndex, nowIso),
  )

  try {
    await db.batch(statements)
  } catch (err) {
    // R3 (uq_ledger_user_period_type) → this period is already done (overlap/catch-up). Swallow it;
    // any OTHER constraint failure stays loud.
    if (isAlreadyProcessed(err)) return
    throw err
  }
}

// D1 reports a UNIQUE violation by the columns involved ("...point_ledger.user_id,
// point_ledger.period_index, point_ledger.type"), not the partial index name; some builds may name
// the index instead. Match either form, scoped to a UNIQUE failure so a CHECK error on
// period_index can never be misread as "already processed". Pinned by test/constraints.test.ts.
function isAlreadyProcessed(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('uq_ledger_user_period_type') ||
    (msg.includes('UNIQUE constraint failed') && msg.includes('period_index'))
  )
}
