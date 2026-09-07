ALTER TABLE infrastructure.outbox_events ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;
ALTER TABLE infrastructure.outbox_events ADD COLUMN IF NOT EXISTS last_error text;
UPDATE infrastructure.outbox_events SET next_attempt_at=COALESCE(next_attempt_at,created_at) WHERE next_attempt_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_outbox_ready ON infrastructure.outbox_events(status,next_attempt_at,created_at) WHERE status='pending';

CREATE TABLE IF NOT EXISTS infrastructure.jobs (
  job_id text PRIMARY KEY,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('pending','processing','completed','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts >= 1 AND max_attempts <= 100),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  failed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_jobs_ready ON infrastructure.jobs(status,available_at,created_at) WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_jobs_locked ON infrastructure.jobs(status,locked_at) WHERE status='processing';
