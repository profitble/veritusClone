-- Migration: 20260102052403_add_source_media_ids_to_identities
-- Created: 2026-01-02 05:24:03

-- Add source_media_ids column to identities table
ALTER TABLE identities 
ADD COLUMN IF NOT EXISTS source_media_ids uuid[] DEFAULT NULL;

