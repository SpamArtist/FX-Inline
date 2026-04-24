CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  clerk_user_id TEXT,
  display_name TEXT,
  created_at BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_user_id
  ON users(clerk_user_id)
  WHERE clerk_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  preferred_currency TEXT NOT NULL,
  allowed_origins_json TEXT NOT NULL,
  allowed_paths_json TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS client_members (
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY(client_id, user_id),
  FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS client_settings_versions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  version BIGINT NOT NULL,
  settings_json TEXT NOT NULL,
  created_by_user_id TEXT,
  created_at BIGINT NOT NULL,
  UNIQUE(client_id, version),
  FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS plugin_artifacts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  version BIGINT NOT NULL,
  artifact_url TEXT NOT NULL,
  integrity TEXT NOT NULL,
  status TEXT NOT NULL,
  created_by_user_id TEXT,
  created_at BIGINT NOT NULL,
  UNIQUE(client_id, kind, version),
  FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS manifest_versions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  version BIGINT NOT NULL,
  manifest_json TEXT NOT NULL,
  signature TEXT NOT NULL,
  key_id TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE(client_id, version),
  FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  clerk_session_id TEXT,
  csrf_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_clerk_session_id
  ON sessions(clerk_session_id)
  WHERE clerk_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  user_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT,
  created_at BIGINT NOT NULL,
  FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
