-- Migration: 20260101201601_create_media_items_table
-- Created: 2026-01-01 20:16:01

CREATE TABLE IF NOT EXISTS media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('photo', 'video', 'frame')),
  source TEXT NOT NULL CHECK (source IN ('instagram', 'upload', 'extracted')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  instagram_id TEXT,
  parent_video_id UUID REFERENCES media_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_items_type ON media_items(type);
CREATE INDEX IF NOT EXISTS idx_media_items_source ON media_items(source);
CREATE INDEX IF NOT EXISTS idx_media_items_parent_video_id ON media_items(parent_video_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_media_items_updated_at
BEFORE UPDATE ON media_items
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

