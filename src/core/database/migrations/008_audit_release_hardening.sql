ALTER TABLE core.framework_state ADD COLUMN IF NOT EXISTS initial_application_id text;

CREATE TABLE IF NOT EXISTS identity.framework_admin_profiles (
  account_id text PRIMARY KEY REFERENCES identity.accounts(account_id) ON DELETE CASCADE,
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
