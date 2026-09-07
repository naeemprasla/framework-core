CREATE TABLE IF NOT EXISTS identity.framework_admins (
  account_id text PRIMARY KEY REFERENCES identity.accounts(account_id) ON DELETE CASCADE,
  framework_role text NOT NULL CHECK (framework_role IN ('super_admin','admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE identity.accounts
  DROP CONSTRAINT IF EXISTS identity_accounts_authority_domain_check;
ALTER TABLE identity.accounts
  ADD CONSTRAINT identity_accounts_authority_domain_check CHECK (authority_domain IN ('framework','application')) NOT VALID;
ALTER TABLE identity.accounts VALIDATE CONSTRAINT identity_accounts_authority_domain_check;

ALTER TABLE identity.accounts
  DROP CONSTRAINT IF EXISTS identity_accounts_status_check;
ALTER TABLE identity.accounts
  ADD CONSTRAINT identity_accounts_status_check CHECK (status IN ('active','suspended','disabled','closed')) NOT VALID;
ALTER TABLE identity.accounts VALIDATE CONSTRAINT identity_accounts_status_check;

ALTER TABLE identity.sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
UPDATE identity.sessions SET last_seen_at = COALESCE(last_seen_at, created_at) WHERE last_seen_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_token_active ON identity.sessions(token_hash) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS identity.login_attempts (
  attempt_id bigserial PRIMARY KEY,
  email text NOT NULL,
  success boolean NOT NULL,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON identity.login_attempts(lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON identity.login_attempts(ip, created_at DESC) WHERE ip IS NOT NULL;

ALTER TABLE core.tenants
  ADD CONSTRAINT tenants_app_fk FOREIGN KEY (app_id) REFERENCES core.applications(app_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE core.tenants VALIDATE CONSTRAINT tenants_app_fk;

ALTER TABLE core.application_modules
  ADD CONSTRAINT application_modules_app_fk FOREIGN KEY (app_id) REFERENCES core.applications(app_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE core.application_modules VALIDATE CONSTRAINT application_modules_app_fk;
