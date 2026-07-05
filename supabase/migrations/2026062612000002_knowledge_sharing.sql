-- Knowledge sharing: user directory access + per-user hidden shared items.

DROP POLICY IF EXISTS "Authenticated users can view profile directory" ON public.profiles;
CREATE POLICY "Authenticated users can view profile directory"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE TABLE IF NOT EXISTS public.knowledge_hidden_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('file', 'folder')),
  resource_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_hidden_items_user
ON public.knowledge_hidden_items (user_id, resource_type);

ALTER TABLE public.knowledge_hidden_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own hidden knowledge items" ON public.knowledge_hidden_items;
CREATE POLICY "Users manage own hidden knowledge items"
ON public.knowledge_hidden_items FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.prevent_non_owner_share_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.shared_with IS DISTINCT FROM OLD.shared_with THEN
    RAISE EXCEPTION 'Only the owner can manage sharing';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS files_prevent_non_owner_share_changes ON public.files;
CREATE TRIGGER files_prevent_non_owner_share_changes
BEFORE UPDATE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_owner_share_changes();

DROP TRIGGER IF EXISTS folders_prevent_non_owner_share_changes ON public.folders;
CREATE TRIGGER folders_prevent_non_owner_share_changes
BEFORE UPDATE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_owner_share_changes();
