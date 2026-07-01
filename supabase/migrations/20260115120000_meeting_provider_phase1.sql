-- Phase 1: Provider-agnostic meeting schema updates (additive)

-- Add new provider-agnostic columns to meetings
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'zoom',
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_meeting_id TEXT,
  ADD COLUMN IF NOT EXISTS external_uuid TEXT,
  ADD COLUMN IF NOT EXISTS join_url TEXT,
  ADD COLUMN IF NOT EXISTS host_url TEXT;

CREATE INDEX IF NOT EXISTS idx_meetings_provider ON public.meetings(provider);
CREATE INDEX IF NOT EXISTS idx_meetings_external_id ON public.meetings(external_id);

-- Backfill provider-agnostic columns from existing Zoom data
UPDATE public.meetings
SET
  provider = 'zoom',
  external_id = zoom_id,
  external_meeting_id = zoom_meeting_id,
  external_uuid = zoom_uuid,
  join_url = zoom_join_url,
  host_url = zoom_start_url
WHERE zoom_id IS NOT NULL OR zoom_meeting_id IS NOT NULL;

-- Create provider-agnostic meeting_files table (parallel to zoom_files)
CREATE TABLE IF NOT EXISTS public.meeting_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_meeting_files_meeting ON public.meeting_files(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_files_type ON public.meeting_files(file_type);
CREATE INDEX IF NOT EXISTS idx_meeting_files_processed ON public.meeting_files(is_processed);
CREATE INDEX IF NOT EXISTS idx_meeting_files_provider ON public.meeting_files(provider);

-- Copy existing zoom_files data into meeting_files
INSERT INTO public.meeting_files (
  id,
  meeting_id,
  provider,
  external_meeting_id,
  file_type,
  file_name,
  file_size,
  file_path,
  storage_path,
  download_url,
  transcript_text,
  transcript_content,
  is_processed,
  has_embeddings,
  processing_status,
  metadata,
  created_at,
  updated_at
)
SELECT
  id,
  meeting_id,
  'zoom',
  NULL,
  file_type,
  file_name,
  file_size,
  file_path,
  storage_path,
  download_url,
  transcript_text,
  transcript_content,
  is_processed,
  has_embeddings,
  processing_status,
  metadata,
  created_at,
  updated_at
FROM public.zoom_files
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.meeting_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all meeting files"
  ON public.meeting_files FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view meeting files"
  ON public.meeting_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage meeting files for their meetings"
  ON public.meeting_files FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings
      WHERE meetings.id = meeting_files.meeting_id
        AND meetings.organizer_id = auth.uid()
    )
  );

CREATE TRIGGER update_meeting_files_updated_at
  BEFORE UPDATE ON public.meeting_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generalize embeddings table with provider-agnostic columns
ALTER TABLE public.embeddings
  ADD COLUMN IF NOT EXISTS provider_corpus_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_document_id TEXT;

UPDATE public.embeddings
SET
  provider_corpus_id = gemini_corpus_id,
  provider_document_id = gemini_document_id
WHERE gemini_corpus_id IS NOT NULL OR gemini_document_id IS NOT NULL;

-- Add feature flag for generic meetings rollout
INSERT INTO public.app_config (key, value, category, description)
VALUES (
  'features.useGenericMeetings',
  'false',
  'features',
  'Use provider-agnostic meeting data and UI'
)
ON CONFLICT (key) DO NOTHING;
