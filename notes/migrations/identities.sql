-- Migration: 20260101181128_reset_database_and_create_identities
-- Created: 2026-01-01 18:11:28

-- Drop old tables
DROP TABLE IF EXISTS processed_photos CASCADE;
DROP TABLE IF EXISTS profile_state CASCADE;

-- Create identities table
CREATE TABLE IF NOT EXISTS identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_identities_created_at ON identities(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_identities_updated_at
  BEFORE UPDATE ON identities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

