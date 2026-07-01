-- Knowledge Base file/folder manager tables.
-- Mirrors KNOWLEDGEBASE_IMPLEMENTATION.md using Supabase/RLS for this Vite app.

CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  size BIGINT NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  shared_with JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS folders_name_user_id_unique
ON public.folders (user_id, lower(name))
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_folders_user_created
ON public.folders (user_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_folders_shared_with
ON public.folders USING GIN (shared_with);

CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID NULL REFERENCES public.folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  path TEXT NOT NULL,
  url TEXT NOT NULL,
  s3_key TEXT NULL,
  storage_type TEXT NOT NULL DEFAULT 'local' CHECK (storage_type IN ('local', 's3')),
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  openai JSONB NULL,
  shared_with JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_files_user_created
ON public.files (user_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_user_folder
ON public.files (user_id, folder_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_user_type
ON public.files (user_id, type)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_storage_type
ON public.files (storage_type);

CREATE INDEX IF NOT EXISTS idx_files_shared_with
ON public.files USING GIN (shared_with);

CREATE OR REPLACE FUNCTION public.update_knowledge_manager_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS folders_updated_at ON public.folders;
CREATE TRIGGER folders_updated_at
BEFORE UPDATE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.update_knowledge_manager_updated_at();

DROP TRIGGER IF EXISTS files_updated_at ON public.files;
CREATE TRIGGER files_updated_at
BEFORE UPDATE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.update_knowledge_manager_updated_at();

CREATE OR REPLACE FUNCTION public.refresh_knowledge_folder_stats(folder_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF folder_uuid IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.folders
  SET
    size = COALESCE((
      SELECT SUM(size)
      FROM public.files
      WHERE folder_id = folder_uuid AND deleted_at IS NULL
    ), 0),
    file_count = COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.files
      WHERE folder_id = folder_uuid AND deleted_at IS NULL
    ), 0)
  WHERE id = folder_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_knowledge_folder_stats_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.refresh_knowledge_folder_stats(NEW.folder_id);
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.refresh_knowledge_folder_stats(OLD.folder_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS files_refresh_folder_stats ON public.files;
CREATE TRIGGER files_refresh_folder_stats
AFTER INSERT OR UPDATE OR DELETE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.refresh_knowledge_folder_stats_trigger();

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read owned or shared folders" ON public.folders;
CREATE POLICY "Users can read owned or shared folders"
ON public.folders FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    user_id = auth.uid()
    OR is_public
    OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
  )
);

DROP POLICY IF EXISTS "Users can create own folders" ON public.folders;
CREATE POLICY "Users can create own folders"
ON public.folders FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners and write shares can update folders" ON public.folders;
CREATE POLICY "Owners and write shares can update folders"
ON public.folders FOR UPDATE
USING (
  user_id = auth.uid()
  OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
)
WITH CHECK (
  user_id = auth.uid()
  OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
);

DROP POLICY IF EXISTS "Owners can delete folders" ON public.folders;
CREATE POLICY "Owners can delete folders"
ON public.folders FOR DELETE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read owned shared or folder shared files" ON public.files;
CREATE POLICY "Users can read owned shared or folder shared files"
ON public.files FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    user_id = auth.uid()
    OR is_public
    OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
    OR EXISTS (
      SELECT 1
      FROM public.folders
      WHERE folders.id = files.folder_id
        AND folders.deleted_at IS NULL
        AND (
          folders.user_id = auth.uid()
          OR folders.is_public
          OR folders.shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
        )
    )
  )
);

DROP POLICY IF EXISTS "Users can create own files" ON public.files;
CREATE POLICY "Users can create own files"
ON public.files FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners and write shares can update files" ON public.files;
CREATE POLICY "Owners and write shares can update files"
ON public.files FOR UPDATE
USING (
  user_id = auth.uid()
  OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
  OR EXISTS (
    SELECT 1
    FROM public.folders
    WHERE folders.id = files.folder_id
      AND folders.shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
  OR EXISTS (
    SELECT 1
    FROM public.folders
    WHERE folders.id = files.folder_id
      AND folders.shared_with @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'permissions', 'write'))
  )
);

DROP POLICY IF EXISTS "Owners can delete files" ON public.files;
CREATE POLICY "Owners can delete files"
ON public.files FOR DELETE
USING (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledgebase', 'knowledgebase', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Knowledgebase users can read storage objects" ON storage.objects;
CREATE POLICY "Knowledgebase users can read storage objects"
ON storage.objects FOR SELECT
USING (bucket_id = 'knowledgebase');

DROP POLICY IF EXISTS "Knowledgebase users can upload own storage objects" ON storage.objects;
CREATE POLICY "Knowledgebase users can upload own storage objects"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'knowledgebase'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Knowledgebase users can update own storage objects" ON storage.objects;
CREATE POLICY "Knowledgebase users can update own storage objects"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'knowledgebase'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'knowledgebase'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Knowledgebase users can delete own storage objects" ON storage.objects;
CREATE POLICY "Knowledgebase users can delete own storage objects"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'knowledgebase'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
