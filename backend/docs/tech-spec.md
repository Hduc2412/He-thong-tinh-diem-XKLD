# Tech Spec: CTV Points System

**Scope:** Technical design for the points slice of the XKLĐ collaborator system — the two-wallet point ledger, orders, maintenance accrual/reset, and redemption defined in [`docs/PRD.md`](./PRD.md). The auth slice (registration, login, sessions, RBAC middleware) is already implemented and is **not** redesigned here; this spec only extends it where the points system requires (registration bonuses, new routes behind existing guards).

**Stack (settled):** Cloudflare Workers · Hono ^4 · ArkType ^2 (`@hono/arktype-validator`) · D1 (SQLite, binding `DB`) · Vitest with `@cloudflare/vitest-pool-workers`. No Durable Objects, KV, or Queues — see §6 for why D1 alone is sufficient.

---

## 1. Architecture

### 1.1 Layering (clean architecture, pragmatic depth)

```
routes/            HTTP layer: Hono sub-apps, ArkType validation, auth guards,
                   status-code mapping. No business rules, no SQL.
    
lib/               Repository/service layer: hand-written D1 SQL, batch
                   composition, row↔camelCase mapping, error translation.
                   Calls domain functions to make business decisions.
      │
domain/points/     Pure business core: framework-free functions and types
                   encoding ALL point rules. No Hono, no D1, no I/O, no
                   Date.now(). Plain data in, plain data out.
      │
D1 (SQLite)        Storage + the enforcement layer of last resort: CHECK
                   constraints and UNIQUE indexes that make every invariant
                   hold even if application code is buggy or races.
```

Two rules make this testable and safe:

1. **Time injection.** Every domain and `lib/` function that needs the current time takes `now: Date` as a parameter. Only route handlers and `src/scheduled.ts` construct `new Date()` / `new Date(ctrl.scheduledTime)`. Domain tests are fully deterministic.
2. **Domain decides *whether*, SQL decides *how much* (when the amount depends on live state).** Example: the domain planner decides *whether* a `MAINTENANCE_RESET` is due for period `n`; the reset *amount* is computed inside the SQL transaction (`-(SELECT SUM(...))`) because it must reflect the balance at commit time, not at plan time. Fixed amounts (+10, +2, +50) live in domain constants.

### 1.2 Why not touch the auth slice

`src/lib/users.ts` mixes SQL and logic; that style stays for auth. The points system has genuinely intricate rules (rolling windows, period math, guards) that justify the pure core; auth does not. One exception: `createUser` gains ledger statements in its batch (§6.3) because registration bonuses must be atomic with user creation.

---

## 2. Module layout

```
src/
  index.ts                      CHANGED  export default { fetch: app.fetch, scheduled }
                                         + mounts /api/orders, /api/points
  scheduled.ts                  NEW      scheduled() handler (thin; see §7)
  domain/points/
    constants.ts                NEW      POINTS = { REGISTRATION: 10, REFERRAL_SIGNUP: 2,
                                         MAINTENANCE: 10, CUSTOMER_REWARD: 50,
                                         CUSTOMER_REFERRAL: 10 };
                                         WARMUP_PERIODS = 3; WINDOW_PERIODS = 3;
                                         MAX_PENDING_ORDERS = 5
    types.ts                    NEW      Wallet, LedgerType, LedgerDraft, OrderStatus, plan types
    periods.ts                  NEW      anniversaryDate, periodIndex, duePeriods
    maintenance.ts              NEW      planMaintenance
    registration.ts             NEW      planRegistrationBonuses
    orderApproval.ts            NEW      planOrderApprovalBonuses
    redemption.ts               NEW      validateRedemption
    *.test.ts                   NEW      colocated plain-vitest unit tests (TDD)
  lib/
    ledger.ts                   NEW      getBalances, hasCustomerReward, listLedger,
                                         ledger row mapping, draft→statement helpers
    orders.ts                   NEW      createOrder (pending-cap guard), findOrderById,
                                         listOrders, decideOrder (approve/reject batch)
    redemptions.ts              NEW      redeem (guarded batch)
    maintenance.ts              NEW      runMaintenance(db, now) — cron body, directly testable
    users.ts                    CHANGED  createUser becomes a batch incl. registration bonuses
  routes/
    orders.ts                   NEW      /api/orders (user-facing)
    points.ts                   NEW      /api/points (user-facing)
    admin.ts                    CHANGED  + /orders, /orders/:id/approve|reject,
                                         /redemptions, /users/:id/balances, /ledger
migrations/
  0002_create_orders.sql        NEW
  0003_create_point_ledger.sql  NEW
wrangler.jsonc                  CHANGED  "triggers": { "crons": ["0 1 * * *"] }
vitest.config.ts                CHANGED  two projects: domain (plain node) + workers (pool)
```

### 2.1 `scheduled()` coexisting with the Hono fetch export

`src/index.ts` currently ends with `export default app`. It becomes:

```ts
import { scheduled } from './scheduled'

export default {
  fetch: app.fetch,
  scheduled,
} satisfies ExportedHandler<CloudflareBindings>
```

`app.fetch` works detached (Hono binds it). `SELF.fetch` in the Workers test pool dispatches to the default export's `fetch`, so all existing integration tests keep working unchanged.

### 2.2 Domain function signatures

