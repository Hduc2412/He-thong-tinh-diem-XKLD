import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { get, post, registerUser, seedAdmin } from './helpers'

async function ledgerCount(): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM point_ledger').first<{ n: number }>()
  return row?.n ?? 0
}

describe('registration bonuses', () => {
  it('credits +10 to the new user and +2 to the referrer, atomically', async () => {
    const admin = await seedAdmin() // SUPER_ADMIN earns no points
    const a = await registerUser(admin.referralCode, '0912345678') // A +10
    const b = await registerUser(a.referralCode, '0987654321') // B +10, A +2

    const aBal = await (await get('/api/points/balances', a.token)).json<{ f: number; g: number; redemptionUnlocked: boolean }>()
    expect(aBal).toEqual({ f: 12, g: 0, redemptionUnlocked: false })

    const bBal = await (await get('/api/points/balances', b.token)).json<{ f: number }>()
    expect(bBal.f).toBe(10)
  })

  it('pays no REFERRAL_SIGNUP_BONUS when the referrer is the SUPER_ADMIN (A2)', async () => {
    const admin = await seedAdmin()
    await registerUser(admin.referralCode, '0912345678') // registers directly under the admin
    const res = await get(`/api/admin/ledger?userId=${admin.id}&type=REFERRAL_SIGNUP_BONUS`, admin.token)
    expect((await res.json<{ total: number }>()).total).toBe(0)
  })

  it('a duplicate-phone registration is a 409 and leaves no orphan ledger rows', async () => {
    const admin = await seedAdmin()
    await registerUser(admin.referralCode, '0912345678')
    const before = await ledgerCount()

    const dup = await post('/api/auth/register', {
      fullName: 'Dup', phone: '0912345678', password: 'userpass123', referralCode: admin.referralCode,
    })
    expect(dup.status).toBe(409)
    expect(await ledgerCount()).toBe(before)
  })
})

describe('ledger listing', () => {
  it('is self-scoped — a user never sees another user\'s rows', async () => {
    const admin = await seedAdmin()
    const a = await registerUser(admin.referralCode, '0912345678')
    await registerUser(a.referralCode, '0987654321') // gives A a REFERRAL_SIGNUP_BONUS row

    const res = await get('/api/points/ledger', a.token)
    const { entries, total } = await res.json<{ entries: { userId: string; type: string }[]; total: number }>()
    expect(total).toBe(2) // REGISTRATION_BONUS + REFERRAL_SIGNUP_BONUS
    expect(entries.every((e) => e.userId === a.id)).toBe(true)
  })

  it('filters by wallet and rejects an invalid wallet', async () => {
    const admin = await seedAdmin()
    const a = await registerUser(admin.referralCode, '0912345678')

    const gOnly = await get('/api/points/ledger?wallet=G', a.token)
    expect((await gOnly.json<{ total: number }>()).total).toBe(0) // all registration rows are F

    const bad = await get('/api/points/ledger?wallet=X', a.token)
    expect(bad.status).toBe(400)
  })
})
