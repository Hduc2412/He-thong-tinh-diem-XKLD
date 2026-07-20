-- Orders: "customer went abroad" reports. Self-created by a user (creator = beneficiary),
-- decided exactly once by the super admin (PRD §6.3, tech-spec §3.1).
CREATE TABLE orders (
  id         TEXT PRIMARY KEY,                    -- UUID
  user_id    TEXT NOT NULL REFERENCES users(id),  -- creator = beneficiary (PRD §6.3)
  note       TEXT,                                -- optional, <= 500 chars (API-enforced)
  status     TEXT NOT NULL DEFAULT 'PENDING'
               CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  decided_by TEXT REFERENCES users(id),           -- the super admin who decided
  decided_at TEXT,                                -- ISO 8601 UTC
  created_at TEXT NOT NULL,
  -- decision fields are set iff the order is decided
  CHECK ((status =  'PENDING' AND decided_by IS NULL     AND decided_at IS NULL)
      OR (status <> 'PENDING' AND decided_by IS NOT NULL AND decided_at IS NOT NULL))
);

CREATE INDEX idx_orders_user_created   ON orders(user_id, created_at);   -- user's own list
CREATE INDEX idx_orders_status_created ON orders(status, created_at);    -- admin PENDING queue
-- rolling-window lookups: "APPROVED orders of user X decided in [a, b)"
CREATE INDEX idx_orders_user_approved  ON orders(user_id, decided_at) WHERE status = 'APPROVED';
