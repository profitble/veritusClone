-- Complete Database Schema Dump
-- Generated: 2026-01-03
-- Project: Argon Labs
-- Database: zvfmtnjvnttrmdqviyso

-- ============================================================================
-- TABLES
-- ============================================================================

-- Table: api_usage_logs
CREATE TABLE public.api_usage_logs (
  id bigint NOT NULL DEFAULT nextval('api_usage_logs_id_seq'::regclass),
  session_id text NOT NULL,
  api text NOT NULL CHECK (api IN ('ensemble', 'grok')),
  endpoint text,
  units integer,
  input_tokens integer,
  output_tokens integer,
  cost_usd real NOT NULL,
  "timestamp" timestamp with time zone DEFAULT now(),
  CONSTRAINT api_usage_logs_pkey PRIMARY KEY (id)
);

-- Table: identities
CREATE TABLE public.identities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  status text DEFAULT 'processing'::text CHECK (status IN ('processing', 'completed', 'failed')),
  instagram_username text,
  source_media_ids uuid[],
  src text DEFAULT 'sd'::text CHECK (src IS NULL OR src IN ('sd', 'anc', 'var')),
  gen_st text CHECK (gen_st IN ('gen', 'done')),
  gen_id uuid,
  is_primary boolean DEFAULT false,
  CONSTRAINT identities_pkey PRIMARY KEY (id)
);

-- Table: media_items
CREATE TABLE public.media_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('photo', 'video', 'frame')),
  source text NOT NULL CHECK (source IN ('instagram', 'upload', 'extracted')),
  url text NOT NULL,
  thumbnail_url text,
  caption text,
  instagram_id text,
  parent_video_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  display_order integer,
  instagram_username text,
  CONSTRAINT media_items_pkey PRIMARY KEY (id),
  CONSTRAINT media_items_parent_video_id_fkey FOREIGN KEY (parent_video_id) 
    REFERENCES media_items(id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Indexes for api_usage_logs
CREATE INDEX idx_api_usage_logs_api ON public.api_usage_logs USING btree (api);
CREATE INDEX idx_api_usage_logs_session_id ON public.api_usage_logs USING btree (session_id);
CREATE INDEX idx_api_usage_logs_timestamp ON public.api_usage_logs USING btree ("timestamp");

-- Indexes for identities
CREATE INDEX idx_identities_created_at ON public.identities USING btree (created_at DESC);
CREATE INDEX idx_identities_gen_id ON public.identities USING btree (gen_id);
CREATE INDEX idx_identities_gen_st ON public.identities USING btree (instagram_username, gen_st);
CREATE INDEX idx_identities_is_primary ON public.identities USING btree (instagram_username, is_primary) WHERE (is_primary = true);
CREATE INDEX idx_identities_src ON public.identities USING btree (instagram_username, src);

-- Indexes for media_items
CREATE INDEX idx_media_items_display_order ON public.media_items USING btree (display_order);
CREATE INDEX idx_media_items_parent_video_id ON public.media_items USING btree (parent_video_id);
CREATE INDEX idx_media_items_source ON public.media_items USING btree (source);
CREATE INDEX idx_media_items_type ON public.media_items USING btree (type);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$function$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_identities_updated_at
  BEFORE UPDATE ON public.identities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_media_items_updated_at
  BEFORE UPDATE ON public.media_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- CONSTRAINTS SUMMARY
-- ============================================================================

-- api_usage_logs constraints:
--   - PRIMARY KEY: id
--   - CHECK: api IN ('ensemble', 'grok')

-- identities constraints:
--   - PRIMARY KEY: id
--   - CHECK: status IN ('processing', 'completed', 'failed')
--   - CHECK: src IS NULL OR src IN ('sd', 'anc', 'var')
--   - CHECK: gen_st IN ('gen', 'done')

-- media_items constraints:
--   - PRIMARY KEY: id
--   - FOREIGN KEY: parent_video_id REFERENCES media_items(id) ON DELETE CASCADE
--   - CHECK: type IN ('photo', 'video', 'frame')
--   - CHECK: source IN ('instagram', 'upload', 'extracted')

