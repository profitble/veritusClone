-- Migration: 20251231182710_create_cost_optimization_tables
-- Created: 2025-12-31 18:27:10

-- 1. Processed Photos Cache (URL-based deduplication)
CREATE TABLE IF NOT EXISTS processed_photos (
  url TEXT PRIMARY KEY,
  has_face BOOLEAN NOT NULL,
  ratings JSONB,
  total_score INTEGER,
  explanation TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_photos_url ON processed_photos(url);
CREATE INDEX IF NOT EXISTS idx_processed_photos_has_face ON processed_photos(has_face);

-- 2. Profile State (Cursor tracking for incremental updates)
CREATE TABLE IF NOT EXISTS profile_state (
  user_id BIGINT PRIMARY KEY,
  last_cursor TEXT,
  last_processed_at TIMESTAMPTZ DEFAULT NOW(),
  total_posts_count INTEGER
);

CREATE INDEX IF NOT EXISTS idx_profile_state_user_id ON profile_state(user_id);

-- 3. API Usage Logs (Cost tracking)
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  api TEXT NOT NULL CHECK (api IN ('ensemble', 'grok')),
  endpoint TEXT,
  units INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd REAL NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_session_id ON api_usage_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_timestamp ON api_usage_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_api ON api_usage_logs(api);

