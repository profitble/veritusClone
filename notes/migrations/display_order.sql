-- Migration: 20260101204111_add_display_order_to_media_items
-- Created: 2026-01-01 20:41:11

ALTER TABLE media_items ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Set display_order based on created_at for existing records
UPDATE media_items
SET display_order = subquery.row_number
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_number
  FROM media_items
) AS subquery
WHERE media_items.id = subquery.id;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_media_items_display_order ON media_items(display_order);

