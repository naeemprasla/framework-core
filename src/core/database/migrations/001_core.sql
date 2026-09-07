CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE IF NOT EXISTS core.framework_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  instance_id uuid NOT NULL,
  installation_status varchar(32) NOT NULL CHECK (installation_status IN ('UNINITIALIZED','MIGRATING','SETUP_REQUIRED','INITIALIZED','MAINTENANCE','UPGRADING','FAILED')),
  schema_version integer NOT NULL DEFAULT 1,
  framework_version varchar(32) NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT now(),
  initialized_at timestamptz,
  initial_admin_created_at timestamptz,
  setup_locked_at timestamptz
);

INSERT INTO core.framework_state (singleton, instance_id, installation_status, framework_version)
VALUES (true, gen_random_uuid(), 'SETUP_REQUIRED', '0.1.0')
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS core.applications (
  app_id varchar(64) PRIMARY KEY,
  name varchar(160) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PROVISIONING','ACTIVE','SUSPENDED','ARCHIVED')),
  base_url text,
  tenant_mode varchar(32) NOT NULL DEFAULT 'OPTIONAL' CHECK (tenant_mode IN ('DISABLED','OPTIONAL','REQUIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON core.applications(status);
