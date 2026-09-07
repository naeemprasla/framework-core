ALTER TABLE core.framework_settings ADD COLUMN IF NOT EXISTS server_type text NOT NULL DEFAULT 'local' CHECK(server_type IN ('local','live'));
ALTER TABLE core.framework_settings ADD COLUMN IF NOT EXISTS application_name text;

ALTER TABLE core.applications ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'fullstack' CHECK(delivery_mode IN ('fullstack','headless','hybrid'));
ALTER TABLE core.applications ADD COLUMN IF NOT EXISTS api_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE core.applications ADD COLUMN IF NOT EXISTS cors_allowed_origins jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS core.application_settings (
  app_id text NOT NULL REFERENCES core.applications(app_id) ON DELETE CASCADE,
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL DEFAULT 'null'::jsonb,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(app_id,setting_key)
);

CREATE TABLE IF NOT EXISTS core.module_settings (
  app_id text NOT NULL REFERENCES core.applications(app_id) ON DELETE CASCADE,
  module_id text NOT NULL,
  setting_key text NOT NULL,
  setting_value jsonb,
  secret_ciphertext text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(app_id,module_id,setting_key),
  CHECK ((setting_value IS NOT NULL) <> (secret_ciphertext IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS core.runtime_settings (
  setting_group text NOT NULL,
  setting_key text NOT NULL,
  setting_value jsonb,
  secret_ciphertext text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(setting_group,setting_key),
  CHECK ((setting_value IS NOT NULL) <> (secret_ciphertext IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS core.api_credentials (
  credential_id text PRIMARY KEY,
  app_id text NOT NULL REFERENCES core.applications(app_id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_api_credentials_app ON core.api_credentials(app_id,status);
ALTER TABLE core.applications ADD COLUMN IF NOT EXISTS active_theme_id text;
