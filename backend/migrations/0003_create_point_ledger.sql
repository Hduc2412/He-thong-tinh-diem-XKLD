-- Point ledger: the append-only source of truth for every point movement. Balances are always
-- derived (SUM over this table), never stored (PRD §5, tech-spec §3.2). CHECK constraints and
-- UNIQUE indexes are the enforcement layer of last resort — invariants hold even if app code races.
CREATE TABLE point_ledger (
  id              TEXT PRIMARY KEY,                     -- UUID
  user_id         TEXT NOT NULL REFERENCES users(id),   -- wallet owner (beneficiary)
  wallet          TEXT NOT NULL CHECK (wallet IN ('F', 'G')),
  type            TEXT NOT NULL CHECK (type IN (
                    'REGISTRATION_BONUS', 'REFERRAL_SIGNUP_BONUS',
                    'MAINTENANCE_ACCRUAL', 'MAINTENANCE_RESET',
                    'CUSTOMER_REWARD', 'CUSTOMER_REFERRAL_BONUS', 'REDEMPTION')),
  points          INTEGER NOT NULL CHECK (points <> 0),
  order_id        TEXT REFERENCES orders(id),           -- CUSTOMER_* rows only
  subject_user_id TEXT REFERENCES users(id),            -- registration rows only: the registrant
  period_index    INTEGER CHECK (period_index >= 1),    -- MAINTENANCE_* rows only
  idempotency_key TEXT,                                 -- REDEMPTION rows only
  note            TEXT,
  created_by      TEXT REFERENCES users(id),            -- admin for REDEMPTION; NULL = system
  created_at      TEXT NOT NULL,                        -- ISO 8601 UTC

  -- sign discipline: credits are positive, debits negative, per type
  CHECK ((points > 0) = (type IN ('REGISTRATION_BONUS', 'REFERRAL_SIGNUP_BONUS',
         'MAINTENANCE_ACCRUAL', 'CUSTOMER_REWARD', 'CUSTOMER_REFERRAL_BONUS'))),
  -- wallet discipline: maintenance rows are G-only, order/registration rows F-only,
  -- redemption may hit either wallet
  CHECK (CASE
    WHEN type IN ('MAINTENANCE_ACCRUAL', 'MAINTENANCE_RESET') THEN wallet = 'G'
    WHEN type = 'REDEMPTION' THEN 1
    ELSE wallet = 'F' END),
  -- linkage discipline: each reference column is set exactly when its type demands
  CHECK ((order_id        IS NOT NULL) = (type IN ('CUSTOMER_REWARD', 'CUSTOMER_REFERRAL_BONUS'))),
  CHECK ((subject_user_id IS NOT NULL) = (type IN ('REGISTRATION_BONUS', 'REFERRAL_SIGNUP_BONUS'))),
  CHECK ((period_index    IS NOT NULL) = (type IN ('MAINTENANCE_ACCRUAL', 'MAINTENANCE_RESET'))),
  CHECK ((idempotency_key IS NOT NULL) = (type = 'REDEMPTION'))
);

-- Idempotency indexes — each kills a specific race (tech-spec §6):
-- R1: an order pays each bonus type at most once, ever (double-approve backstop)
CREATE UNIQUE INDEX uq_ledger_order_type
  ON point_ledger(order_id, type) WHERE order_id IS NOT NULL;
-- R2: one registration event pays each bonus type at most once (self + referrer legs share
--     the same subject_user_id but differ in user_id)
CREATE UNIQUE INDEX uq_ledger_subject_type
  ON point_ledger(subject_user_id, type) WHERE subject_user_id IS NOT NULL;
-- R3: each (user, period) accrues once and resets at most once (cron overlap/catch-up)
CREATE UNIQUE INDEX uq_ledger_user_period_type
  ON point_ledger(user_id, period_index, type) WHERE period_index IS NOT NULL;
-- R4: redemption replay protection (one key may carry one F row and one G row)
CREATE UNIQUE INDEX uq_ledger_idem
  ON point_ledger(idempotency_key, wallet) WHERE idempotency_key IS NOT NULL;

-- Query indexes:
-- covering index: SUM(points) per (user, wallet) never touches the table
CREATE INDEX idx_ledger_user_wallet_points ON point_ledger(user_id, wallet, points);
-- history pagination (created_at DESC, id DESC as stable tiebreak)
CREATE INDEX idx_ledger_user_created ON point_ledger(user_id, created_at, id);
