import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import worker from '../src/index'
import { runMaintenance } from '../src/lib/maintenance'
import { anniversaryDate } from '../src/domain/points/periods'

const REG = '2026-01-15T00:00:00.000Z'
const reg = new Date(REG)

// Seed a USER directly (no HTTP) so we control created_at precisely; no registration bonuses.
async function seedUser(createdAt: string): Promise<string> {
  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO users (id, full_name, phone, password_hash, role, referrer_id, referral_code, is_active, created_at)
     VALUES (?, 'U', ?, 'x', 'USER', NULL, ?, 1, ?)`,
  )
    .bind(id, id, id, createdAt)
    .run()
  return id
}

async function seedApprovedOrder(userId: string, decidedAt: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO orders (id, user_id, note, status, decided_by, decided_at, created_at)
     VALUES (?, ?, NULL, 'APPROVED', ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), userId, userId, decidedAt, decidedAt)
    .run()
}

async function gBalance(userId: string): Promise<number> {
  const row = await env.DB
    .prepare(`SELECT COALESCE(SUM(points),0) AS g FROM point_ledger WHERE user_id = ? AND wallet = 'G'`)
    .bind(userId)
    .first<{ g: number }>()
  return row?.g ?? 0
}

describe('runMaintenance', () => {
  it('accrues +10 for a one-month-old user', async () => {
    const id = await seedUser(REG)
    await runMaintenance(env.DB, anniversaryDate(reg, 1))
    expect(await gBalance(id)).toBe(10)
  })

  it('a 4-month-old dry user gets reset-then-accrue, ending at G = 10', async () => {
    const id = await seedUser(REG)
    await runMaintenance(env.DB, anniversaryDate(reg, 4))
    // periods 1–3 accrue (30), period 4 resets to 0 then accrues → 10
    expect(await gBalance(id)).toBe(10)
  })

  it('a user with an approved order inside the window keeps accumulating', async () => {
    const id = await seedUser(REG)
    await seedApprovedOrder(id, anniversaryDate(reg, 2).toISOString()) // inside period-4 window
    await runMaintenance(env.DB, anniversaryDate(reg, 4))
    expect(await gBalance(id)).toBe(40) // no reset: 10 × 4
  })

  it('is idempotent — running twice with the same now is a no-op', async () => {
    const id = await seedUser(REG)
    const now = anniversaryDate(reg, 4)
    await runMaintenance(env.DB, now)
    const afterFirst = await gBalance(id)
    await runMaintenance(env.DB, now)
    expect(await gBalance(id)).toBe(afterFirst)
  })

  it('catches up over several missed periods in one run', async () => {
    const id = await seedUser(REG)
    await runMaintenance(env.DB, anniversaryDate(reg, 1)) // period 1 → G = 10
    expect(await gBalance(id)).toBe(10)
    await runMaintenance(env.DB, anniversaryDate(reg, 3)) // periods 2,3 → G = 30
    expect(await gBalance(id)).toBe(30)
  })

  it('skips SUPER_ADMIN accounts', async () => {
    const id = crypto.randomUUID()
    await env.DB.prepare(
      `INSERT INTO users (id, full_name, phone, password_hash, role, referrer_id, referral_code, is_active, created_at)
       VALUES (?, 'Admin', '0900000000', 'x', 'SUPER_ADMIN', NULL, '0900000000', 1, ?)`,
    )
      .bind(id, REG)
      .run()
    await runMaintenance(env.DB, anniversaryDate(reg, 2))
    expect(await gBalance(id)).toBe(0)
  })

  it('smoke: the scheduled() handler wires through to runMaintenance', async () => {
    const id = await seedUser(REG)
    const ctx = createExecutionContext()
    await worker.scheduled!(
      { scheduledTime: anniversaryDate(reg, 1).getTime(), cron: '0 1 * * *', noRetry() {} },
      env,
      ctx,
    )
    await waitOnExecutionContext(ctx)
    expect(await gBalance(id)).toBe(10)
  })
})
