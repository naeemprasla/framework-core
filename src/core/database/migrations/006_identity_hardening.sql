-- Harden identity uniqueness and challenge lookup semantics.
-- PostgreSQL expression index keeps email identity case-insensitive without requiring CITEXT.
CREATE UNIQUE INDEX IF NOT EXISTS uq_identity_accounts_email_lower
  ON identity.accounts ((lower(email)));

CREATE INDEX IF NOT EXISTS idx_mfa_challenges_account_active
  ON identity.mfa_challenges (account_id, expires_at)
  WHERE used_at IS NULL;