```ts
// types.ts
type Wallet = 'F' | 'G'
type LedgerType =
  | 'REGISTRATION_BONUS' | 'REFERRAL_SIGNUP_BONUS'
  | 'MAINTENANCE_ACCRUAL' | 'MAINTENANCE_RESET'
  | 'CUSTOMER_REWARD' | 'CUSTOMER_REFERRAL_BONUS'
  | 'REDEMPTION'

/** What planners emit; lib/ turns these into SQL statements. */
interface LedgerDraft {
  userId: string            // wallet owner (beneficiary)
  wallet: Wallet
  type: LedgerType
  points: number            // fixed amounts only; resets are NOT drafts (see §1.1 rule 2)
  orderId?: string          // CUSTOMER_* only
  subjectUserId?: string    // registration types only: the new registrant
}

// periods.ts — all Dates are UTC instants
/** 00:00:00.000 UTC on registration's month+n, day clamped to month length. n >= 0. */
function anniversaryDate(registeredAt: Date, n: number): Date
/** Largest n >= 0 with anniversaryDate(registeredAt, n) <= now. Registration day → 0. */
function periodIndex(registeredAt: Date, now: Date): number
/** Ascending [lastAccruedPeriod+1 .. periodIndex(now)], each >= 1. [] when up to date. */
function duePeriods(registeredAt: Date, lastAccruedPeriod: number, now: Date): number[]

// maintenance.ts
interface MaintenancePlanItem { periodIndex: number; resetRequired: boolean }
function planMaintenance(input: {
  registeredAt: Date
  lastAccruedPeriod: number        // 0 if no MAINTENANCE_ACCRUAL rows yet
  approvedOrderDates: Date[]       // decided_at of the user's APPROVED orders
  now: Date
}): MaintenancePlanItem[]
// Per due period n: resetRequired ⇔ n > WARMUP_PERIODS (i.e. n >= 4)
//   AND no d in approvedOrderDates with anniversaryDate(n-3) <= d < anniversaryDate(n)

// registration.ts
function planRegistrationBonuses(input: {
  userId: string
  referrerId: string | null
}): LedgerDraft[]
// Always: REGISTRATION_BONUS +10 F to userId (subjectUserId = userId).
// If referrerId: REFERRAL_SIGNUP_BONUS +2 F to referrerId (subjectUserId = userId).

// orderApproval.ts
function planOrderApprovalBonuses(input: {
  orderId: string
  orderUserId: string
  referrerId: string | null
}): LedgerDraft[]
// CUSTOMER_REWARD +50 F to orderUserId; if referrerId: CUSTOMER_REFERRAL_BONUS +10 F.

// redemption.ts
type RedemptionError = 'LOCKED' | 'INSUFFICIENT_F' | 'INSUFFICIENT_G' | 'INVALID_AMOUNT'
function validateRedemption(input: {
  hasCustomerReward: boolean
  balances: { f: number; g: number }
  amounts: { f?: number; g?: number }   // positive integers; at least one present
}): { ok: true } | { ok: false; error: RedemptionError }
// Pre-flight for friendly error messages ONLY. The SQL guard (§6.2) is the authority.
```

---

## 3. Data model

Conventions follow `0001_create_users.sql`: TEXT UUID primary keys, ISO-8601 UTC TEXT timestamps (`Date.prototype.toISOString()` — fixed-width, so lexicographic string comparison equals chronological comparison), partial unique indexes for invariants.

### 3.1 `migrations/0002_create_orders.sql`

```sql
CREATE TABLE orders (
  id         TEXT PRIMARY KEY,                    -- UUID
  user_id    TEXT NOT NULL REFERENCES users(id),  -- creator = beneficiary (PRD §6.3)
  note       TEXT,                                -- optional, <= 500 chars (API-enforced)
  status     TEXT NOT NULL DEFAULT 'PENDING'
               CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  decided_by TEXT REFERENCES users(id),           -- the super admin who decided
  decided_at TEXT,                                -- ISO 8601 UTC
  created_at TEXT NOT NULL,
  -- decision fields are set iff the order is decided
  CHECK ((status = 'PENDING'  AND decided_by IS NULL     AND decided_at IS NULL)
      OR (status <> 'PENDING' AND decided_by IS NOT NULL AND decided_at IS NOT NULL))
);

CREATE INDEX idx_orders_user_created   ON orders(user_id, created_at);   -- user's own list
CREATE INDEX idx_orders_status_created ON orders(status, created_at);    -- admin PENDING queue
-- rolling-window lookups: "APPROVED orders of user X decided in [a, b)"
CREATE INDEX idx_orders_user_approved  ON orders(user_id, decided_at) WHERE status = 'APPROVED';
```

### 3.2 `migrations/0003_create_point_ledger.sql`

