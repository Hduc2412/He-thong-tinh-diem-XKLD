import type { AuthUser } from './lib/users'

// Shared Hono env: `Env` bindings (DB, JWT_SECRET) + a per-request `user` that is present only
// for authenticated requests (absent = anonymous, which is valid).
export type AppEnv = {
  Bindings: CloudflareBindings
  Variables: {
    user?: AuthUser
  }
}
