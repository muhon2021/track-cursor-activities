-- Enable RLS on meeting_transcripts table
ALTER TABLE public.meeting_transcripts ENABLE ROW LEVEL SECURITY;

-- Create policies for meeting_transcripts
-- Users can view transcripts for meetings they organized
CREATE POLICY "Users can view transcripts for their meetings"
  ON public.meeting_transcripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings 
      WHERE meetings.id = meeting_transcripts.meeting_id 
      AND meetings.organizer_id = auth.uid()
    )
  );

-- Users can insert transcripts for meetings they organized
CREATE POLICY "Users can insert transcripts for their meetings"
  ON public.meeting_transcripts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meetings 
      WHERE meetings.id = meeting_transcripts.meeting_id 
      AND meetings.organizer_id = auth.uid()
    )
  );

-- Admins can manage all transcripts
CREATE POLICY "Admins can manage all transcripts"
  ON public.meeting_transcripts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));