```sql
CREATE TABLE point_ledger (
  id              TEXT PRIMARY KEY,                     -- UUID
  user_id         TEXT NOT NULL REFERENCES users(id),   -- wallet owner (beneficiary)
  wallet          TEXT NOT NULL CHECK (wallet IN ('F','G')),
  type            TEXT NOT NULL CHECK (type IN (
                    'REGISTRATION_BONUS','REFERRAL_SIGNUP_BONUS',
                    'MAINTENANCE_ACCRUAL','MAINTENANCE_RESET',
                    'CUSTOMER_REWARD','CUSTOMER_REFERRAL_BONUS','REDEMPTION')),
  points          INTEGER NOT NULL CHECK (points <> 0),
  order_id        TEXT REFERENCES orders(id),           -- CUSTOMER_* rows only
  subject_user_id TEXT REFERENCES users(id),            -- registration rows only: the registrant
  period_index    INTEGER CHECK (period_index >= 1),    -- MAINTENANCE_* rows only
  idempotency_key TEXT,                                 -- REDEMPTION rows only
  note            TEXT,
  created_by      TEXT REFERENCES users(id),            -- admin for REDEMPTION; NULL = system
  created_at      TEXT NOT NULL,                        -- ISO 8601 UTC

  -- sign discipline: credits are positive, debits negative, per type
  CHECK ((points > 0) = (type IN ('REGISTRATION_BONUS','REFERRAL_SIGNUP_BONUS',
         'MAINTENANCE_ACCRUAL','CUSTOMER_REWARD','CUSTOMER_REFERRAL_BONUS'))),
  -- wallet discipline: maintenance rows are G-only, order/registration rows F-only,
  -- redemption may hit either wallet
  CHECK (CASE
    WHEN type IN ('MAINTENANCE_ACCRUAL','MAINTENANCE_RESET') THEN wallet = 'G'
    WHEN type = 'REDEMPTION' THEN 1
    ELSE wallet = 'F' END),
  -- linkage discipline: each reference column is set exactly when its type demands
  CHECK ((order_id        IS NOT NULL) = (type IN ('CUSTOMER_REWARD','CUSTOMER_REFERRAL_BONUS'))),
  CHECK ((subject_user_id IS NOT NULL) = (type IN ('REGISTRATION_BONUS','REFERRAL_SIGNUP_BONUS'))),
  CHECK ((period_index    IS NOT NULL) = (type IN ('MAINTENANCE_ACCRUAL','MAINTENANCE_RESET'))),
  CHECK ((idempotency_key IS NOT NULL) = (type = 'REDEMPTION'))
);
```

**Idempotency indexes — each kills a specific race** (referenced from §6):

```sql
-- R1: an order pays each bonus type at most once, ever (double-approve backstop)
CREATE UNIQUE INDEX uq_ledger_order_type
  ON point_ledger(order_id, type) WHERE order_id IS NOT NULL;

-- R2: one registration event pays each bonus type at most once
--     (covers the self REGISTRATION_BONUS and the referrer's REFERRAL_SIGNUP_BONUS,
--      which have different user_id but the same subject_user_id)
CREATE UNIQUE INDEX uq_ledger_subject_type
  ON point_ledger(subject_user_id, type) WHERE subject_user_id IS NOT NULL;

-- R3: each (user, period) accrues once and resets at most once (cron overlap/catch-up)
CREATE UNIQUE INDEX uq_ledger_user_period_type
  ON point_ledger(user_id, period_index, type) WHERE period_index IS NOT NULL;

-- R4: redemption replay protection (one key may carry one F row and one G row)
CREATE UNIQUE INDEX uq_ledger_idem
  ON point_ledger(idempotency_key, wallet) WHERE idempotency_key IS NOT NULL;
```

**Query indexes:**

```sql
-- covering index: SUM(points) per (user, wallet) never touches the table
CREATE INDEX idx_ledger_user_wallet_points ON point_ledger(user_id, wallet, points);
-- history pagination (created_at DESC, id DESC as stable tiebreak)
CREATE INDEX idx_ledger_user_created ON point_ledger(user_id, created_at, id);
```

**Balances are always derived** (`SELECT COALESCE(SUM(points),0) ... WHERE user_id=? AND wallet=?`), never stored — per PRD §5. At <1,000 users with the covering index this is microseconds. There is deliberately **no accrual-bookkeeping table**: `MAX(period_index) WHERE type='MAINTENANCE_ACCRUAL'` *is* the bookkeeping and R3 *is* the idempotency.

---

## 4. Point rules (PRD traceability)

| Ledger type | Trigger | Wallet | Points | Beneficiary | Path |
|---|---|---|---|---|---|
| `REGISTRATION_BONUS` | registration | F | +10 | the registrant | §6.3, automatic |
| `REFERRAL_SIGNUP_BONUS` | registration | F | +2 | direct referrer | §6.3, automatic |
| `MAINTENANCE_ACCRUAL` | monthly, per registration anniversary | G | +10 | the user | §6.4, cron |
| `MAINTENANCE_RESET` | dry rolling 3-month window, period ≥ 4 | G | −(current G balance) | the user | §6.4, cron |
| `CUSTOMER_REWARD` | order `APPROVED` | F | +50 | order creator | §6.1, admin |
| `CUSTOMER_REFERRAL_BONUS` | order `APPROVED` | F | +10 | creator's referrer | §6.1, admin |
| `REDEMPTION` | admin cash payout | F and/or G | −(entered) | the user | §6.2, admin |

Constants live in `domain/points/constants.ts` and are compile-time system-wide values (PRD §8) — not per-transaction configurable, not env vars.

---

## 5. Period math (TDD-precise definitions)

All in UTC. Registration timestamp = `users.created_at`.

