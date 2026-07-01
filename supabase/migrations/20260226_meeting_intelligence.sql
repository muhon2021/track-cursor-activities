-- ============================================================================
-- MIGRATION: Meeting Intelligence (Transcripts + Action Items)
-- Date: 2026-02-26
-- Purpose: Add transcript_status and related columns to meetings table
--          to support the Meeting Intelligence MVP (Sprint 9.1-9.2).
-- ============================================================================

-- 1. Add transcript pipeline columns to meetings table
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS transcript_status text DEFAULT 'pending'
    CHECK (transcript_status IN ('pending', 'processing', 'complete', 'failed')),
  ADD COLUMN IF NOT EXISTS transcript_raw jsonb,
  ADD COLUMN IF NOT EXISTS transcript_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS transcript_error text,
  ADD COLUMN IF NOT EXISTS transcript_processing_started_at timestamptz;

-- 2. Create GIN index for transcript full-text search on transcript_content
--    (transcript_content TEXT column already exists from prior migration)
CREATE INDEX IF NOT EXISTS idx_meetings_transcript_fts
  ON public.meetings
  USING GIN (to_tsvector('english', COALESCE(transcript_content, '')));

-- 3. Create index for transcript status queries
CREATE INDEX IF NOT EXISTS idx_meetings_transcript_status
  ON public.meetings (transcript_status)
  WHERE transcript_status IS NOT NULL AND transcript_status <> 'complete';
