-- Migration: 20260102034808_add_instagram_username_to_media_items
-- Created: 2026-01-02 03:48:08

-- Add instagram_username column to media_items table
ALTER TABLE media_items
ADD COLUMN IF NOT EXISTS instagram_username TEXT;

