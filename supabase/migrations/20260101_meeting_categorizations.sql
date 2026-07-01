-- Create meeting_categorizations table
-- This table stores AI-powered categorization of meeting transcripts
-- Used by categorize-meeting edge function

CREATE TABLE public.meeting_categorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_file_id UUID NOT NULL REFERENCES public.zoom_files(id) ON DELETE CASCADE,
  primary_category TEXT,
  secondary_categories TEXT[],
  key_topics TEXT[],
  sentiment TEXT,
  category_confidence NUMERIC,
  analysis_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meeting_file_id)
);

-- Create indexes for common queries
CREATE INDEX idx_meeting_categorizations_file ON public.meeting_categorizations(meeting_file_id);
CREATE INDEX idx_meeting_categorizations_primary_category ON public.meeting_categorizations(primary_category);
CREATE INDEX idx_meeting_categorizations_created ON public.meeting_categorizations(created_at DESC);

-- Enable RLS
ALTER TABLE public.meeting_categorizations ENABLE ROW LEVEL SECURITY;

-- Users can view categorizations for meetings they organized
CREATE POLICY "Users can view categorizations for their meetings"
  ON public.meeting_categorizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.zoom_files
      JOIN public.meetings ON zoom_files.meeting_id = meetings.id
      WHERE zoom_files.id = meeting_categorizations.meeting_file_id
        AND meetings.organizer_id = auth.uid()
    )
  );

-- Service role can insert/update categorizations (called by edge function)
CREATE POLICY "Service can manage all categorizations"
  ON public.meeting_categorizations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can manage all categorizations
CREATE POLICY "Admins can manage all categorizations"
  ON public.meeting_categorizations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_meeting_categorizations_updated_at
  BEFORE UPDATE ON public.meeting_categorizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
