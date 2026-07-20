import { env, SELF } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { createUser } from '../src/lib/users'

const BASE = 'https://example.com'

function post(path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  return SELF.fetch(`${BASE}${path}`, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined })
}

function patch(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  return SELF.fetch(`${BASE}${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
}

function get(path: string, token?: string) {
  return SELF.fetch(`${BASE}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} })
}

// Seed the singleton super admin directly via the shared createUser (same path seed:admin uses).
const ADMIN_PHONE = '0900000000'
const ADMIN_PASSWORD = 'adminpass123'
function seedAdmin() {
  return createUser(env.DB, {
    fullName: 'Super Admin',
    phone: ADMIN_PHONE,
    password: ADMIN_PASSWORD,
    role: 'SUPER_ADMIN',
    referrerId: null,
  })
}

describe('register', () => {
  it('registers a USER under a referrer and returns an auth token', async () => {
    const admin = await seedAdmin()
    const res = await post('/api/auth/register', {
      fullName: 'Nguyen Van A',
      phone: '0912345678',
      password: 'userpass123',
      referralCode: admin.referralCode, // = admin phone
    })
    expect(res.status).toBe(201)
    const { user, token } = await res.json<{
      user: { role: string; referrerId: string; referralCode: string }
      token: string
    }>()
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
    expect(user.role).toBe('USER')
    expect(user.referrerId).toBe(admin.id)
    expect(user.referralCode).toBe('0912345678') // defaults to phone
  })

  it('rejects an over-long full name with 400', async () => {
    const admin = await seedAdmin()
    const res = await post('/api/auth/register', {
      fullName: 'x'.repeat(101),
      phone: '0912345678',
      password: 'userpass123',
      referralCode: admin.referralCode,
    })
    expect(res.status).toBe(400)
  })

  it('rejects a missing referral code with 400', async () => {
    await seedAdmin()
    const res = await post('/api/auth/register', { fullName: 'A', phone: '0912345678', password: 'userpass123' })
    expect(res.status).toBe(400)
  })

  it('rejects an unknown referral code with 400', async () => {
    await seedAdmin()
    const res = await post('/api/auth/register', {
      fullName: 'A',
      phone: '0912345678',
      password: 'userpass123',
      referralCode: 'does-not-exist',
    })
    expect(res.status).toBe(400)
  })

  it('rejects a weak password with 400', async () => {
    await seedAdmin()
    const res = await post('/api/auth/register', {
      fullName: 'A',
      phone: '0912345678',
      password: 'short',
      referralCode: ADMIN_PHONE,
    })
    expect(res.status).toBe(400)
  })

  it('rejects a duplicate phone with 409', async () => {
    const admin = await seedAdmin()
    const body = { fullName: 'A', phone: '0912345678', password: 'userpass123', referralCode: admin.referralCode }
    expect((await post('/api/auth/register', body)).status).toBe(201)
    expect((await post('/api/auth/register', body)).status).toBe(409)
  })

  it('accepts the referrer via the ?ref= query when no body code is given', async () => {
    const admin = await seedAdmin()
    const res = await post(`/api/auth/register?ref=${admin.referralCode}`, {
      fullName: 'A',
      phone: '0912345678',
      password: 'userpass123',
    })
    expect(res.status).toBe(201)
    const { user } = await res.json<{ user: { referrerId: string } }>()
    expect(user.referrerId).toBe(admin.id)
  })
})

