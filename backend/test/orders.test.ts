import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { get, post, registerUser, seedAdmin } from './helpers'

async function ledgerCount(): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM point_ledger').first<{ n: number }>()
  return row?.n ?? 0
}

async function balanceF(token: string): Promise<number> {
  const res = await get('/api/points/balances', token)
  const { f } = await res.json<{ f: number }>()
  return f
}

describe('order lifecycle', () => {
  it('creates an order, enforces the 5-pending cap', async () => {
    const admin = await seedAdmin()
    const a = await registerUser(admin.referralCode, '0912345678')

    for (let i = 0; i < 5; i++) {
      const res = await post('/api/orders', { note: `order ${i}` }, a.token)
      expect(res.status).toBe(201)
    }
    const sixth = await post('/api/orders', {}, a.token)
    expect(sixth.status).toBe(409)
    expect((await sixth.json<{ code: string }>()).code).toBe('PENDING_LIMIT')
  })

  it('SUPER_ADMIN cannot create orders (403)', async () => {
    const admin = await seedAdmin()
    const res = await post('/api/orders', { note: 'x' }, admin.token)
    expect(res.status).toBe(403)
  })

  it('approve pays +50 creator / +10 referrer to the F wallet', async () => {
    const admin = await seedAdmin()
    const a = await registerUser(admin.referralCode, '0912345678') // A: +10 reg, +2 (B signs up)
    const b = await registerUser(a.referralCode, '0987654321') // B: +10 reg

    const create = await post('/api/orders', { note: 'went abroad' }, b.token)
    const { order } = await create.json<{ order: { id: string } }>()

    const approve = await post(`/api/admin/orders/${order.id}/approve`, undefined, admin.token)
    expect(approve.status).toBe(200)
    expect((await approve.json<{ order: { status: string } }>()).order.status).toBe('APPROVED')

    expect(await balanceF(b.token)).toBe(60) // 10 + 50
    expect(await balanceF(a.token)).toBe(22) // 10 + 2 + 10
  })

  it('approval pays no referrer bonus when the creator\'s referrer is the admin (A2)', async () => {
    const admin = await seedAdmin()
    const a = await registerUser(admin.referralCode, '0912345678') // referrer = admin
    const { order } = await (await post('/api/orders', {}, a.token)).json<{ order: { id: string } }>()
    await post(`/api/admin/orders/${order.id}/approve`, undefined, admin.token)

    expect(await balanceF(a.token)).toBe(60) // 10 registration + 50 reward; no admin referral leg
    const res = await get(`/api/admin/ledger?userId=${admin.id}&type=CUSTOMER_REFERRAL_BONUS`, admin.token)
    expect((await res.json<{ total: number }>()).total).toBe(0)
  })

  it('double-approve is a 409 with no extra ledger rows', async () => {
    const admin = await seedAdmin()
    const a = await registerUser(admin.referralCode, '0912345678')
    const b = await registerUser(a.referralCode, '0987654321')
    const { order } = await (await post('/api/orders', {}, b.token)).json<{ order: { id: string } }>()

    await post(`/api/admin/orders/${order.id}/approve`, undefined, admin.token)
    const countAfterFirst = await ledgerCount()

    const second = await post(`/api/admin/orders/${order.id}/approve`, undefined, admin.token)
    expect(second.status).toBe(409)
    expect((await second.json<{ code: string }>()).code).toBe('ALREADY_DECIDED')
    expect(await ledgerCount()).toBe(countAfterFirst)
  })

  it('reject pays nothing, and approve-after-reject is a 409', async () => {
    const admin = await seedAdmin()
    const a = await registerUser(admin.referralCode, '0912345678')
    const b = await registerUser(a.referralCode, '0987654321')
    const { order } = await (await post('/api/orders', {}, b.token)).json<{ order: { id: string } }>()

    const reject = await post(`/api/admin/orders/${order.id}/reject`, undefined, admin.token)
    expect(reject.status).toBe(200)
    expect(await balanceF(b.token)).toBe(10) // registration only, no reward

    const approve = await post(`/api/admin/orders/${order.id}/approve`, undefined, admin.token)
    expect(approve.status).toBe(409)
  })

  it('IDOR: a user fetching another user\'s order gets 404, not 403', async () => {
    const admin = await seedAdmin()
    const a = await registerUser(admin.referralCode, '0912345678')
    const b = await registerUser(admin.referralCode, '0987654321')
    const { order } = await (await post('/api/orders', {}, a.token)).json<{ order: { id: string } }>()

    const res = await get(`/api/orders/${order.id}`, b.token)
    expect(res.status).toBe(404)
  })
})
