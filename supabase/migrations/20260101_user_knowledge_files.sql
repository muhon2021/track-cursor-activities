-- User knowledge files table for tracking uploaded documents
-- This table stores metadata about files uploaded to the knowledge base
-- Supports file tracking, processing status, and Google Drive sync

CREATE TABLE IF NOT EXISTS public.user_knowledge_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_id text, -- External ID (e.g., Google Drive file ID)
  source_type text DEFAULT 'upload', -- 'upload', 'google_drive', 'zoom', etc.
  file_name text NOT NULL,
  file_path text, -- Storage path or URL
  file_size bigint,
  mime_type text,
  processing_status text DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  processing_error text,
  metadata jsonb DEFAULT '{}'::jsonb, -- Additional file metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_user_knowledge_files_user_id ON public.user_knowledge_files(user_id);
CREATE INDEX idx_user_knowledge_files_status ON public.user_knowledge_files(processing_status);
CREATE INDEX idx_user_knowledge_files_source ON public.user_knowledge_files(source_type, source_id);
CREATE INDEX idx_user_knowledge_files_created_at ON public.user_knowledge_files(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_knowledge_files ENABLE ROW LEVEL SECURITY;

-- Users can view their own files
CREATE POLICY "Users can view own files"
  ON public.user_knowledge_files
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own files
CREATE POLICY "Users can insert own files"
  ON public.user_knowledge_files
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own files
CREATE POLICY "Users can update own files"
  ON public.user_knowledge_files
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
  ON public.user_knowledge_files
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all files
CREATE POLICY "Admins can view all files"
  ON public.user_knowledge_files
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_user_knowledge_files_updated_at
  BEFORE UPDATE ON public.user_knowledge_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get file statistics
CREATE OR REPLACE FUNCTION public.get_user_file_stats(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_files', COUNT(*),
    'total_size', COALESCE(SUM(file_size), 0),
    'pending', COUNT(*) FILTER (WHERE processing_status = 'pending'),
    'processing', COUNT(*) FILTER (WHERE processing_status = 'processing'),
    'completed', COUNT(*) FILTER (WHERE processing_status = 'completed'),
    'failed', COUNT(*) FILTER (WHERE processing_status = 'failed'),
    'by_source', jsonb_object_agg(source_type, source_count)
  )
  INTO v_stats
  FROM public.user_knowledge_files
  CROSS JOIN LATERAL (
    SELECT source_type, COUNT(*) as source_count
    FROM public.user_knowledge_files
    WHERE user_id = p_user_id
    GROUP BY source_type
  ) source_stats
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_stats, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
