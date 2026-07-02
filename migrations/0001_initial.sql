CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id TEXT NOT NULL UNIQUE,
  brand_name TEXT NOT NULL DEFAULT 'AI星球',
  client_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  session_at TEXT NOT NULL,
  session_mode TEXT NOT NULL,
  core_issue TEXT NOT NULL,
  truth_confirmed INTEGER NOT NULL DEFAULT 1,
  service_confirmed INTEGER NOT NULL DEFAULT 1,
  signature_data TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  record_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'scheduled', 'completed', 'archived')),
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at
  ON submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_session_at
  ON submissions(session_at);
CREATE INDEX IF NOT EXISTS idx_submissions_status
  ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_client_name
  ON submissions(client_name);

CREATE TABLE IF NOT EXISTS submission_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_submission_events_ip_time
  ON submission_events(ip_hash, created_at);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_ip_time
  ON admin_login_attempts(ip_hash, created_at);
