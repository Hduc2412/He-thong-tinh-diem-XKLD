import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'

// These tests pin the D1 error-message substrings that lib/ matches on to classify constraint
// violations: isDuplicateRedemption (redemptions.ts), isAlreadyProcessed (maintenance.ts), and
// translateConflict (users.ts). Those detectors are correct against today's D1 behavior, but a
// Wrangler/D1 update that reworded constraint errors would silently turn a handled conflict into
// a 500. Asserting the raw message shape here makes that regression loud instead (Mike, PR review).

async function seedUser(id: string, phone: string, role = 'USER', referralCode = phone): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO users (id, full_name, phone, password_hash, role, referrer_id, referral_code, is_active, created_at)
     VALUES (?, 'U', ?, 'x', ?, NULL, ?, 1, '2026-01-01T00:00:00.000Z')`,
  )
    .bind(id, phone, role, referralCode)
    .run()
}

async function captureError(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn()
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
  throw new Error('expected the statement to throw a constraint violation')
}

describe('D1 constraint error message shapes (pinning the string-match detectors)', () => {
  it('R4 uq_ledger_idem: a duplicate (idempotency_key, wallet) is named in the error', async () => {
    const uid = crypto.randomUUID()
    await seedUser(uid, '0911111111')
    const key = crypto.randomUUID()
    const row = (id: string) =>
      env.DB.prepare(
        `INSERT INTO point_ledger (id, user_id, wallet, type, points, idempotency_key, created_at)
         VALUES (?, ?, 'F', 'REDEMPTION', -10, ?, '2026-01-01T00:00:00.000Z')`,
      ).bind(id, uid, key)

    await row(crypto.randomUUID()).run()
    const msg = await captureError(() => row(crypto.randomUUID()).run())
    expect(msg).toContain('UNIQUE constraint failed')
    expect(msg).toMatch(/uq_ledger_idem|idempotency_key/) // isDuplicateRedemption
  })

  it('R3 uq_ledger_user_period_type: a duplicate (user, period, type) is named in the error', async () => {
    const uid = crypto.randomUUID()
    await seedUser(uid, '0911111112')
    const row = (id: string) =>
      env.DB.prepare(
        `INSERT INTO point_ledger (id, user_id, wallet, type, points, period_index, created_at)
         VALUES (?, ?, 'G', 'MAINTENANCE_ACCRUAL', 10, 1, '2026-01-01T00:00:00.000Z')`,
      ).bind(id, uid)

    await row(crypto.randomUUID()).run()
    const msg = await captureError(() => row(crypto.randomUUID()).run())
    expect(msg).toContain('UNIQUE constraint failed')
    // D1 names the columns, not the partial index — isAlreadyProcessed must match this shape.
    expect(msg).toMatch(/uq_ledger_user_period_type|period_index/)
  })

  it('users.phone: a duplicate phone is named in the error', async () => {
    await seedUser(crypto.randomUUID(), '0911111113', 'USER', '0911111113')
    // Distinct referral_code so only the phone unique index collides.
    const msg = await captureError(() => seedUser(crypto.randomUUID(), '0911111113', 'USER', 'distinct-code'))
    expect(msg).toContain('UNIQUE constraint failed')
    expect(msg).toMatch(/users\.phone/) // translateConflict → ConflictError('phone')
  })

  it('one_super_admin: a second super admin is named in the error', async () => {
    await seedUser(crypto.randomUUID(), '0911111114', 'SUPER_ADMIN', '0911111114')
    const msg = await captureError(() => seedUser(crypto.randomUUID(), '0911111115', 'SUPER_ADMIN', '0911111115'))
    expect(msg).toContain('UNIQUE constraint failed')
    expect(msg).toMatch(/one_super_admin|users\.role/) // translateConflict → ConflictError('role')
  })
})
