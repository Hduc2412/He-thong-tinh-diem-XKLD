// The one shared path for reading and creating users. register, seed:admin, and the admin
// route all go through createUser so the INSERT never drifts. password_hash never leaves here
// — everything public goes through toAuthUser.
import { hashPassword } from './password'
import { planRegistrationBonuses } from '../domain/points/registration'
import { draftToStatement } from './ledger'

export type Role = 'SUPER_ADMIN' | 'USER'

// Raw DB row shape (snake_case, includes the hash — internal only).
interface UserRow {
  id: string
  full_name: string
  phone: string
  password_hash: string
  role: Role
  referrer_id: string | null
  referral_code: string
  is_active: number
  last_login_at: string | null
  last_seen_at: string | null
  login_count: number
  created_at: string
}

// Public, hash-free, camelCased shape returned to callers/responses.
export interface AuthUser {
  id: string
  fullName: string
  phone: string
  role: Role
  referrerId: string | null
  referralCode: string
  isActive: boolean
  lastLoginAt: string | null
  lastSeenAt: string | null
  loginCount: number
  createdAt: string
}

export function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    referrerId: row.referrer_id,
    referralCode: row.referral_code,
    isActive: row.is_active === 1,
    lastLoginAt: row.last_login_at,
    lastSeenAt: row.last_seen_at,
    loginCount: row.login_count,
    createdAt: row.created_at,
  }
}

// Typed uniqueness violation, translated from the DB error so routes can map it to HTTP.
export class ConflictError extends Error {
  field: 'phone' | 'role'
  constructor(field: 'phone' | 'role') {
    super(`conflict on ${field}`)
    this.name = 'ConflictError'
    this.field = field
  }
}

// Let the DB be the source of truth for uniqueness; translate its error rather than pre-checking
// (a pre-check has a race window; the constraint does not).
function translateConflict(err: unknown): unknown {
  const msg = err instanceof Error ? err.message : String(err)
  // referral_code defaults to phone, so a duplicate phone trips either constraint — both mean "phone".
  if (msg.includes('users.phone') || msg.includes('users.referral_code')) return new ConflictError('phone')
  if (msg.includes('users.role') || msg.includes('one_super_admin')) return new ConflictError('role')
  return err
}

export interface CreateUserInput {
  fullName: string
  phone: string
  password: string
  role: Role
  referrerId: string | null
  // Whether the referrer earns the +2 signup bonus. Set false when the referrer is a SUPER_ADMIN:
  // their referral_code (= phone) is guessable, so admins must not accrue referral points (A2).
  // The true referrer is still stored in referrer_id — only the bonus is skipped. Ignored when
  // referrerId is null. Deactivated USER referrers still earn (A3), so this is not gated on is_active.
  referrerEarnsBonus?: boolean
}

export async function createUser(db: D1Database, input: CreateUserInput): Promise<AuthUser> {
  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(input.password)
  const referralCode = input.phone // default: the code is the phone (unique because phone is unique)
  const createdAt = new Date().toISOString()

  // User row + registration bonuses go in ONE batch so bonuses are atomic with creation — a dup
  // phone rolls back the whole batch, so orphan bonuses are impossible (tech-spec §6.3).
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO users
           (id, full_name, phone, password_hash, role, referrer_id, referral_code, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      )
      .bind(id, input.fullName, input.phone, passwordHash, input.role, input.referrerId, referralCode, createdAt),
  ]

  // The new SUPER_ADMIN earns no points (tech-spec A2); USERs (including admin-created root users)
  // do. The referral leg is dropped when the referrer is ineligible (a super admin) by passing a
  // null referrerId to the planner — the self REGISTRATION_BONUS is unaffected.
  if (input.role === 'USER') {
    const bonusReferrerId = input.referrerEarnsBonus === false ? null : input.referrerId
    for (const draft of planRegistrationBonuses({ userId: id, referrerId: bonusReferrerId })) {
      statements.push(draftToStatement(db, draft, createdAt))
    }
  }

  try {
    await db.batch(statements)
  } catch (err) {
    throw translateConflict(err)
  }

  return toAuthUser({
    id,
    full_name: input.fullName,
    phone: input.phone,
    password_hash: passwordHash,
    role: input.role,
    referrer_id: input.referrerId,
    referral_code: referralCode,
    is_active: 1,
    last_login_at: null,
    last_seen_at: null,
    login_count: 0,
    created_at: createdAt,
  })
}

