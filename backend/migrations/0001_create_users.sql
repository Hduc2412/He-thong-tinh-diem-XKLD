-- Users: the single table auth (and everything later) hangs off of.
CREATE TABLE users (
  id            TEXT PRIMARY KEY,              -- UUID
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,          -- login identity (de-facto unique id)
  password_hash TEXT NOT NULL,                 -- pbkdf2$<iter>$<saltB64>$<hashB64>
  role          TEXT NOT NULL DEFAULT 'USER'
                  CHECK (role IN ('SUPER_ADMIN', 'USER')),
  referrer_id   TEXT REFERENCES users(id),     -- who referred them; NULL for admin + root users
  referral_code TEXT NOT NULL UNIQUE,          -- their own code (defaults to phone)
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL                  -- ISO 8601 timestamp
);

-- At most ONE super admin, ever — enforced by the database itself.
CREATE UNIQUE INDEX one_super_admin ON users(role) WHERE role = 'SUPER_ADMIN';

-- Referral lookups (resolving referrers, future network queries).
CREATE INDEX idx_users_referrer ON users(referrer_id);
