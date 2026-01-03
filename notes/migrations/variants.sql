-- Migration: 20260103183140_update_src_check_constraint_for_variants
-- Created: 2026-01-03 18:31:40

-- Update src check constraint to include 'var'
ALTER TABLE identities DROP CONSTRAINT IF EXISTS identities_src_check;

ALTER TABLE identities ADD CONSTRAINT identities_src_check 
CHECK (src IS NULL OR src IN ('sd', 'anc', 'var'));

