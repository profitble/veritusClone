-- Migration: 20260102205311_add_anchor_generation_fields
-- Created: 2026-01-02 20:53:11

-- Add src field (source type)
ALTER TABLE identities 
ADD COLUMN src TEXT DEFAULT 'sd' CHECK (src IN ('sd', 'anc'));

-- Add gen_st field (generation status)
ALTER TABLE identities 
ADD COLUMN gen_st TEXT CHECK (gen_st IN ('gen', 'done'));

-- Add gen_id field (generation batch ID)
ALTER TABLE identities 
ADD COLUMN gen_id UUID;

-- Set default for existing records
UPDATE identities SET src = 'sd' WHERE src IS NULL;

-- Add indexes for performance
CREATE INDEX idx_identities_src ON identities(instagram_username, src);
CREATE INDEX idx_identities_gen_st ON identities(instagram_username, gen_st);
CREATE INDEX idx_identities_gen_id ON identities(gen_id);