- **`anniversaryDate(reg, n)`** = 00:00:00.000 UTC on year/month = `reg`'s month + `n`, day = `min(reg's day, length of target month)`. Clamping is **per-month, never sticky**: registered 2026-01-31 → n=1: 2026-02-28, n=2: 2026-03-31, n=3: 2026-04-30, n=4: 2026-05-31. Registered 2028-02-29 → n=12: 2029-02-28.
- **`periodIndex(reg, now)`** = max `n ≥ 0` with `anniversaryDate(reg, n) ≤ now`. On registration day = 0.
- **Accrual due:** period `n ≥ 1` is due once `now ≥ anniversaryDate(reg, n)`. Period 0 (registration itself) never accrues — the first +10 lands one month after registration (PRD §6.2 "starting from registration, every 1 month").
- **Warm-up:** no reset for periods 1–3 (PRD §6.4 warm-up phase).
- **Reset check at period `n ≥ 4`:** reset ⇔ there is **no** APPROVED order with `anniversaryDate(reg, n−3) ≤ decided_at < anniversaryDate(reg, n)`. **Half-open on the right:** an order approved at exactly the anniversary instant counts toward the *next* window, not the closing one. Deterministic at boundaries; unit-tested both edges.
- SQL comparisons on these values are plain string comparisons — safe because every timestamp is `toISOString()` output.

---

## 6. Concurrency & atomicity on D1 — the point-flow integrity design

Everything in this section rests on four facts about D1:

1. **`db.batch([...])` runs all statements sequentially inside one implicit transaction.** Any thrown error — including a constraint violation — rolls back *every* statement. There is no partial commit and no crash window between statements of a batch.
2. **A conditional write** (`INSERT INTO … SELECT … WHERE <guard>`, `UPDATE … WHERE <guard>`) that matches zero rows **is not an error** — it silently writes nothing. Detection is via `results[i].meta.changes === 0` *after* the batch commits. Consequence: statements in one batch that must succeed-or-fail together must either share the same guard predicate or **chain on each other's written rows** — you cannot inspect `meta` mid-batch and abort.
3. **SQLite is single-writer.** Concurrent batches serialize; every guard subquery (balance `SUM`, status check) is evaluated inside the writer's own transaction. Time-of-check-to-time-of-use races are impossible *by construction*, not by care.
4. **When a guard must abort the whole batch**, use a UNIQUE index: the violation throws, D1 rolls back the batch, application code catches and classifies (the existing `translateConflict` pattern in `src/lib/users.ts`, extended to recognize `point_ledger` index names).

### 6.1 Order approve / reject — `lib/orders.ts → decideOrder`

One batch; `?now` is a single ISO string bound identically into every statement:

```sql
-- S1: flip status, guarded on PENDING
UPDATE orders SET status = 'APPROVED', decided_by = ?admin, decided_at = ?now
WHERE id = ?orderId AND status = 'PENDING';

-- S2: +50 to creator — guarded on THIS batch's flip (decided_at equals our own ?now)
INSERT INTO point_ledger (id, user_id, wallet, type, points, order_id, created_at)
SELECT ?uuid1, o.user_id, 'F', 'CUSTOMER_REWARD', 50, o.id, ?now
FROM orders o
WHERE o.id = ?orderId AND o.status = 'APPROVED' AND o.decided_at = ?now;

-- S3: +10 to referrer — same guard + referrer must exist AND be a USER (A2: no admin payout)
INSERT INTO point_ledger (id, user_id, wallet, type, points, order_id, created_at)
SELECT ?uuid2, r.id, 'F', 'CUSTOMER_REFERRAL_BONUS', 10, o.id, ?now
FROM orders o
JOIN users u ON u.id = o.user_id
JOIN users r ON r.id = u.referrer_id
WHERE o.id = ?orderId AND o.status = 'APPROVED' AND o.decided_at = ?now
  AND r.role = 'USER';
```

Outcome: `results[0].meta.changes === 1` → success (S3 writing 0 rows is fine — root user with no referrer, or an admin referrer who earns nothing). `=== 0` → already decided or nonexistent → re-read the order → 404 or 409 `ALREADY_DECIDED` (with current status in the body). **Reject** is S1 alone with `'REJECTED'`, same detection.

| Race | Why it's dead |
|---|---|
| Double-submit approve | Second batch's S1 matches 0 rows (`status <> 'PENDING'`); its S2/S3 guards also fail (`decided_at ≠` its `?now`). Zero writes, clean 409. |
| Concurrent approve + reject | Serialized by the single writer; the loser's S1 sees a non-PENDING status. Exactly one decision ever lands. |
| Crash between flip and points | Impossible — same batch, one transaction (fact 1). |
| Timestamp collision (two admins, same ms) | Can't matter: S1 already guards on `PENDING`, so at most one flip commits; **R1** (`uq_ledger_order_type`) is the structural backstop that no order ever pays twice. |

### 6.2 Redemption — `lib/redemptions.ts → redeem`

ArkType validates shape first (integers > 0, at least one wallet, `idempotencyKey` UUID); `validateRedemption` pre-flights for a friendly message. Then one batch is the **authority**. For a request deducting F=`?f` and G=`?g`:

```sql
-- S1 (F row): ALL guards for the whole redemption live on the first statement
INSERT INTO point_ledger
  (id, user_id, wallet, type, points, idempotency_key, note, created_by, created_at)
