-- ============================================
-- Storage Buckets for SJ Innovation Framework
-- Phase 2.3: user-knowledge, meeting-recordings, knowledge-files
-- ============================================

-- 1. Create the storage buckets (all private)
INSERT INTO storage.buckets (id, name, public) VALUES ('user-knowledge', 'user-knowledge', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-recordings', 'meeting-recordings', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-files', 'knowledge-files', false);

-- ============================================
-- RLS Policies for user-knowledge bucket
-- Users can only access their own folder: {user_id}/
-- ============================================

CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-knowledge' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-knowledge' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-knowledge' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-knowledge' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- RLS Policies for meeting-recordings bucket
-- Authenticated users can read, only service role can write
-- ============================================

CREATE POLICY "Authenticated users can view meeting recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'meeting-recordings');

-- No INSERT/UPDATE/DELETE policies for users - service role handles uploads

-- ============================================
-- RLS Policies for knowledge-files bucket
-- Authenticated can read, admins can write
-- ============================================

CREATE POLICY "Authenticated users can view knowledge files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'knowledge-files');

CREATE POLICY "Admins can upload knowledge files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'knowledge-files' 
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update knowledge files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'knowledge-files' 
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete knowledge files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'knowledge-files' 
  AND public.has_role(auth.uid(), 'admin')
);