describe('login', () => {
  it('logs in with correct phone + password (200 + token)', async () => {
    await seedAdmin()
    const res = await post('/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    const { token } = await res.json<{ token: string }>()
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })

  it('normalizes +84 to 0 on login', async () => {
    await seedAdmin()
    const res = await post('/api/auth/login', { phone: '+84900000000', password: ADMIN_PASSWORD })
    expect(res.status).toBe(200)
  })

  it('returns a vague 401 for a wrong password', async () => {
    await seedAdmin()
    const res = await post('/api/auth/login', { phone: ADMIN_PHONE, password: 'wrongpass123' })
    expect(res.status).toBe(401)
  })

  it('returns the same 401 for an unknown phone (no enumeration)', async () => {
    await seedAdmin()
    const res = await post('/api/auth/login', { phone: '0988888888', password: 'whatever123' })
    expect(res.status).toBe(401)
  })

  it('records last login, last seen, and increments login count', async () => {
    const admin = await seedAdmin()
    const res = await post('/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    const row = await env.DB.prepare(
      'SELECT last_login_at, last_seen_at, login_count FROM users WHERE id = ?',
    ).bind(admin.id).first<{ last_login_at: string | null; last_seen_at: string | null; login_count: number }>()
    expect(row?.last_login_at).not.toBeNull()
    expect(row?.last_seen_at).not.toBeNull()
    expect(row?.login_count).toBe(1)
  })
})

describe('me + logout', () => {
  it('returns the current user with a token, 401 without', async () => {
    await seedAdmin()
    const login = await post('/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })
    const { token } = await login.json<{ token: string }>()

    const withToken = await get('/api/auth/me', token)
    expect(withToken.status).toBe(200)
    const { user } = await withToken.json<{ user: { phone: string } }>()
    expect(user.phone).toBe(ADMIN_PHONE)

    expect((await get('/api/auth/me')).status).toBe(401)
  })

  it('PATCH /me renames the user', async () => {
    await seedAdmin()
    const login = await post('/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })
    const { token } = await login.json<{ token: string }>()
    const res = await patch('/api/auth/me', { fullName: 'Renamed Admin' }, token)
    expect(res.status).toBe(200)
    const { user } = await res.json<{ user: { fullName: string } }>()
    expect(user.fullName).toBe('Renamed Admin')
  })

  it('logout is a stateless no-op that always succeeds', async () => {
    await seedAdmin()
    const login = await post('/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })
    const { token } = await login.json<{ token: string }>()
    expect((await post('/api/auth/logout', undefined, token)).status).toBe(200)
  })
})

describe('admin /users (RBAC)', () => {
  const rootBody = { fullName: 'Root User', phone: '0955555555', password: 'rootpass123' }

  it('lets the super admin create a referrer-less root user (201)', async () => {
    await seedAdmin()
    const login = await post('/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })
    const { token } = await login.json<{ token: string }>()
    const res = await post('/api/admin/users', rootBody, token)
    expect(res.status).toBe(201)
    const { user } = await res.json<{ user: { role: string; referrerId: string | null } }>()
    expect(user.role).toBe('USER')
    expect(user.referrerId).toBeNull()
  })

  it('forbids a normal USER (403)', async () => {
    const admin = await seedAdmin()
    const reg = await post('/api/auth/register', {
      fullName: 'A',
      phone: '0912345678',
      password: 'userpass123',
      referralCode: admin.referralCode,
    })
    const { token } = await reg.json<{ token: string }>()
    const res = await post('/api/admin/users', rootBody, token)
    expect(res.status).toBe(403)
  })

  it('rejects an anonymous request (401)', async () => {
    await seedAdmin()
    const res = await post('/api/admin/users', rootBody)
    expect(res.status).toBe(401)
  })
})

describe('admin ban user', () => {
  it('bans a USER and invalidates their existing session', async () => {
    const admin = await seedAdmin()
    const adminLogin = await post('/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })
    const { token: adminToken } = await adminLogin.json<{ token: string }>()
    const registration = await post('/api/auth/register', {
      fullName: 'User To Ban', phone: '0912345678', password: 'userpass123', referralCode: admin.referralCode,
    })
    const { user, token: userToken } = await registration.json<{ user: { id: string }; token: string }>()

    const ban = await post(`/api/admin/users/${user.id}/ban`, undefined, adminToken)
    expect(ban.status).toBe(200)
    expect((await get('/api/auth/me', userToken)).status).toBe(401)
    expect((await post('/api/auth/login', { phone: '0912345678', password: 'userpass123' })).status).toBe(401)
  })

  it('protects the super admin and rejects a repeated ban', async () => {
    const admin = await seedAdmin()
    const login = await post('/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })
    const { token } = await login.json<{ token: string }>()
    expect((await post(`/api/admin/users/${admin.id}/ban`, undefined, token)).status).toBe(403)

    const created = await post('/api/admin/users', { fullName: 'Root', phone: '0955555555', password: 'rootpass123' }, token)
    const { user } = await created.json<{ user: { id: string } }>()
    expect((await post(`/api/admin/users/${user.id}/ban`, undefined, token)).status).toBe(200)
    expect((await post(`/api/admin/users/${user.id}/ban`, undefined, token)).status).toBe(409)
  })

  it('unbans a USER and allows login again', async () => {
    const admin = await seedAdmin()
    const login = await post('/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })
    const { token } = await login.json<{ token: string }>()
    const created = await post('/api/admin/users', {
      fullName: 'Recoverable User', phone: '0955555555', password: 'rootpass123',
    }, token)
    const { user } = await created.json<{ user: { id: string } }>()

    expect((await post(`/api/admin/users/${user.id}/ban`, undefined, token)).status).toBe(200)
    expect((await post('/api/auth/login', { phone: '0955555555', password: 'rootpass123' })).status).toBe(401)
    expect((await post(`/api/admin/users/${user.id}/unban`, undefined, token)).status).toBe(200)
    expect((await post('/api/auth/login', { phone: '0955555555', password: 'rootpass123' })).status).toBe(200)
    expect((await post(`/api/admin/users/${user.id}/unban`, undefined, token)).status).toBe(409)
  })
})

describe('single super admin invariant', () => {
  it('the DB rejects a second super admin', async () => {
    await seedAdmin()
    await expect(
      createUser(env.DB, {
        fullName: 'Impostor',
        phone: '0911111111',
        password: 'impostor123',
        role: 'SUPER_ADMIN',
        referrerId: null,
      }),
    ).rejects.toThrow()
  })
})
