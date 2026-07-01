-- Create meeting_transcripts table
-- This table stores processed transcripts from Zoom meetings
-- Referenced by existing RLS policies in migration 20251231214950

CREATE TABLE public.meeting_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  zoom_file_id UUID REFERENCES public.zoom_files(id) ON DELETE CASCADE,
  full_transcript TEXT NOT NULL,
  transcript_segments JSONB,
  language TEXT DEFAULT 'en',
  word_count INTEGER,
  speaker_count INTEGER,
  summary TEXT,
  key_topics TEXT[],
  action_items TEXT[],
  key_decisions TEXT[],
  follow_up_topics TEXT[],
  has_embeddings BOOLEAN DEFAULT false,
  embedding_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_meeting_transcripts_meeting ON public.meeting_transcripts(meeting_id);
CREATE INDEX idx_meeting_transcripts_zoom_file ON public.meeting_transcripts(zoom_file_id);
CREATE INDEX idx_meeting_transcripts_has_embeddings ON public.meeting_transcripts(has_embeddings);
CREATE INDEX idx_meeting_transcripts_created ON public.meeting_transcripts(created_at DESC);

-- Enable RLS (policies already exist in migration 20251231214950)
-- This migration must run before that one or the RLS migration will fail
ALTER TABLE public.meeting_transcripts ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_meeting_transcripts_updated_at
  BEFORE UPDATE ON public.meeting_transcripts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
