-- Migration: 20260103181717_add_is_primary_column
-- Created: 2026-01-03 18:17:17

-- Add is_primary column to identities table
ALTER TABLE identities
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_identities_is_primary 
ON identities(instagram_username, is_primary) 
WHERE is_primary = true;

