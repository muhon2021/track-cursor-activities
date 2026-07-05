-- Jira: API-key hub fields, task extensions, Jira comment columns, time logs.
-- Keeps existing integration_providers.oauth_config for jira (not dropped).

-- ---------------------------------------------------------------------------
-- Integration hub: Jira as api_key + form fields
-- ---------------------------------------------------------------------------
UPDATE public.integration_providers
SET
  auth_type = 'api_key',
  is_available = true,
  is_coming_soon = false
WHERE slug = 'jira';

INSERT INTO public.integration_fields (
  provider_id,
  field_key,
  label,
  field_type,
  placeholder,
  is_required,
  is_sensitive,
  help_text,
  display_order
)
SELECT
  p.id,
  v.field_key,
  v.label,
  v.field_type::text,
  v.placeholder,
  v.is_required,
  v.is_sensitive,
  v.help_text,
  v.display_order
FROM public.integration_providers p
CROSS JOIN (VALUES
  ('jira_host', 'Jira site URL', 'url', 'https://your-domain.atlassian.net', true, false,
   'Your Jira Cloud site base URL (with or without https://). Must match JIRA_HOST secret for sync.', 10),
  ('jira_email', 'Atlassian account email', 'email', 'you@company.com', true, false,
   'Email for the Atlassian account used to create the API token. Same as JIRA_EMAIL secret.', 20),
  ('jira_api_token', 'API token', 'password', 'API token from id.atlassian.com', true, true,
   'Create at https://id.atlassian.com/manage-profile/security/api-tokens — also set as JIRA_API_TOKEN secret for Edge sync.', 30)
) AS v(field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
WHERE p.slug = 'jira'
ON CONFLICT (provider_id, field_key) DO UPDATE SET
  label = EXCLUDED.label,
  field_type = EXCLUDED.field_type,
  placeholder = EXCLUDED.placeholder,
  is_required = EXCLUDED.is_required,
  is_sensitive = EXCLUDED.is_sensitive,
  help_text = EXCLUDED.help_text,
  display_order = EXCLUDED.display_order;

-- ---------------------------------------------------------------------------
-- Tasks: work type (Jira issue type label) + index for Jira external id
-- ---------------------------------------------------------------------------
ALTER TABLE public.tasks  ADD COLUMN IF NOT EXISTS work_type TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_metadata_external_id
  ON public.tasks ((metadata->>'external_id'))
  WHERE metadata->>'external_id' IS NOT NULL;

COMMENT ON COLUMN public.tasks.work_type IS 'Issue type name when synced from Jira (or other PM tools)';

-- ---------------------------------------------------------------------------
-- Comments: optional user for Jira-imported rows; Jira ids and author display
-- ---------------------------------------------------------------------------
ALTER TABLE public.task_comments
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.task_comments
  ADD COLUMN IF NOT EXISTS jira_comment_id TEXT,
  ADD COLUMN IF NOT EXISTS jira_author_name TEXT,
  ADD COLUMN IF NOT EXISTS jira_author_email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_comments_task_jira_comment
  ON public.task_comments (task_id, jira_comment_id)
  WHERE jira_comment_id IS NOT NULL;

COMMENT ON COLUMN public.task_comments.jira_comment_id IS 'Jira comment id for idempotent sync';
COMMENT ON COLUMN public.task_comments.jira_author_name IS 'Jira display name when user_id is null';
COMMENT ON COLUMN public.task_comments.jira_author_email IS 'Jira author email when available';

-- ---------------------------------------------------------------------------
-- Time logs (Jira worklogs + future manual entries)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  hours NUMERIC NOT NULL CHECK (hours >= 0),
  started_at TIMESTAMPTZ,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_time_logs_task_id ON public.task_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_source ON public.task_time_logs(source);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_time_logs_jira_worklog
  ON public.task_time_logs (task_id, ((metadata->>'jira_worklog_id')))
  WHERE source = 'jira' AND (metadata->>'jira_worklog_id') IS NOT NULL;

ALTER TABLE public.task_time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read task_time_logs" ON public.task_time_logs;
CREATE POLICY "Authenticated users can read task_time_logs"
  ON public.task_time_logs FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert task_time_logs" ON public.task_time_logs;
CREATE POLICY "Authenticated users can insert task_time_logs"
  ON public.task_time_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own task_time_logs" ON public.task_time_logs;
CREATE POLICY "Users can update own task_time_logs"
  ON public.task_time_logs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete own task_time_logs" ON public.task_time_logs;
CREATE POLICY "Users can delete own task_time_logs"
  ON public.task_time_logs FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.task_time_logs IS 'Per-entry time tracking; Jira sync uses source=jira and metadata.jira_worklog_id';