SELECT ?idF, ?user, 'F', 'REDEMPTION', -?f, ?key, ?note, ?admin, ?now
WHERE EXISTS (SELECT 1 FROM point_ledger
              WHERE user_id = ?user AND type = 'CUSTOMER_REWARD')            -- unlock (PRD §6.5.1)
  AND (SELECT COALESCE(SUM(points),0) FROM point_ledger
       WHERE user_id = ?user AND wallet = 'F') >= ?f                          -- F sufficient
  AND (SELECT COALESCE(SUM(points),0) FROM point_ledger
       WHERE user_id = ?user AND wallet = 'G') >= ?g;                         -- G sufficient

-- S2 (G row): fires iff S1 fired — chained on S1's concrete row id (fact 2)
INSERT INTO point_ledger
  (id, user_id, wallet, type, points, idempotency_key, note, created_by, created_at)
SELECT ?idG, ?user, 'G', 'REDEMPTION', -?g, ?key, ?note, ?admin, ?now
WHERE EXISTS (SELECT 1 FROM point_ledger WHERE id = ?idF);
```

Single-wallet redemptions are S1 alone carrying only that wallet's guards (plus unlock). Outcome: last statement's `meta.changes === 1` → 201. `=== 0` → nothing was written anywhere (S2 chains on S1's row, so all-or-nothing holds without a rollback) → re-read unlock + balances → 422 `REDEMPTION_LOCKED` or `INSUFFICIENT_BALANCE` with per-wallet detail.

| Race | Why it's dead |
|---|---|
| Two concurrent redemptions draining one wallet | Serialized (fact 3); the second batch's `SUM` subquery already includes the first's negative row → guard fails → zero writes. **A negative balance is structurally impossible**, not merely checked. |
| Double-submit (retry, double-click) | Same `idempotencyKey` → **R4** violation → whole batch rolls back (fact 4) → 409 `DUPLICATE_REDEMPTION`. Two *legitimate* identical redemptions (same user, same amount, twice) remain possible with distinct keys — which is why an explicit key, not a natural key, is required. |
| Redemption racing a `MAINTENANCE_RESET` | Serialized either way; whichever commits second computes its guard/amount over the other's rows. Order of outcomes is nondeterministic; invariants (G ≥ 0, reset zeroes exactly what remains) hold in both orders. |

### 6.3 Registration bonuses — `lib/users.ts → createUser` (changed)

User creation and bonuses become **one batch** (today's `createUser` runs a single INSERT; adding bonuses as separate statements *after* it would create a crash window where the user exists but bonuses were never written — the reason this function changes):

```
batch([
  INSERT INTO users (...) VALUES (...),                          -- dup phone throws here
  INSERT INTO point_ledger (..., 'REGISTRATION_BONUS', +10, 'F',
                            user_id = ?newId, subject_user_id = ?newId, ...),
  -- included only when the referrer is an eligible USER (skipped for a null referrer or a
  -- SUPER_ADMIN referrer — the route passes referrerEarnsBonus = referrer.role === 'USER'; A2):
  INSERT INTO point_ledger (..., 'REFERRAL_SIGNUP_BONUS', +2, 'F',
                            user_id = ?referrerId, subject_user_id = ?newId, ...),
])
```

- Duplicate-phone retry: statement 1 violates the phone UNIQUE → whole batch rolls back → existing 409 path. **Orphan bonuses are impossible.**
- **R2** backstops any future second code path from double-paying a registration event.
- Admin root-user creation (`POST /api/admin/users`) reuses the same function — referrer leg simply absent. When creating a `SUPER_ADMIN` (seed script), bonus statements are omitted entirely (A2, §9).

### 6.4 Cron accrual + reset — `lib/maintenance.ts → runMaintenance(db, now)`

Per run:

1. Load all `role = 'USER'` users with (a) `MAX(period_index)` of their `MAINTENANCE_ACCRUAL` rows and (b) their APPROVED orders' `decided_at` values. Three cheap queries assembled in JS — fine at <1,000 users.
2. Per user: `planMaintenance(...)` → ordered `MaintenancePlanItem[]`. Catch-up may yield several periods; **ascending order matters** — each period's reset amount is the G balance at that point in the replay.
3. Per (user, period `n`): **one batch of reset-then-accrue**:

```sql
-- S1: reset first (only emitted when the planner said resetRequired for n),
--     amount computed in-transaction, skipped entirely when G <= 0 (no zero-point rows)
INSERT INTO point_ledger (id, user_id, wallet, type, points, period_index, created_at)
SELECT ?uuid1, ?user, 'G', 'MAINTENANCE_RESET',
       -(SELECT SUM(points) FROM point_ledger WHERE user_id = ?user AND wallet = 'G'),
       ?n, ?now
WHERE (SELECT COALESCE(SUM(points),0) FROM point_ledger
       WHERE user_id = ?user AND wallet = 'G') > 0;

