import { describe, expect, it } from 'vitest'
import { get, registerUser, seedAdmin } from './helpers'

interface UserRow {
  id: string
  fullName: string
  phone: string
}

interface ListUsersResponse {
  users: UserRow[]
  page: number
  limit: number
  total: number
}

describe('GET /api/admin/users', () => {
  it('lists every user, including the admin itself', async () => {
    const admin = await seedAdmin()
    await registerUser(admin.referralCode, '0912345678', 'Alice')
    await registerUser(admin.referralCode, '0987654321', 'Bob')

    const res = await get('/api/admin/users', admin.token)
    expect(res.status).toBe(200)
    const { users, total } = await res.json<ListUsersResponse>()
    expect(total).toBe(3)
    expect(users.map((u) => u.phone).sort()).toEqual(['0900000000', '0912345678', '0987654321'])
  })

  it('q filters by a full_name substring', async () => {
    const admin = await seedAdmin()
    await registerUser(admin.referralCode, '0912345678', 'Alice Nguyen')
    await registerUser(admin.referralCode, '0987654321', 'Bob Tran')

    const res = await get('/api/admin/users?q=Alice', admin.token)
    const { users, total } = await res.json<ListUsersResponse>()
    expect(total).toBe(1)
    expect(users[0].fullName).toBe('Alice Nguyen')
  })

  it('q filters by a phone substring', async () => {
    const admin = await seedAdmin()
    await registerUser(admin.referralCode, '0912345678', 'Alice')
    await registerUser(admin.referralCode, '0987654321', 'Bob')

    const res = await get('/api/admin/users?q=91234', admin.token)
    const { users, total } = await res.json<ListUsersResponse>()
    expect(total).toBe(1)
    expect(users[0].phone).toBe('0912345678')
  })

  it('q with no match returns an empty list', async () => {
    const admin = await seedAdmin()
    const res = await get('/api/admin/users?q=nobody-matches-this', admin.token)
    const { users, total } = await res.json<ListUsersResponse>()
    expect(users).toEqual([])
    expect(total).toBe(0)
  })

  it('paginates with page/limit', async () => {
    const admin = await seedAdmin()
    await registerUser(admin.referralCode, '0912345678', 'Alice')
    await registerUser(admin.referralCode, '0987654321', 'Bob')

    const res = await get('/api/admin/users?page=1&limit=2', admin.token)
    const { users, page, limit, total } = await res.json<ListUsersResponse>()
    expect(page).toBe(1)
    expect(limit).toBe(2)
    expect(total).toBe(3)
    expect(users).toHaveLength(2)
  })

  it('is 401 for anonymous and 403 for a logged-in USER', async () => {
    const admin = await seedAdmin()
    const user = await registerUser(admin.referralCode, '0912345678')

    expect((await get('/api/admin/users')).status).toBe(401)
    expect((await get('/api/admin/users', user.token)).status).toBe(403)
  })
})
