import { applyD1Migrations, env, reset } from 'cloudflare:test'
import { beforeEach } from 'vitest'

// Each test starts from an empty, freshly-migrated DB so the singleton-admin invariant
// (one_super_admin) doesn't leak across tests.
beforeEach(async () => {
  await reset()
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
})