-- S2: then the month's +10
INSERT INTO point_ledger (id, user_id, wallet, type, points, period_index, created_at)
VALUES (?uuid2, ?user, 'G', 'MAINTENANCE_ACCRUAL', 10, ?n, ?now);
```

- **Reset-then-accrue ordering** is guaranteed: sequential statements in one transaction; S1's subquery runs before S2's row exists, so the reset zeroes exactly the pre-accrual balance and the month ends with G = 10 (PRD §6.4).
- **Cron overlap** (two runs racing, e.g. a retried invocation): use **plain INSERT, not `INSERT OR IGNORE`**. The loser's S2 violates **R3** → its whole (user, period) batch rolls back, including its S1 reset → caught, classified as "already processed", the run continues with the next user. `INSERT OR IGNORE` is explicitly rejected: SQLite's `OR IGNORE` also swallows CHECK and NOT NULL violations, which would hide real bugs; a caught-and-classified UNIQUE error keeps every other constraint failure loud.
- **Missed runs self-heal:** nothing is anchored to "yesterday". `duePeriods` derives all owed periods from `registered_at` vs `now`, so after N missed days a single run emits every due period per affected user, each idempotent under R3.
- **Failure isolation:** each user is processed in its own try/catch; a failure is `console.error`-logged and skipped; the next daily run retries idempotently.

---

## 7. Scheduled accrual engine (wiring)

`wrangler.jsonc`:

```jsonc
"triggers": { "crons": ["0 1 * * *"] }   // daily 01:00 UTC = 08:00 Việt Nam
```

`src/scheduled.ts` — deliberately thin so all logic is testable without a cron harness:

```ts
import { runMaintenance } from './lib/maintenance'

