-- Migration: 20260101183343_add_status_to_identities
-- Created: 2026-01-01 18:33:43

ALTER TABLE identities 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'processing' 
CHECK (status IN ('processing', 'completed', 'failed'));

