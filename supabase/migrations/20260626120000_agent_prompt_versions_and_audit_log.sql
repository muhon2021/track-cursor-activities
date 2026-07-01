-- Phase C admin: prompt version history + run audit log
-- Fixes 404 on agent_prompt_versions / agent_run_audit_log REST queries

-- ============================================================================
-- agent_prompt_versions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  system_prompt TEXT NOT NULL,
  change_summary TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_prompt_versions_agent_version_unique UNIQUE (agent_id, version_number),
  CONSTRAINT agent_prompt_versions_version_positive CHECK (version_number > 0)
);

CREATE INDEX IF NOT EXISTS idx_agent_prompt_versions_agent_id
  ON public.agent_prompt_versions(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_prompt_versions_created_at
  ON public.agent_prompt_versions(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_prompt_versions_one_active
  ON public.agent_prompt_versions(agent_id)
  WHERE is_active = true;

ALTER TABLE public.agent_prompt_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage prompt versions" ON public.agent_prompt_versions;
CREATE POLICY "Admins can manage prompt versions"
  ON public.agent_prompt_versions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.agent_prompt_versions IS
  'Version history for ai_agents.system_prompt with one active version per agent';

-- ============================================================================
-- agent_run_audit_log
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_run_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  run_id UUID REFERENCES public.ai_agent_runs(id) ON DELETE SET NULL,
  conversation_id UUID,
  message_id UUID,
  event_type TEXT NOT NULL,
  tool_name TEXT,
  tool_input JSONB,
  tool_output JSONB,
  status TEXT,
  latency_ms INTEGER,
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_micro BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_run_audit_log_agent_id
  ON public.agent_run_audit_log(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_run_audit_log_user_id
  ON public.agent_run_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_agent_run_audit_log_created_at
  ON public.agent_run_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_run_audit_log_event_type
  ON public.agent_run_audit_log(event_type);

ALTER TABLE public.agent_run_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view run audit log" ON public.agent_run_audit_log;
CREATE POLICY "Admins can view run audit log"
  ON public.agent_run_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert run audit log" ON public.agent_run_audit_log;
CREATE POLICY "Admins can insert run audit log"
  ON public.agent_run_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Service role full access run audit log" ON public.agent_run_audit_log;
CREATE POLICY "Service role full access run audit log"
  ON public.agent_run_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.agent_run_audit_log IS
  'Audit trail for agent runs, tool calls, and chat events (Phase C admin)';
