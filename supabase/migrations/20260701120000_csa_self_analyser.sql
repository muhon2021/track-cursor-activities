-- Cursor Self Analyser (CSA) / AI Productivity Audit — tables and RLS

-- =============================================================================
-- Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.csa_ingest_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'default',
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csa_ingest_tokens_user_id ON public.csa_ingest_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_csa_ingest_tokens_hash ON public.csa_ingest_tokens(token_hash) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.csa_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  cursor_session_id TEXT NOT NULL,
  workspace_path TEXT,
  project_name TEXT,
  model TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  message_count INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, cursor_session_id)
);

CREATE INDEX IF NOT EXISTS idx_csa_sessions_user_id ON public.csa_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_csa_sessions_started_at ON public.csa_sessions(started_at DESC);

CREATE TABLE IF NOT EXISTS public.csa_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.csa_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT,
  content_hash TEXT,
  content_length INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csa_messages_session_id ON public.csa_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_csa_messages_user_id ON public.csa_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_csa_messages_created_at ON public.csa_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS public.csa_insights_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  user_display_name TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'weekly',
  stats_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  insights_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start, period_end, period_type)
);

CREATE INDEX IF NOT EXISTS idx_csa_insights_reports_user_id ON public.csa_insights_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_csa_insights_reports_generated_at ON public.csa_insights_reports(generated_at DESC);

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.csa_ingest_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csa_insights_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "csa_ingest_tokens_service_all"
  ON public.csa_ingest_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "csa_sessions_service_all"
  ON public.csa_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "csa_messages_service_all"
  ON public.csa_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "csa_insights_reports_service_all"
  ON public.csa_insights_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "csa_ingest_tokens_select_own"
  ON public.csa_ingest_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "csa_ingest_tokens_insert_own"
  ON public.csa_ingest_tokens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "csa_ingest_tokens_update_own"
  ON public.csa_ingest_tokens FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "csa_sessions_select_own_or_admin"
  ON public.csa_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "csa_insights_reports_select_own_or_admin"
  ON public.csa_insights_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

COMMENT ON TABLE public.csa_sessions IS 'Cursor Self Analyser — chat session metadata';
COMMENT ON TABLE public.csa_messages IS 'Cursor Self Analyser — prompt/response events';
COMMENT ON TABLE public.csa_insights_reports IS 'Cursor Self Analyser — AI-generated usage summaries';
