-- Migration: 20260101213258_add_instagram_username_to_identities
-- Created: 2026-01-01 21:32:58

ALTER TABLE identities ADD COLUMN IF NOT EXISTS instagram_username TEXT;

