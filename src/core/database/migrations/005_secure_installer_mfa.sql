CREATE TABLE IF NOT EXISTS core.framework_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  framework_name text NOT NULL DEFAULT 'Framework',
  public_url text,
  admin_url text,
  default_locale text NOT NULL DEFAULT 'en',
  timezone text NOT NULL DEFAULT 'UTC',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO core.framework_settings(singleton) VALUES(true) ON CONFLICT(singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS identity.mfa_methods (
  mfa_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES identity.accounts(account_id) ON DELETE CASCADE,
  method_type text NOT NULL CHECK(method_type IN ('totp')),
  secret_ciphertext text NOT NULL,
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, method_type)
);

CREATE TABLE IF NOT EXISTS identity.mfa_recovery_codes (
  recovery_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES identity.accounts(account_id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mfa_recovery_account_unused ON identity.mfa_recovery_codes(account_id) WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS identity.mfa_challenges (
  challenge_id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES identity.accounts(account_id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  used_at timestamptz,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mfa_challenge_active ON identity.mfa_challenges(token_hash, expires_at) WHERE used_at IS NULL;
