-- ============================================================
-- Smart Line — Day 5, Task 64: refresh token storage (rotating,
-- revoked, hashed). Up-only additions to the Day 3 schema.
-- ============================================================

CREATE TABLE refresh_tokens (
  id         BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_account ON refresh_tokens (account_id);