export function findById(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>()
}

export function findByPhone(db: D1Database, phone: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first<UserRow>()
}

export function findByReferralCode(db: D1Database, code: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE referral_code = ?').bind(code).first<UserRow>()
}

export async function superAdminExists(db: D1Database): Promise<boolean> {
  const row = await db.prepare("SELECT 1 AS x FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1").first()
  return row !== null
}

// Rename own profile (name only this phase). Returns the updated user, or null if id is gone.
export async function updateFullName(db: D1Database, id: string, fullName: string): Promise<AuthUser | null> {
  await db.prepare('UPDATE users SET full_name = ? WHERE id = ?').bind(fullName, id).run()
  const row = await findById(db, id)
  return row ? toAuthUser(row) : null
}

export interface ListUsersFilter {
  q?: string
  page: number
  limit: number
}

// Admin browse/search across all users (SUPER_ADMIN + USER rows alike). `q` matches a
// substring of full_name OR phone — SQLite's default LIKE is ASCII-only case-insensitive,
// so accented-name search is case-sensitive (accepted limitation; phone search is unaffected).
export async function listUsers(db: D1Database, filter: ListUsersFilter): Promise<{ rows: UserRow[]; total: number }> {
  const where: string[] = []
  const args: unknown[] = []
  if (filter.q) {
    where.push('(full_name LIKE ? OR phone LIKE ?)')
    args.push(`%${filter.q}%`, `%${filter.q}%`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM users ${whereSql}`)
    .bind(...args)
    .first<{ n: number }>()

  const offset = (filter.page - 1) * filter.limit
  const { results } = await db
    .prepare(`SELECT * FROM users ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .bind(...args, filter.limit, offset)
    .all<UserRow>()

  return { rows: results, total: totalRow?.n ?? 0 }
}

export async function recordSuccessfulLogin(db: D1Database, id: string, now: string): Promise<AuthUser | null> {
  await db.prepare(
    'UPDATE users SET last_login_at = ?, last_seen_at = ?, login_count = login_count + 1 WHERE id = ? AND is_active = 1',
  ).bind(now, now, id).run()
  const row = await findById(db, id)
  return row ? toAuthUser(row) : null
}

export function touchLastSeen(db: D1Database, id: string, now: string): Promise<D1Result<unknown>> {
  return db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ? AND is_active = 1').bind(now, id).run()
}

export type BanUserResult = 'BANNED' | 'NOT_FOUND' | 'ALREADY_BANNED' | 'SUPER_ADMIN'

export async function banUser(db: D1Database, id: string): Promise<BanUserResult> {
  const row = await findById(db, id)
  if (!row) return 'NOT_FOUND'
  if (row.role === 'SUPER_ADMIN') return 'SUPER_ADMIN'
  if (row.is_active !== 1) return 'ALREADY_BANNED'
  await db.prepare("UPDATE users SET is_active = 0 WHERE id = ? AND role = 'USER' AND is_active = 1").bind(id).run()
  return 'BANNED'
}

export type UnbanUserResult = 'UNBANNED' | 'NOT_FOUND' | 'ALREADY_ACTIVE' | 'SUPER_ADMIN'

export async function unbanUser(db: D1Database, id: string): Promise<UnbanUserResult> {
  const row = await findById(db, id)
  if (!row) return 'NOT_FOUND'
  if (row.role === 'SUPER_ADMIN') return 'SUPER_ADMIN'
  if (row.is_active === 1) return 'ALREADY_ACTIVE'
  await db.prepare("UPDATE users SET is_active = 1 WHERE id = ? AND role = 'USER' AND is_active = 0").bind(id).run()
  return 'UNBANNED'
}
