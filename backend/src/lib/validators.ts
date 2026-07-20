import { type } from 'arktype'

// Phone: trim, normalize +84 → 0, then require a VN mobile (0 followed by 9 digits).
// Shared by register, login, and admin so normalization is identical everywhere.
export const phone = type('string').pipe((s, ctx) => {
  const normalized = s.trim().replace(/^\+84/, '0')
  return /^0\d{9}$/.test(normalized) ? normalized : ctx.error('a valid VN phone number (0XXXXXXXXX)')
})

// Non-empty, length-bounded name, trimmed. The cap stops a multi-megabyte name at /register,
// /admin/users, and PATCH /me (Mike, PR review). 100 is generous for a person's name.
const MAX_NAME_LENGTH = 100
export const fullName = type('string').pipe((s, ctx) => {
  const trimmed = s.trim()
  if (trimmed.length === 0) return ctx.error('a non-empty full name')
  if (trimmed.length > MAX_NAME_LENGTH) return ctx.error(`a full name at most ${MAX_NAME_LENGTH} characters`)
  return trimmed
})
