ALTER TABLE users ADD COLUMN clerk_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_user_id
  ON users(clerk_user_id)
  WHERE clerk_user_id IS NOT NULL;

ALTER TABLE sessions ADD COLUMN clerk_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_clerk_session_id
  ON sessions(clerk_session_id)
  WHERE clerk_session_id IS NOT NULL;