export async function scheduled(
  ctrl: ScheduledController, env: CloudflareBindings, ctx: ExecutionContext,
) {
  ctx.waitUntil(runMaintenance(env.DB, new Date(ctrl.scheduledTime)))
}
```

No HTTP endpoint triggers accrual in this phase. If an admin "run accrual now" endpoint is ever added, it must sit behind `requireSuperAdmin` and is safe by construction (idempotent under R3).

---

## 8. API reference

Shared conventions: JSON everywhere; errors `{ error: string, code?: string }` (`code` is a stable machine-readable business-failure identifier); pagination `?page` (int ≥ 1, default 1) and `?limit` (1–100, default 20), responses `{ items…, page, limit, total }`, ordered `created_at DESC, id DESC`. ArkType schemas defined inline in route files per existing convention; write-endpoint schemas use `onUndeclaredKey('reject')` (§10).

Response shapes (camelCase-mapped like `toAuthUser`):
`order` = `{ id, userId, note, status, decidedBy, decidedAt, createdAt }`
`entry` = `{ id, userId, wallet, type, points, orderId, periodIndex, note, createdBy, createdAt }` (`subjectUserId`/`idempotencyKey` appear only in admin responses)
`balances` = `{ f: number, g: number, redemptionUnlocked: boolean }`

### User endpoints (`requireAuth`)

| Endpoint | Body / query | Success | Failures |
|---|---|---|---|
| `POST /api/orders` | `{ note?: 'string <= 500' }` | 201 `{ order }` | 403 for `SUPER_ADMIN`; 409 `PENDING_LIMIT` at 5 pending — conditional insert `WHERE (SELECT COUNT(*) FROM orders WHERE user_id=? AND status='PENDING') < 5`, detected via `meta.changes = 0` |
| `GET /api/orders` | `?status=`, pagination | 200 `{ orders, … }` — own rows only | |
| `GET /api/orders/:id` | | 200 `{ order }` | 404 — including when the order exists but belongs to someone else (no existence leak) |
| `GET /api/points/balances` | | 200 `balances` | |
| `GET /api/points/ledger` | `?wallet=F\|G`, `?type=`, `?from=`, `?to=` (ISO), pagination | 200 `{ entries, … }` — own rows only | |

### Admin endpoints (existing wholesale `requireSuperAdmin` on `/api/admin`)

| Endpoint | Body / query | Success | Failures |
|---|---|---|---|
| `GET /api/admin/orders` | `?status=`, `?userId=`, pagination | 200 | |
| `POST /api/admin/orders/:id/approve` | (empty) | 200 `{ order }` | 404; 409 `ALREADY_DECIDED` |
| `POST /api/admin/orders/:id/reject` | (empty) | 200 `{ order }` | 404; 409 `ALREADY_DECIDED` |
| `POST /api/admin/redemptions` | `{ userId: uuid, f?: int > 0, g?: int > 0, note?: ≤500, idempotencyKey: uuid }` + narrow: `f` or `g` present | 201 `{ entries, balances }` | 404 unknown user; 409 `DUPLICATE_REDEMPTION`; 422 `REDEMPTION_LOCKED` / `INSUFFICIENT_BALANCE` |
| `GET /api/admin/users/:id/balances` | | 200 `balances` | 404 |
| `GET /api/admin/ledger` | `?userId=`, `?wallet=`, `?type=`, `?from=`, `?to=`, pagination | 200 | |

---

## 9. Edge cases catalog

Each ruling is normative; ambiguity resolutions reference §12.

1. **Root user (no referrer):** gets `REGISTRATION_BONUS`; the `REFERRAL_SIGNUP_BONUS` leg is simply absent (planner emits one draft). [A1]
2. **Referrer is deactivated** at registration or at order approval: the bonus is **still recorded**. Deactivation is an authentication concern; the ledger stays complete. [A3]
3. **User deactivated mid-cycle:** monthly accrual and resets **continue**. Any "pause" rule would break the idempotent (user, period) model and create reactivation-backfill ambiguity. [A3]
4. **SUPER_ADMIN:** skipped by the cron (`role = 'USER'` filter); cannot create orders (403); **earns no referral points** — when a user's referrer is the admin, the `referrer_id` link is still recorded but the `REFERRAL_SIGNUP_BONUS` / `CUSTOMER_REFERRAL_BONUS` leg is skipped. The admin's `referral_code` (= their phone) is guessable, so paying it would let anyone credit the admin. Skipped only for `role = 'SUPER_ADMIN'`; a deactivated **USER** referrer still earns (see #2 / A3). [A2]
5. **Registration day:** period 0, no accrual; first +10 lands at month 1. [A7]
6. **Jan 31 / Feb 29 registrations:** per-month day clamping (§5), never permanently shifted. [A6]
7. **Order approved exactly at a window boundary:** half-open `[anniv(n−3), anniv(n))` — the instant belongs to the next window. [A4]
8. **Order approved during warm-up (periods 1–3):** protects every later window it falls into (e.g. the period-4 check window `[anniv(1), anniv(4))` includes it); grants no immunity beyond that.
9. **Reset due but G = 0:** no `MAINTENANCE_RESET` row (would be a 0-point row, violating `points <> 0`); the SQL guard `SUM > 0` enforces the skip. [A8]
10. **Reset after a partial G redemption:** the reset amount is the *current* SUM, so it zeroes whatever remains — never negative (fires only when SUM > 0, amount is exactly −SUM).
11. **Redemption of 0 / negative / non-integer / neither wallet:** rejected at the ArkType schema layer, 400 — never reaches SQL.
12. **Redemption racing a reset:** serialized; both interleavings preserve invariants (§6.2). Ordering nondeterminism accepted and documented.
13. **Cron down N days:** the next run's `duePeriods` emits every owed period per user, ascending, each idempotent. A user due periods {4, 5} with a dry window gets: reset (if G > 0) + accrual for 4, then the period-5 check runs against its own window.
14. **Two cron invocations overlapping:** per-(user, period) batches collide on R3; losers roll back and are classified as already-done (§6.4).
15. **Approve after reject (or any decide-after-decided):** 409 `ALREADY_DECIDED`, zero ledger writes (§6.1).
16. **Timezone:** all timestamps UTC; period boundaries at 00:00 UTC; cron at 01:00 UTC (08:00 VN) so anniversary-day accruals appear the same VN morning. [A5]

---

## 10. Security catalog

- **IDOR:** user routes bake ownership into the SQL (`WHERE id = ? AND user_id = ?session`); a foreign order id returns **404, not 403** — no existence leak. Balance/ledger user routes hardcode `user_id = c.get('user').id`; `userId` is **never** accepted from the client on user routes.
- **Order forgery:** `orders.user_id` comes exclusively from the session; the create schema contains only `note`. Write schemas use ArkType `onUndeclaredKey('reject')` so extra JSON fields (e.g. a smuggled `status: 'APPROVED'` or `userId`) hard-fail with 400 rather than being silently ignored.
- **RBAC:** everything under `/api/admin` is already behind the wholesale `requireSuperAdmin` guard (`use('*')` in `src/routes/admin.ts`); user routes behind `requireAuth`; `POST /api/orders` additionally rejects `SUPER_ADMIN` (403) per PRD/A2.
- **Approve replay:** idempotent by construction (§6.1) — a captured and replayed approve request can never double-pay; the second attempt is a 409.
- **Redemption replay / CSRF:** `idempotencyKey` + R4 kill replays (§6.2). The mutation surface is the admin session cookie: httpOnly, `SameSite=Lax`, secure (already implemented in `src/lib/jwt.ts`) — cross-site POST is blocked by Lax; the key requirement additionally bounds any residual replay.
- **Note fields (`orders.note`, redemption `note`):** length-capped at 500 by schema, stored raw, emitted only through `c.json()` (correctly escaped JSON). The server never renders HTML; clients must treat notes as plain text.
- **Order spam:** 5 concurrent PENDING orders per user, enforced by conditional insert (race-safe under the single writer — two concurrent creates at 4 pending serialize, the second sees 5). [A9] True per-IP rate limiting is out of scope without KV/DO; the cap bounds queue pollution, and orders carry no points until approved.
- **Enumeration:** all ids are UUIDs; user-facing list queries are self-scoped including their `total` counts; the only cross-user surfaces are admin endpoints.
- **Registration enumeration asymmetry (accepted):** `/login` deliberately closes user enumeration (dummy-hash constant timing + a vague 401 for unknown-phone / wrong-password / deactivated alike). `/register` cannot: it must return 409 `phone already registered` for a taken phone and 400 `unknown referral code` for a bad code, both of which confirm existence. Closing this would break registration UX (a user needs to know their phone is taken or their invite code is wrong). The residual risk is bulk probing, whose only real mitigation is rate limiting — deferred (§13). Accepted tradeoff, not an oversight. [noted in PR review]
- **Cron surface:** `scheduled()` is not reachable via HTTP; no accrual-trigger endpoint exists (§7).

---

## 11. Testing strategy

### 11.1 Two vitest projects

`vitest.config.ts` splits into:

- **`domain`** — plain Node environment, **no Workers pool**: `include: ['src/domain/**/*.test.ts']`. Millisecond feedback; this is the TDD loop.
- **`workers`** — the existing `@cloudflare/vitest-pool-workers` setup (per-test `reset()` + `applyD1Migrations`, `SELF.fetch`): `include: ['test/**/*.test.ts']`.

Compose via Vitest's `projects` config. Known risk: if the `cloudflareTest` plugin resists project scoping, fall back to separate config files / `defineWorkersProject`. The contract either way: **domain tests must run without the Workers pool.**

### 11.2 Domain unit tests (written TDD-first)

- **`periods`**: registration instant → index 0; exactly +1 month → 1; one ms before → 0. Jan-31 clamping series (Feb 28/29, Mar 31, Apr 30, May 31); Feb-29 leap series (2029-02-28). `duePeriods`: `[]` when current; `[3,4,5]` after three missed months; never emits 0.
- **`maintenance`**: no reset at periods 1–3 regardless of orders; reset at 4 with an empty window; **no** reset at 4 with an order at exactly `anniv(1)` (inclusive left edge); **reset** at 4 with an order at exactly `anniv(4)` (exclusive right edge); order older than the window → reset; catch-up plan flags resets only on periods whose own window is dry.
- **`registration`**: with referrer → 2 drafts (amounts, wallets, `subjectUserId`); without → 1.
- **`orderApproval`**: with/without referrer → 2 vs 1 drafts.
- **`redemption`** matrix: locked; exact-balance success; off-by-one insufficient per wallet; both-wallet request with one wallet short; zero/negative → `INVALID_AMOUNT`.

### 11.3 Integration tests (`SELF.fetch` + `env.DB`, existing conventions)

- **Registration:** register → ledger holds +10 (self) and +2 (referrer); duplicate-phone retry → 409 **and ledger row count unchanged**.
- **Order lifecycle:** create own; 6th pending → 409 `PENDING_LIMIT`; approve → F balances +50/+10; **double-approve → 409 and ledger unchanged**; reject; approve-after-reject → 409.
- **Redemption:** locked → 422; insufficient → 422; success deducts exactly and leaves remainder; duplicate `idempotencyKey` → 409 with no extra rows; drain sequence (redeem, then redeem again beyond remainder → 422).
- **IDOR:** user A fetching user B's order → 404; A's ledger/balances never include B's rows.
- **Cron logic — test `runMaintenance(env.DB, now)` directly** (not the cron harness), with users seeded via raw SQL to control `created_at`: 1-month-old user gets one +10; 4-month-old dry user gets reset-then-accrue ending at **G = 10**; user with an approved order inside the window keeps G; **running twice with the same `now` is a no-op**; catch-up over 2 missed periods emits both. One smoke test imports the worker default export and calls `worker.scheduled(...)` to prove the wiring.
- **Determinism rule (restated):** domain and `lib/` take `now: Date`; only handlers construct dates.

### 11.4 TDD workflow

Domain modules are built red-green-refactor against §11.2's case list *before* any `lib/` or route code. `lib/` and routes are then covered by §11.3 integration tests — they contain wiring and SQL, not rules, so integration coverage suffices.

---

## 12. Resolved ambiguities & decision log

| # | Question the PRD leaves open | Ruling | Rationale |
|---|---|---|---|
| A1 | Root user: registration bonus? | +10 yes; referral leg absent | Root users are normal participants; only the referrer leg is missing. |
| A2 | SUPER_ADMIN wallets/orders? | No accruals, no orders, **no referral-bonus rows** — referrer link recorded, bonus leg skipped when the referrer is a super admin | The admin's referral_code (= phone) is guessable; paying it would let anyone credit the admin. Gated on `role = 'SUPER_ADMIN'` only; deactivated USER referrers still earn (A3). |
| A3 | Deactivated users' points? | Accrual and bonuses continue regardless of `is_active` | Deactivation is auth-only; a "pause" rule breaks (user, period) idempotency and creates backfill ambiguity. |
| A4 | Window boundary semantics | Half-open `[anniv(n−3), anniv(n))` | Deterministic at boundaries; matches "most recent rolling 3 months" literally. |
| A5 | Timezone | UTC everywhere; cron 01:00 UTC (08:00 VN) | Matches existing `toISOString()` convention; lexicographic-safe SQL comparisons. |
| A6 | Day-of-month clamping | Per-month clamp to month length, never sticky | Standard calendar-month rule; precisely testable. |
| A7 | Accrual on registration day? | No; period 0 = registration, first accrual = period 1 | "Starting from registration, every 1 month" = first credit at +1 month. |
| A8 | Reset when G = 0 | No ledger row written | 0-point rows are meaningless and violate `points <> 0`. |
| A9 | Order-creation abuse | Cap of 5 concurrent PENDING orders per user (409) | PRD silent; cheap D1-native guard; orders carry no points until approved. |
| A10 | Redemption dedupe | Required client-supplied `idempotencyKey` (UUID), UNIQUE per wallet | Two legitimate identical redemptions can exist, so no natural key works; an explicit key is the only correct dedupe. |

---

## 13. Out of scope (this spec)

- Any UI/front-end.
- Per-IP rate limiting (needs KV/DO; revisit if abuse is observed).
- Admin tooling beyond the listed endpoints (e.g. ledger corrections — would be a new signed adjustment type, never edits).
- P2P point transfer — explicitly deferred by the PRD; would invalidate the single-entity conditional-write assumption (§6) and force a storage-architecture review.
