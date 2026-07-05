-- Phase 1: Provider-Agnostic Meeting System Migration
-- This migration adds generic columns while keeping old columns functional

-- Step 1.1: Add Generic Columns to meetings Table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'zoom';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS external_meeting_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS external_uuid TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS join_url TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS host_url TEXT;

-- Create indexes for provider-based queries
CREATE INDEX IF NOT EXISTS idx_meetings_provider ON meetings(provider);
CREATE INDEX IF NOT EXISTS idx_meetings_external_id ON meetings(external_id);

-- Step 1.2: Backfill Existing Data from Zoom columns
UPDATE meetings SET
  provider = 'zoom',
  external_id = zoom_id,
  external_meeting_id = zoom_meeting_id,
  external_uuid = zoom_uuid,
  join_url = zoom_join_url,
  host_url = zoom_start_url
WHERE zoom_id IS NOT NULL OR zoom_meeting_id IS NOT NULL;

-- Step 1.3: Create meeting_files Table (Provider-Agnostic)
CREATE TABLE IF NOT EXISTS meeting_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'zoom',
  external_meeting_id TEXT,
  file_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_path TEXT,
  storage_path TEXT,
  download_url TEXT,
  transcript_text TEXT,
  transcript_content JSONB,
  is_processed BOOLEAN DEFAULT false,
  has_embeddings BOOLEAN DEFAULT false,
  processing_status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for meeting_files
CREATE INDEX IF NOT EXISTS idx_meeting_files_meeting_id ON meeting_files(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_files_provider ON meeting_files(provider);

-- Copy existing zoom_files data to meeting_files
INSERT INTO meeting_files (
  id, meeting_id, provider, external_meeting_id, file_type, file_name,
  file_size, file_path, storage_path, download_url, transcript_text,
  transcript_content, is_processed, has_embeddings, processing_status,
  metadata, created_at, updated_at
)
SELECT
  id, meeting_id, 'zoom', NULL, file_type, file_name,
  file_size, file_path, storage_path, download_url, transcript_text,
  transcript_content, is_processed, has_embeddings, processing_status,
  COALESCE(metadata, '{}'::jsonb), created_at, updated_at
FROM zoom_files
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on meeting_files
ALTER TABLE meeting_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meeting_files
DROP POLICY IF EXISTS "Admins can manage all meeting files" ON meeting_files;
CREATE POLICY "Admins can manage all meeting files"
  ON meeting_files FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view meeting files" ON meeting_files;
CREATE POLICY "Authenticated users can view meeting files"
  ON meeting_files FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can manage meeting files for their meetings" ON meeting_files;
CREATE POLICY "Users can manage meeting files for their meetings"
  ON meeting_files FOR ALL
  USING (EXISTS (
    SELECT 1 FROM meetings
    WHERE meetings.id = meeting_files.meeting_id
    AND meetings.organizer_id = auth.uid()
  ));

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_meeting_files_updated_at ON meeting_files;
CREATE TRIGGER update_meeting_files_updated_at
  BEFORE UPDATE ON meeting_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 1.4: Generalize embeddings Table
ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS provider_corpus_id TEXT;
ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS provider_document_id TEXT;

-- Backfill from Gemini-specific columns
UPDATE embeddings SET
  provider_corpus_id = gemini_corpus_id,
  provider_document_id = gemini_document_id
WHERE gemini_corpus_id IS NOT NULL OR gemini_document_id IS NOT NULL;

-- Add useGenericMeetings feature flag
INSERT INTO app_config (key, value, category, description)
VALUES (
  'useGenericMeetings',
  'false'::jsonb,
  'features',
  'Enable provider-agnostic meeting system (Phase 1-3 rollout)'
)
ON CONFLICT (key) DO UPDATE SET
  value = 'false'::jsonb,
  description = 'Enable provider-agnostic meeting system (Phase 1-3 rollout)',
  updated_at = now();