-- 20260623150000_admin_session_management.sql
-- Admin Session Management (Sprint 4)
-- Lets users with org.view_sessions / org.terminate_sessions list and force-sign-out
-- other users' active sessions. Supabase's admin REST API doesn't expose per-session
-- listing/termination, so these SECURITY DEFINER functions operate directly on the
-- internal auth.sessions / auth.refresh_tokens tables and are exposed as RPCs.

CREATE OR REPLACE FUNCTION public.admin_list_user_sessions()
RETURNS TABLE (
  session_id UUID,
  user_id UUID,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  not_after TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'org.view_sessions') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    u.email::TEXT,
    p.full_name,
    s.created_at,
    s.updated_at,
    s.not_after
  FROM auth.sessions s
  JOIN auth.users u ON u.id = s.user_id
  LEFT JOIN public.profiles p ON p.id = s.user_id
  ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_terminate_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'org.terminate_sessions') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT user_id INTO v_user_id FROM auth.sessions WHERE id = p_session_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  UPDATE auth.refresh_tokens SET revoked = true WHERE session_id = p_session_id;
  DELETE FROM auth.sessions WHERE id = p_session_id;

  INSERT INTO public.activity_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'session.terminated',
    'auth_session',
    p_session_id,
    jsonb_build_object('target_user_id', v_user_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_terminate_user_sessions(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'org.terminate_sessions') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE auth.refresh_tokens
  SET revoked = true
  WHERE session_id IN (SELECT id FROM auth.sessions WHERE user_id = p_user_id);

  DELETE FROM auth.sessions WHERE user_id = p_user_id;

  INSERT INTO public.activity_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'session.terminated_all',
    'auth_session',
    p_user_id,
    jsonb_build_object('target_user_id', p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_user_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_terminate_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_terminate_user_sessions(UUID) TO authenticated;

COMMENT ON FUNCTION public.admin_list_user_sessions() IS
  'Lists all active auth sessions org-wide. Requires org.view_sessions permission.';
COMMENT ON FUNCTION public.admin_terminate_session(UUID) IS
  'Force-terminates a single session by revoking its refresh tokens and deleting the session row. Requires org.terminate_sessions permission.';
COMMENT ON FUNCTION public.admin_terminate_user_sessions(UUID) IS
  'Force-terminates every active session for a user. Requires org.terminate_sessions permission.';


-- 20260623150000_org_integration_hub_status_rpc.sql
-- Read-only org integration hub status for all authenticated users (no credentials exposed)

CREATE OR REPLACE FUNCTION public.get_org_integration_hub_status()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'primary_by_category',
    COALESCE(
      (
        SELECT primary_by_category
        FROM public.integration_settings
        WHERE organization_id IS NULL
        LIMIT 1
      ),
      '{}'::jsonb
    ),
    'connected_providers',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'slug', ip.slug,
            'name', ip.name,
            'category_slug', ic.slug,
            'category_name', ic.name
          )
          ORDER BY ic.display_order NULLS LAST, ip.display_order NULLS LAST, ip.name
        )
        FROM (
          SELECT DISTINCT ON (ip.id)
            ip.id,
            ip.slug,
            ip.name,
            ip.category_id,
            ip.display_order
          FROM public.organization_integrations oi
          JOIN public.integration_providers ip ON ip.id = oi.provider_id
          WHERE oi.connection_status = 'connected'
            AND COALESCE(oi.enabled, true) = true
          ORDER BY ip.id, oi.updated_at DESC NULLS LAST
        ) ip
        JOIN public.integration_categories ic ON ic.id = ip.category_id
      ),
      '[]'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_org_integration_hub_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_integration_hub_status() TO authenticated;

COMMENT ON FUNCTION public.get_org_integration_hub_status IS
  'Non-sensitive org integration hub snapshot: primary_by_category + connected provider names for user settings UI';


-- 20260625120000_integration_config_encryption.sql
-- Integration config credential encryption
-- Sensitive values in organization_integrations.config are encrypted by the
-- integration-config Edge Function (AES-GCM, v1:iv:ciphertext format).
-- Decryption happens in the integration-config Edge Function.
--
-- Set ENCRYPTION_KEY as a Supabase Function secret before saving integrations.

COMMENT ON COLUMN public.organization_integrations.config IS
  'Integration settings JSONB. Sensitive fields (api_key, client_secret, tokens) are encrypted at rest via integration-config Edge Function.';


-- 20260625140000_security_hardening_layer.sql
-- ============================================================================
-- Authentication & Account Security — Security Hardening Layer (Phase A)
-- Additive migration: extends existing RBAC, profiles, and audit infrastructure.
-- Uses public.tenants as the organization boundary (org_id → tenants.id).
-- ============================================================================

-- Compatibility view: spec references "organizations"
CREATE OR REPLACE VIEW public.organizations AS
SELECT id, name, slug, created_at, updated_at
FROM public.tenants;

-- ========================
-- 1. Extend permissions (catalog already exists from enterprise RBAC)
-- ========================
CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_resource_action
  ON public.permissions (resource, action);

-- ========================
-- 2. Extend role_permissions (junction already exists)
-- ========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'role_permissions' AND column_name = 'id'
  ) THEN
    ALTER TABLE public.role_permissions ADD COLUMN id UUID DEFAULT gen_random_uuid();
    UPDATE public.role_permissions SET id = gen_random_uuid() WHERE id IS NULL;
  END IF;
END $$;

-- ========================
-- 3. Extend user_roles with org/profile scoping
-- ========================
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

UPDATE public.user_roles
SET profile_id = user_id
WHERE profile_id IS NULL;

UPDATE public.user_roles
SET org_id = '00000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_profile_role_org
  ON public.user_roles (profile_id, role_id, org_id)
  WHERE profile_id IS NOT NULL AND role_id IS NOT NULL AND org_id IS NOT NULL;

-- ========================
-- 4. Role audit log
-- ========================
CREATE TABLE IF NOT EXISTS public.role_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  old_state JSONB,
  new_state JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_audit_log_timestamp ON public.role_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_role_audit_log_target ON public.role_audit_log(target_role_id);

ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view role audit log" ON public.role_audit_log;
CREATE POLICY "Admins can view role audit log"
  ON public.role_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert role audit log" ON public.role_audit_log;
CREATE POLICY "Admins can insert role audit log"
  ON public.role_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========================
-- 5. Password history
-- ========================
CREATE TABLE IF NOT EXISTS public.password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_created
  ON public.password_history (user_id, created_at DESC);

ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own password history" ON public.password_history;
CREATE POLICY "Users can view own password history"
  ON public.password_history FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view password history" ON public.password_history;
CREATE POLICY "Admins can view password history"
  ON public.password_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Inserts via service role / edge functions only (no client INSERT policy)

-- ========================
-- 6. Login attempts
-- ========================
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  was_successful BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON public.login_attempts(attempted_at DESC);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view login attempts" ON public.login_attempts;
CREATE POLICY "Admins can view login attempts"
  ON public.login_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ========================
-- 7. Security configurations (per organization / tenant)
-- ========================
CREATE TABLE IF NOT EXISTS public.security_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  password_rotation_days INT NOT NULL DEFAULT 90,
  max_login_attempts INT NOT NULL DEFAULT 5,
  lockout_duration_minutes INT NOT NULL DEFAULT 15,
  hibp_check_enabled BOOLEAN NOT NULL DEFAULT true,
  disposable_email_blocked BOOLEAN NOT NULL DEFAULT true,
  smtp_check_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.security_configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage security configurations" ON public.security_configurations;
CREATE POLICY "Admins can manage security configurations"
  ON public.security_configurations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can view security configurations" ON public.security_configurations;
CREATE POLICY "Authenticated users can view security configurations"
  ON public.security_configurations FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.security_configurations (org_id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (org_id) DO NOTHING;

-- ========================
-- 8. Disposable email domains
-- ========================
CREATE TABLE IF NOT EXISTS public.disposable_email_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE
);

ALTER TABLE public.disposable_email_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read disposable domains" ON public.disposable_email_domains;
CREATE POLICY "Anyone can read disposable domains"
  ON public.disposable_email_domains FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage disposable domains" ON public.disposable_email_domains;
CREATE POLICY "Admins can manage disposable domains"
  ON public.disposable_email_domains FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.disposable_email_domains (domain) VALUES
  ('mailinator.com'),
  ('guerrillamail.com'),
  ('tempmail.com'),
  ('throwaway.email'),
  ('yopmail.com'),
  ('10minutemail.com'),
  ('trashmail.com'),
  ('getnada.com'),
  ('sharklasers.com'),
  ('dispostable.com')
ON CONFLICT (domain) DO NOTHING;

-- ========================
-- 9. Tamper-evident audit_logs chain
-- ========================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  row_hash TEXT,
  previous_row_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_row_hash ON public.audit_logs(row_hash);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ========================
-- 10. Extend profiles with lockout / password expiry
-- ========================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_login_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS requires_password_change BOOLEAN NOT NULL DEFAULT false;

-- Default password expiry for existing users (90 days from now)
UPDATE public.profiles
SET password_expires_at = now() + interval '90 days'
WHERE password_expires_at IS NULL;

-- ========================
-- 11. Security anomaly tracking
-- ========================
CREATE TABLE IF NOT EXISTS public.security_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_anomalies_detected ON public.security_anomalies(detected_at DESC);

ALTER TABLE public.security_anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view security anomalies" ON public.security_anomalies;
CREATE POLICY "Admins can view security anomalies"
  ON public.security_anomalies FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ========================
-- 12. Helper RPCs
-- ========================
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_email TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_was_successful BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_profile_id UUID;
  v_config public.security_configurations%ROWTYPE;
BEGIN
  INSERT INTO public.login_attempts (email, ip_address, was_successful)
  VALUES (lower(trim(p_email)), p_ip_address, p_was_successful)
  RETURNING id INTO v_id;

  IF p_was_successful THEN
    UPDATE public.profiles
    SET failed_login_count = 0, locked_until = NULL
    WHERE email ILIKE lower(trim(p_email));
    RETURN v_id;
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE email ILIKE lower(trim(p_email)) LIMIT 1;
  IF v_profile_id IS NULL THEN
    RETURN v_id;
  END IF;

  SELECT * INTO v_config FROM public.security_configurations
  WHERE org_id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  UPDATE public.profiles
  SET failed_login_count = failed_login_count + 1,
      locked_until = CASE
        WHEN failed_login_count + 1 >= COALESCE(v_config.max_login_attempts, 5)
        THEN now() + (COALESCE(v_config.lockout_duration_minutes, 15) || ' minutes')::interval
        ELSE locked_until
      END
  WHERE id = v_profile_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_account_locked(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE email ILIKE lower(trim(p_email))
      AND locked_until IS NOT NULL
      AND locked_until > now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.record_login_attempt(TEXT, TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_locked(TEXT) TO anon, authenticated;


-- 20260626120000_agent_prompt_versions_and_audit_log.sql
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


-- 20260626120000_knowledge_sharing.sql
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


-- 20260626140000_kb_v2_features.sql
-- KB v2: feature flags, search history, Slack sources, OCR confidence, memory decay snapshots

-- Feature flags (defaults off — enable per org in app_config admin)
INSERT INTO public.app_config (key, value, category, description)
VALUES
  ('features.enableKbCohere', 'false'::jsonb, 'features', 'Enable Cohere rerank badges and enhanced search UI'),
  ('features.enableKbSlack', 'false'::jsonb, 'features', 'Enable Slack knowledge source integration UI'),
  ('features.enableKbOcr', 'false'::jsonb, 'features', 'Enable OCR quality dashboard and parser OCR options'),
  ('features.enableKbParserAdvanced', 'false'::jsonb, 'features', 'Enable advanced parser configuration panel'),
  ('features.enableKbMemoryDecay', 'false'::jsonb, 'features', 'Enable memory decay sparkline visualizations')
ON CONFLICT (key) DO NOTHING;

-- User search history (personal knowledge recent searches)
CREATE TABLE IF NOT EXISTS public.kb_user_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web'
    CHECK (platform IN ('web', 'mobile', 'api', 'agent', 'slack')),
  result_count INTEGER DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_user_search_history_user
  ON public.kb_user_search_history(user_id, created_at DESC);

ALTER TABLE public.kb_user_search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own search history"
  ON public.kb_user_search_history FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own search history"
  ON public.kb_user_search_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own search history"
  ON public.kb_user_search_history FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all search history"
  ON public.kb_user_search_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Slack channel configuration
CREATE TABLE IF NOT EXISTS public.kb_slack_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL UNIQUE,
  channel_name TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  member_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'idle'
    CHECK (sync_status IN ('idle', 'syncing', 'completed', 'failed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_slack_channels_enabled
  ON public.kb_slack_channels(is_enabled) WHERE is_enabled = true;

-- Slack sync ledger
CREATE TABLE IF NOT EXISTS public.kb_slack_sync_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL REFERENCES public.kb_slack_channels(channel_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  messages_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_kb_slack_sync_ledger_channel
  ON public.kb_slack_sync_ledger(channel_id, started_at DESC);

-- OCR confidence on extracted images
ALTER TABLE public.document_images
  ADD COLUMN IF NOT EXISTS ocr_confidence NUMERIC(5,4);

-- Memory decay snapshots for sparkline charts (7-point history per memory)
CREATE TABLE IF NOT EXISTS public.kb_memory_decay_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_id UUID NOT NULL,
  importance_score NUMERIC(5,4) NOT NULL,
  snapshot_index SMALLINT NOT NULL CHECK (snapshot_index >= 0 AND snapshot_index < 7),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (memory_id, snapshot_index)
);

CREATE INDEX IF NOT EXISTS idx_kb_memory_decay_user
  ON public.kb_memory_decay_snapshots(user_id, memory_id);

ALTER TABLE public.kb_slack_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_slack_sync_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_memory_decay_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage kb_slack_channels"
  ON public.kb_slack_channels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read kb_slack_channels"
  ON public.kb_slack_channels FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage kb_slack_sync_ledger"
  ON public.kb_slack_sync_ledger FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read kb_slack_sync_ledger"
  ON public.kb_slack_sync_ledger FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users read own memory decay snapshots"
  ON public.kb_memory_decay_snapshots FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own memory decay snapshots"
  ON public.kb_memory_decay_snapshots FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS set_kb_slack_channels_updated_at ON public.kb_slack_channels;
CREATE TRIGGER set_kb_slack_channels_updated_at
  BEFORE UPDATE ON public.kb_slack_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.kb_user_search_history IS 'Per-user knowledge search history for personal knowledge UI';
COMMENT ON TABLE public.kb_slack_channels IS 'Slack public channels available for knowledge sync';
COMMENT ON TABLE public.kb_slack_sync_ledger IS 'Audit ledger of Slack channel sync operations';


-- 20260629120000_graphify_core.sql
-- ============================================================================
-- Graphify: Enterprise Knowledge Graph core schema
-- Postgres adjacency model with tenant isolation, RLS, and traversal RPCs
-- ============================================================================

-- Feature flag (default off)
INSERT INTO public.app_config (key, value, category, description)
VALUES ('features.enableGraphify', 'false'::jsonb, 'features', 'Enable Graphify knowledge graph and hybrid retrieval')
ON CONFLICT (key) DO NOTHING;

-- Graphify permissions
INSERT INTO public.permissions (key, name, category, resource, action, description)
SELECT v.key, v.name, v.category, v.resource, v.action, v.description
FROM (VALUES
  ('graphify.view', 'View Graphify', 'Graphify', 'graphify', 'view', 'Search and view knowledge graph entities'),
  ('graphify.manage', 'Manage Graphify', 'Graphify', 'graphify', 'manage', 'Configure Graphify and run sync jobs')
) AS v(key, name, category, resource, action, description)
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.key = v.key);

-- Per-agent Graphify toggle
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS graphify_enabled BOOLEAN NOT NULL DEFAULT false;

-- ========================
-- graph_entities
-- ========================
CREATE TABLE IF NOT EXISTS public.graph_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  source_table TEXT,
  source_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(5,4) DEFAULT 1.0,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'merged', 'archived')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_graph_entities_tenant_type_name
  ON public.graph_entities(tenant_id, entity_type, canonical_name);
CREATE INDEX IF NOT EXISTS idx_graph_entities_source
  ON public.graph_entities(tenant_id, source_table, source_id)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_graph_entities_status
  ON public.graph_entities(tenant_id, status) WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_entities_source_unique
  ON public.graph_entities(tenant_id, source_table, source_id, entity_type)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL AND status = 'active';

-- ========================
-- graph_entity_aliases
-- ========================
CREATE TABLE IF NOT EXISTS public.graph_entity_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_entity_aliases_unique
  ON public.graph_entity_aliases(tenant_id, normalized_alias, entity_id);
CREATE INDEX IF NOT EXISTS idx_graph_entity_aliases_lookup
  ON public.graph_entity_aliases(tenant_id, normalized_alias);

-- ========================
-- graph_relationships
-- ========================
CREATE TABLE IF NOT EXISTS public.graph_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_entity_id UUID NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  weight NUMERIC(5,4) DEFAULT 0.5,
  confidence NUMERIC(5,4) DEFAULT 1.0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_table TEXT,
  source_id UUID,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT graph_relationships_no_self_loop CHECK (source_entity_id <> target_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_graph_relationships_source
  ON public.graph_relationships(source_entity_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_graph_relationships_target
  ON public.graph_relationships(target_entity_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_graph_relationships_type
  ON public.graph_relationships(tenant_id, relationship_type) WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_relationships_unique_active
  ON public.graph_relationships(source_entity_id, target_entity_id, relationship_type)
  WHERE status = 'active';

-- ========================
-- graph_memory_links
-- ========================
CREATE TABLE IF NOT EXISTS public.graph_memory_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  memory_id UUID NOT NULL,
  entity_id UUID NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'about'
    CHECK (link_type IN ('mentions', 'about', 'derived_from')),
  confidence NUMERIC(5,4) DEFAULT 0.8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_memory_links_unique
  ON public.graph_memory_links(memory_id, entity_id, link_type);
CREATE INDEX IF NOT EXISTS idx_graph_memory_links_entity
  ON public.graph_memory_links(entity_id);

-- ========================
-- graph_query_logs
-- ========================
CREATE TABLE IF NOT EXISTS public.graph_query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT,
  query_type TEXT NOT NULL DEFAULT 'search',
  latency_ms INTEGER,
  nodes_returned INTEGER DEFAULT 0,
  edges_traversed INTEGER DEFAULT 0,
  tokens_saved INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_graph_query_logs_tenant_created
  ON public.graph_query_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_graph_query_logs_user
  ON public.graph_query_logs(user_id, created_at DESC);

-- ========================
-- graphify_config
-- ========================
CREATE TABLE IF NOT EXISTS public.graphify_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  max_traversal_depth INTEGER NOT NULL DEFAULT 2,
  max_nodes_per_query INTEGER NOT NULL DEFAULT 50,
  entity_extraction_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_sync_fk_relationships BOOLEAN NOT NULL DEFAULT true,
  context_merge_strategy TEXT NOT NULL DEFAULT 'graph_first'
    CHECK (context_merge_strategy IN ('graph_first', 'vector_first', 'balanced')),
  token_budget INTEGER NOT NULL DEFAULT 8000,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

INSERT INTO public.graphify_config (tenant_id, enabled)
VALUES ('00000000-0000-0000-0000-000000000001'::UUID, false)
ON CONFLICT (tenant_id) DO NOTHING;

-- ========================
-- graphify_sync_jobs
-- ========================
CREATE TABLE IF NOT EXISTS public.graphify_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL DEFAULT 'backfill'
    CHECK (job_type IN ('backfill', 'relationships', 'extraction')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  entities_synced INTEGER DEFAULT 0,
  relationships_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_graphify_sync_jobs_tenant_status
  ON public.graphify_sync_jobs(tenant_id, status, created_at DESC);

-- ========================
-- Updated_at triggers
-- ========================
DROP TRIGGER IF EXISTS set_graph_entities_updated_at ON public.graph_entities;
CREATE TRIGGER set_graph_entities_updated_at
  BEFORE UPDATE ON public.graph_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_graph_relationships_updated_at ON public.graph_relationships;
CREATE TRIGGER set_graph_relationships_updated_at
  BEFORE UPDATE ON public.graph_relationships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_graphify_config_updated_at ON public.graphify_config;
CREATE TRIGGER set_graphify_config_updated_at
  BEFORE UPDATE ON public.graphify_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_graphify_sync_jobs_updated_at ON public.graphify_sync_jobs;
CREATE TRIGGER set_graphify_sync_jobs_updated_at
  BEFORE UPDATE ON public.graphify_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================
-- graphify_can_access_entity
-- ========================
CREATE OR REPLACE FUNCTION public.graphify_can_access_entity(
  p_user_id UUID,
  p_entity_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity public.graph_entities%ROWTYPE;
  v_owner UUID;
  v_source_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_entity FROM public.graph_entities WHERE id = p_entity_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_entity.tenant_id <> public.get_user_tenant_id() THEN
    RETURN false;
  END IF;

  IF public.has_role(p_user_id, 'admin') OR public.has_permission(p_user_id, 'graphify.manage') THEN
    RETURN true;
  END IF;

  v_owner := NULLIF(v_entity.metadata->>'user_id', '')::UUID;

  IF v_entity.source_table = 'agent_memories' AND v_entity.source_id IS NOT NULL THEN
    SELECT am.user_id INTO v_owner FROM public.agent_memories am
    WHERE am.id = v_entity.source_id AND am.deleted_at IS NULL;
    IF v_owner IS NOT NULL AND v_owner <> p_user_id THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  IF v_entity.source_table = 'user_knowledge_files' AND v_entity.source_id IS NOT NULL THEN
    SELECT ukf.user_id INTO v_owner FROM public.user_knowledge_files ukf
    WHERE ukf.id = v_entity.source_id;
    IF v_owner IS NOT NULL AND v_owner <> p_user_id THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  IF v_entity.source_table IN ('knowledge_files', 'unified_documents') AND v_entity.source_id IS NOT NULL THEN
    IF v_entity.source_table = 'knowledge_files' THEN
      SELECT kf.source_id INTO v_source_id FROM public.knowledge_files kf WHERE kf.id = v_entity.source_id;
      IF v_source_id IS NOT NULL AND NOT public.check_kb_source_permission(v_source_id, 'view') THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  IF v_owner IS NOT NULL AND v_owner <> p_user_id THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.graphify_can_access_entity(UUID, UUID) TO authenticated;

-- ========================
-- graphify_match_entities
-- ========================
CREATE OR REPLACE FUNCTION public.graphify_match_entities(
  p_tenant_id UUID,
  p_query TEXT,
  p_entity_types TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  canonical_name TEXT,
  display_name TEXT,
  source_table TEXT,
  source_id UUID,
  metadata JSONB,
  confidence NUMERIC,
  match_score REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT lower(trim(p_query)) AS term
  ),
  name_matches AS (
    SELECT
      e.id,
      e.entity_type,
      e.canonical_name,
      e.display_name,
      e.source_table,
      e.source_id,
      e.metadata,
      e.confidence,
      CASE
        WHEN lower(e.canonical_name) = (SELECT term FROM q) THEN 1.0
        WHEN lower(e.display_name) = (SELECT term FROM q) THEN 0.95
        WHEN lower(e.canonical_name) LIKE (SELECT term FROM q) || '%' THEN 0.85
        ELSE 0.7
      END::REAL AS match_score
    FROM public.graph_entities e, q
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND (
        lower(e.canonical_name) LIKE '%' || q.term || '%'
        OR lower(e.display_name) LIKE '%' || q.term || '%'
      )
      AND (p_entity_types IS NULL OR e.entity_type = ANY(p_entity_types))
      AND public.graphify_can_access_entity(auth.uid(), e.id)
  ),
  alias_matches AS (
    SELECT
      e.id,
      e.entity_type,
      e.canonical_name,
      e.display_name,
      e.source_table,
      e.source_id,
      e.metadata,
      e.confidence,
      0.75::REAL AS match_score
    FROM public.graph_entity_aliases a
    JOIN public.graph_entities e ON e.id = a.entity_id
    CROSS JOIN q
    WHERE a.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND a.normalized_alias LIKE '%' || q.term || '%'
      AND (p_entity_types IS NULL OR e.entity_type = ANY(p_entity_types))
      AND public.graphify_can_access_entity(auth.uid(), e.id)
  ),
  combined AS (
    SELECT * FROM name_matches
    UNION
    SELECT * FROM alias_matches
  )
  SELECT DISTINCT ON (c.id)
    c.id, c.entity_type, c.canonical_name, c.display_name,
    c.source_table, c.source_id, c.metadata, c.confidence, c.match_score
  FROM combined c
  ORDER BY c.id, c.match_score DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.graphify_match_entities(UUID, TEXT, TEXT[], INT) TO authenticated;

-- ========================
-- graphify_entity_neighbors
-- ========================
CREATE OR REPLACE FUNCTION public.graphify_entity_neighbors(
  p_entity_id UUID,
  p_direction TEXT DEFAULT 'both',
  p_relationship_types TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  relationship_id UUID,
  relationship_type TEXT,
  direction TEXT,
  neighbor_id UUID,
  neighbor_type TEXT,
  neighbor_name TEXT,
  weight NUMERIC,
  confidence NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  (
    SELECT
      r.id AS relationship_id,
      r.relationship_type,
      'out'::TEXT AS direction,
      t.id AS neighbor_id,
      t.entity_type AS neighbor_type,
      t.display_name AS neighbor_name,
      r.weight,
      r.confidence
    FROM public.graph_relationships r
    JOIN public.graph_entities t ON t.id = r.target_entity_id
    WHERE r.source_entity_id = p_entity_id
      AND r.status = 'active'
      AND t.status = 'active'
      AND (p_direction IN ('out', 'both'))
      AND (p_relationship_types IS NULL OR r.relationship_type = ANY(p_relationship_types))
      AND public.graphify_can_access_entity(auth.uid(), t.id)
  )
  UNION ALL
  (
    SELECT
      r.id AS relationship_id,
      r.relationship_type,
      'in'::TEXT AS direction,
      s.id AS neighbor_id,
      s.entity_type AS neighbor_type,
      s.display_name AS neighbor_name,
      r.weight,
      r.confidence
    FROM public.graph_relationships r
    JOIN public.graph_entities s ON s.id = r.source_entity_id
    WHERE r.target_entity_id = p_entity_id
      AND r.status = 'active'
      AND s.status = 'active'
      AND (p_direction IN ('in', 'both'))
      AND (p_relationship_types IS NULL OR r.relationship_type = ANY(p_relationship_types))
      AND public.graphify_can_access_entity(auth.uid(), s.id)
  )
  ORDER BY weight DESC, confidence DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.graphify_entity_neighbors(UUID, TEXT, TEXT[], INT) TO authenticated;

-- ========================
-- graphify_traverse
-- ========================
CREATE OR REPLACE FUNCTION public.graphify_traverse(
  p_tenant_id UUID,
  p_seed_entity_ids UUID[],
  p_max_depth INT DEFAULT 2,
  p_relationship_types TEXT[] DEFAULT NULL,
  p_max_nodes INT DEFAULT 50
)
RETURNS TABLE (
  entity_id UUID,
  entity_type TEXT,
  display_name TEXT,
  source_table TEXT,
  source_id UUID,
  depth INT,
  path UUID[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE walk AS (
    SELECT
      e.id AS entity_id,
      e.entity_type,
      e.display_name,
      e.source_table,
      e.source_id,
      0 AS depth,
      ARRAY[e.id] AS path
    FROM public.graph_entities e
    WHERE e.id = ANY(p_seed_entity_ids)
      AND e.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND public.graphify_can_access_entity(auth.uid(), e.id)

    UNION ALL

    SELECT
      n.id AS entity_id,
      n.entity_type,
      n.display_name,
      n.source_table,
      n.source_id,
      w.depth + 1 AS depth,
      w.path || n.id AS path
    FROM walk w
    JOIN public.graph_relationships r ON (
      (r.source_entity_id = w.entity_id OR r.target_entity_id = w.entity_id)
      AND r.status = 'active'
      AND (p_relationship_types IS NULL OR r.relationship_type = ANY(p_relationship_types))
    )
    JOIN public.graph_entities n ON n.id = CASE
      WHEN r.source_entity_id = w.entity_id THEN r.target_entity_id
      ELSE r.source_entity_id
    END
    WHERE w.depth < GREATEST(p_max_depth, 0)
      AND n.status = 'active'
      AND n.tenant_id = p_tenant_id
      AND NOT n.id = ANY(w.path)
      AND public.graphify_can_access_entity(auth.uid(), n.id)
  )
  SELECT DISTINCT ON (entity_id)
    entity_id, entity_type, display_name, source_table, source_id, depth, path
  FROM walk
  ORDER BY entity_id, depth ASC
  LIMIT GREATEST(p_max_nodes, 1);
$$;

GRANT EXECUTE ON FUNCTION public.graphify_traverse(UUID, UUID[], INT, TEXT[], INT) TO authenticated;

-- ========================
-- RLS
-- ========================
ALTER TABLE public.graph_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_entity_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_memory_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_query_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graphify_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graphify_sync_jobs ENABLE ROW LEVEL SECURITY;

-- graph_entities
CREATE POLICY "graph_entities_select"
  ON public.graph_entities FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.graphify_can_access_entity(auth.uid(), id)
  );

CREATE POLICY "graph_entities_manage"
  ON public.graph_entities FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  );

-- graph_entity_aliases
CREATE POLICY "graph_aliases_select"
  ON public.graph_entity_aliases FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.graphify_can_access_entity(auth.uid(), entity_id)
  );

CREATE POLICY "graph_aliases_manage"
  ON public.graph_entity_aliases FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  );

-- graph_relationships
CREATE POLICY "graph_relationships_select"
  ON public.graph_relationships FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.graphify_can_access_entity(auth.uid(), source_entity_id)
    AND public.graphify_can_access_entity(auth.uid(), target_entity_id)
  );

CREATE POLICY "graph_relationships_manage"
  ON public.graph_relationships FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  );

-- graph_memory_links
CREATE POLICY "graph_memory_links_select"
  ON public.graph_memory_links FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.graphify_can_access_entity(auth.uid(), entity_id)
  );

CREATE POLICY "graph_memory_links_manage"
  ON public.graph_memory_links FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  );

-- graph_query_logs
CREATE POLICY "graph_query_logs_select_own"
  ON public.graph_query_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "graph_query_logs_select_admin"
  ON public.graph_query_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'));

CREATE POLICY "graph_query_logs_insert"
  ON public.graph_query_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- graphify_config
CREATE POLICY "graphify_config_select"
  ON public.graphify_config FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "graphify_config_manage"
  ON public.graphify_config FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  );

-- graphify_sync_jobs
CREATE POLICY "graphify_sync_jobs_select"
  ON public.graphify_sync_jobs FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  );

CREATE POLICY "graphify_sync_jobs_manage"
  ON public.graphify_sync_jobs FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'graphify.manage'))
  );

COMMENT ON TABLE public.graph_entities IS 'Graphify canonical knowledge graph nodes';
COMMENT ON TABLE public.graph_relationships IS 'Graphify directed relationship edges';
COMMENT ON TABLE public.graphify_config IS 'Per-tenant Graphify configuration';

-- Register graphify module
INSERT INTO public.app_modules (name, slug, description, icon, category, is_core, is_active, sort_order, dependencies)
VALUES (
  'Graphify',
  'graphify',
  'Enterprise knowledge graph and context intelligence',
  'Network',
  'intelligence',
  false,
  true,
  10,
  '{platform,knowledge}'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;


-- 20260629160000_graphify_coverage_rpcs.sql
-- Graphify coverage helpers (fast orphan/topic stats)

CREATE OR REPLACE FUNCTION public.graphify_count_orphans(p_tenant_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::BIGINT
  FROM public.graph_entities e
  WHERE e.tenant_id = p_tenant_id
    AND e.status = 'active'
    AND NOT EXISTS (
      SELECT 1
      FROM public.graph_relationships r
      WHERE r.status = 'active'
        AND (r.source_entity_id = e.id OR r.target_entity_id = e.id)
    );
$$;

CREATE OR REPLACE FUNCTION public.graphify_list_orphans(
  p_tenant_id UUID,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  entity_type TEXT,
  source_table TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.display_name, e.entity_type, e.source_table
  FROM public.graph_entities e
  WHERE e.tenant_id = p_tenant_id
    AND e.status = 'active'
    AND NOT EXISTS (
      SELECT 1
      FROM public.graph_relationships r
      WHERE r.status = 'active'
        AND (r.source_entity_id = e.id OR r.target_entity_id = e.id)
    )
  ORDER BY e.updated_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

CREATE OR REPLACE FUNCTION public.graphify_topic_mention_stats(
  p_tenant_id UUID,
  p_limit INT DEFAULT 500
)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  mention_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.display_name,
    COUNT(r.id)::BIGINT AS mention_count
  FROM public.graph_entities t
  LEFT JOIN public.graph_relationships r
    ON r.status = 'active'
    AND (r.target_entity_id = t.id OR r.source_entity_id = t.id)
  WHERE t.tenant_id = p_tenant_id
    AND t.status = 'active'
    AND t.entity_type = 'Topic'
  GROUP BY t.id, t.display_name
  ORDER BY mention_count ASC, t.display_name ASC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.graphify_count_orphans(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.graphify_list_orphans(UUID, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.graphify_topic_mention_stats(UUID, INT) TO authenticated, service_role;


-- 20260629170000_graphify_phase6_perf.sql
-- Graphify Phase 6: traversal cache, index tuning, search deduplication

-- Traversal-oriented relationship indexes (tenant-scoped for large graphs)
CREATE INDEX IF NOT EXISTS idx_graph_relationships_tenant_source_active
  ON public.graph_relationships(tenant_id, source_entity_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_graph_relationships_tenant_target_active
  ON public.graph_relationships(tenant_id, target_entity_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_graph_entities_tenant_type_active
  ON public.graph_entities(tenant_id, entity_type)
  WHERE status = 'active';

-- Short-lived traversal result cache (per user — respects graphify_can_access_entity via stored RPC output)
CREATE TABLE IF NOT EXISTS public.graphify_traversal_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL,
  result JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT graphify_traversal_cache_unique UNIQUE (tenant_id, user_id, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_graphify_traversal_cache_expires
  ON public.graphify_traversal_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_graphify_traversal_cache_lookup
  ON public.graphify_traversal_cache(tenant_id, user_id, cache_key);

ALTER TABLE public.graphify_traversal_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "graphify_traversal_cache_select_own"
  ON public.graphify_traversal_cache FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "graphify_traversal_cache_insert_own"
  ON public.graphify_traversal_cache FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "graphify_traversal_cache_update_own"
  ON public.graphify_traversal_cache FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "graphify_traversal_cache_delete_own"
  ON public.graphify_traversal_cache FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "graphify_traversal_cache_manage_service"
  ON public.graphify_traversal_cache FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Purge expired cache rows (call after sync jobs or via pg_cron)
CREATE OR REPLACE FUNCTION public.graphify_purge_traversal_cache(
  p_tenant_id UUID DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.graphify_traversal_cache c
    WHERE c.expires_at < now()
      AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
    RETURNING 1
  )
  SELECT COUNT(*)::BIGINT FROM deleted;
$$;

CREATE OR REPLACE FUNCTION public.graphify_invalidate_traversal_cache(
  p_tenant_id UUID
)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.graphify_traversal_cache c
    WHERE c.tenant_id = p_tenant_id
    RETURNING 1
  )
  SELECT COUNT(*)::BIGINT FROM deleted;
$$;

GRANT EXECUTE ON FUNCTION public.graphify_purge_traversal_cache(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.graphify_invalidate_traversal_cache(UUID) TO service_role;

-- Prefer one match per (entity_type, canonical_name); source-linked entities win
CREATE OR REPLACE FUNCTION public.graphify_match_entities(
  p_tenant_id UUID,
  p_query TEXT,
  p_entity_types TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  canonical_name TEXT,
  display_name TEXT,
  source_table TEXT,
  source_id UUID,
  metadata JSONB,
  confidence NUMERIC,
  match_score REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT lower(trim(p_query)) AS term
  ),
  name_matches AS (
    SELECT
      e.id,
      e.entity_type,
      e.canonical_name,
      e.display_name,
      e.source_table,
      e.source_id,
      e.metadata,
      e.confidence,
      CASE
        WHEN lower(e.canonical_name) = (SELECT term FROM q) THEN 1.0
        WHEN lower(e.display_name) = (SELECT term FROM q) THEN 0.95
        WHEN lower(e.canonical_name) LIKE (SELECT term FROM q) || '%' THEN 0.85
        ELSE 0.7
      END::REAL AS match_score
    FROM public.graph_entities e, q
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND (
        lower(e.canonical_name) LIKE '%' || q.term || '%'
        OR lower(e.display_name) LIKE '%' || q.term || '%'
      )
      AND (p_entity_types IS NULL OR e.entity_type = ANY(p_entity_types))
      AND public.graphify_can_access_entity(auth.uid(), e.id)
  ),
  alias_matches AS (
    SELECT
      e.id,
      e.entity_type,
      e.canonical_name,
      e.display_name,
      e.source_table,
      e.source_id,
      e.metadata,
      e.confidence,
      0.75::REAL AS match_score
    FROM public.graph_entity_aliases a
    JOIN public.graph_entities e ON e.id = a.entity_id
    CROSS JOIN q
    WHERE a.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND a.normalized_alias LIKE '%' || q.term || '%'
      AND (p_entity_types IS NULL OR e.entity_type = ANY(p_entity_types))
      AND public.graphify_can_access_entity(auth.uid(), e.id)
  ),
  combined AS (
    SELECT * FROM name_matches
    UNION
    SELECT * FROM alias_matches
  ),
  by_id AS (
    SELECT DISTINCT ON (c.id)
      c.id, c.entity_type, c.canonical_name, c.display_name,
      c.source_table, c.source_id, c.metadata, c.confidence, c.match_score
    FROM combined c
    ORDER BY c.id, c.match_score DESC
  ),
  deduped AS (
    SELECT DISTINCT ON (b.entity_type, lower(b.canonical_name))
      b.id, b.entity_type, b.canonical_name, b.display_name,
      b.source_table, b.source_id, b.metadata, b.confidence, b.match_score
    FROM by_id b
    ORDER BY
      b.entity_type,
      lower(b.canonical_name),
      (CASE WHEN b.source_id IS NOT NULL THEN 0 ELSE 1 END),
      b.match_score DESC
  )
  SELECT
    d.id, d.entity_type, d.canonical_name, d.display_name,
    d.source_table, d.source_id, d.metadata, d.confidence, d.match_score
  FROM deduped d
  ORDER BY d.match_score DESC
  LIMIT GREATEST(p_limit, 1);
$$;


-- 20260629180000_graphify_token_search.sql
-- Graphify: token-based fuzzy search (case/punctuation insensitive)

CREATE OR REPLACE FUNCTION public.graphify_normalize_search_text(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.graphify_match_entities(
  p_tenant_id UUID,
  p_query TEXT,
  p_entity_types TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  canonical_name TEXT,
  display_name TEXT,
  source_table TEXT,
  source_id UUID,
  metadata JSONB,
  confidence NUMERIC,
  match_score REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT public.graphify_normalize_search_text(p_query) AS term
  ),
  tokens AS (
    SELECT tok AS token
    FROM q,
    LATERAL regexp_split_to_table(q.term, '\s+') AS tok
    WHERE length(tok) >= 2
  ),
  token_count AS (
    SELECT COUNT(*)::int AS n FROM tokens
  ),
  name_matches AS (
    SELECT
      e.id,
      e.entity_type,
      e.canonical_name,
      e.display_name,
      e.source_table,
      e.source_id,
      e.metadata,
      e.confidence,
      public.graphify_normalize_search_text(e.display_name) AS norm_display,
      public.graphify_normalize_search_text(e.canonical_name) AS norm_canonical,
      CASE
        WHEN public.graphify_normalize_search_text(e.canonical_name) = (SELECT term FROM q) THEN 1.0
        WHEN public.graphify_normalize_search_text(e.display_name) = (SELECT term FROM q) THEN 0.95
        WHEN public.graphify_normalize_search_text(e.canonical_name) LIKE (SELECT term FROM q) || '%' THEN 0.85
        WHEN public.graphify_normalize_search_text(e.display_name) LIKE (SELECT term FROM q) || '%' THEN 0.82
        ELSE 0.7
      END::REAL AS base_score
    FROM public.graph_entities e, q
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND (p_entity_types IS NULL OR e.entity_type = ANY(p_entity_types))
      AND public.graphify_can_access_entity(auth.uid(), e.id)
      AND (
        (SELECT term FROM q) = ''
        OR public.graphify_normalize_search_text(e.display_name) LIKE '%' || (SELECT term FROM q) || '%'
        OR public.graphify_normalize_search_text(e.canonical_name) LIKE '%' || (SELECT term FROM q) || '%'
        OR (
          (SELECT n FROM token_count) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM tokens tok
            WHERE public.graphify_normalize_search_text(e.display_name) NOT LIKE '%' || tok.token || '%'
              AND public.graphify_normalize_search_text(e.canonical_name) NOT LIKE '%' || tok.token || '%'
          )
        )
      )
  ),
  scored_names AS (
    SELECT
      nm.id,
      nm.entity_type,
      nm.canonical_name,
      nm.display_name,
      nm.source_table,
      nm.source_id,
      nm.metadata,
      nm.confidence,
      (
        nm.base_score
        + CASE
            WHEN (SELECT n FROM token_count) = 0 THEN 0
            ELSE 0.05 * (
              SELECT COUNT(*)::real
              FROM tokens tok
              WHERE nm.norm_display LIKE '%' || tok.token || '%'
                 OR nm.norm_canonical LIKE '%' || tok.token || '%'
            ) / (SELECT n FROM token_count)::real
          END
      )::REAL AS match_score
    FROM name_matches nm
  ),
  alias_matches AS (
    SELECT
      e.id,
      e.entity_type,
      e.canonical_name,
      e.display_name,
      e.source_table,
      e.source_id,
      e.metadata,
      e.confidence,
      0.75::REAL AS match_score
    FROM public.graph_entity_aliases a
    JOIN public.graph_entities e ON e.id = a.entity_id
    CROSS JOIN q
    WHERE a.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND (p_entity_types IS NULL OR e.entity_type = ANY(p_entity_types))
      AND public.graphify_can_access_entity(auth.uid(), e.id)
      AND (
        a.normalized_alias LIKE '%' || (SELECT term FROM q) || '%'
        OR (
          (SELECT n FROM token_count) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM tokens tok
            WHERE a.normalized_alias NOT LIKE '%' || tok.token || '%'
          )
        )
      )
  ),
  combined AS (
    SELECT * FROM scored_names
    UNION
    SELECT * FROM alias_matches
  ),
  by_id AS (
    SELECT DISTINCT ON (c.id)
      c.id, c.entity_type, c.canonical_name, c.display_name,
      c.source_table, c.source_id, c.metadata, c.confidence, c.match_score
    FROM combined c
    ORDER BY c.id, c.match_score DESC
  ),
  deduped AS (
    SELECT DISTINCT ON (b.entity_type, lower(b.canonical_name))
      b.id, b.entity_type, b.canonical_name, b.display_name,
      b.source_table, b.source_id, b.metadata, b.confidence, b.match_score
    FROM by_id b
    ORDER BY
      b.entity_type,
      lower(b.canonical_name),
      (CASE WHEN b.source_id IS NOT NULL THEN 0 ELSE 1 END),
      b.match_score DESC
  )
  SELECT
    d.id, d.entity_type, d.canonical_name, d.display_name,
    d.source_table, d.source_id, d.metadata, d.confidence, d.match_score
  FROM deduped d
  ORDER BY d.match_score DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.graphify_normalize_search_text(TEXT) TO authenticated, service_role;


-- 20260629190000_graphify_caller_user_rpcs.sql
-- Graphify: allow service-role RAG/agent pipelines to pass explicit caller user id
-- (auth.uid() is NULL under service role, which blocked agent chat graph retrieval)
--
-- Also includes graphify_normalize_search_text (from 20260629180000) so this file
-- can be run standalone in SQL Editor without running prior migrations first.

CREATE OR REPLACE FUNCTION public.graphify_normalize_search_text(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

GRANT EXECUTE ON FUNCTION public.graphify_normalize_search_text(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.graphify_effective_user_id(p_caller_user_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_caller_user_id IS NOT NULL AND auth.uid() IS NULL THEN p_caller_user_id
    ELSE auth.uid()
  END;
$$;

GRANT EXECUTE ON FUNCTION public.graphify_effective_user_id(UUID) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.graphify_match_entities(UUID, TEXT, TEXT[], INT);

CREATE OR REPLACE FUNCTION public.graphify_match_entities(
  p_tenant_id UUID,
  p_query TEXT,
  p_entity_types TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_caller_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  canonical_name TEXT,
  display_name TEXT,
  source_table TEXT,
  source_id UUID,
  metadata JSONB,
  confidence NUMERIC,
  match_score REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT public.graphify_normalize_search_text(p_query) AS term
  ),
  tokens AS (
    SELECT tok AS token
    FROM q,
    LATERAL regexp_split_to_table(q.term, '\s+') AS tok
    WHERE length(tok) >= 2
  ),
  token_count AS (
    SELECT COUNT(*)::int AS n FROM tokens
  ),
  eff AS (
    SELECT public.graphify_effective_user_id(p_caller_user_id) AS uid
  ),
  name_matches AS (
    SELECT
      e.id,
      e.entity_type,
      e.canonical_name,
      e.display_name,
      e.source_table,
      e.source_id,
      e.metadata,
      e.confidence,
      public.graphify_normalize_search_text(e.display_name) AS norm_display,
      public.graphify_normalize_search_text(e.canonical_name) AS norm_canonical,
      CASE
        WHEN public.graphify_normalize_search_text(e.canonical_name) = (SELECT term FROM q) THEN 1.0
        WHEN public.graphify_normalize_search_text(e.display_name) = (SELECT term FROM q) THEN 0.95
        WHEN public.graphify_normalize_search_text(e.canonical_name) LIKE (SELECT term FROM q) || '%' THEN 0.85
        WHEN public.graphify_normalize_search_text(e.display_name) LIKE (SELECT term FROM q) || '%' THEN 0.82
        ELSE 0.7
      END::REAL AS base_score
    FROM public.graph_entities e, q, eff
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND (p_entity_types IS NULL OR e.entity_type = ANY(p_entity_types))
      AND public.graphify_can_access_entity(eff.uid, e.id)
      AND (
        (SELECT term FROM q) = ''
        OR public.graphify_normalize_search_text(e.display_name) LIKE '%' || (SELECT term FROM q) || '%'
        OR public.graphify_normalize_search_text(e.canonical_name) LIKE '%' || (SELECT term FROM q) || '%'
        OR (
          (SELECT n FROM token_count) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM tokens tok
            WHERE public.graphify_normalize_search_text(e.display_name) NOT LIKE '%' || tok.token || '%'
              AND public.graphify_normalize_search_text(e.canonical_name) NOT LIKE '%' || tok.token || '%'
          )
        )
      )
  ),
  scored_names AS (
    SELECT
      nm.id,
      nm.entity_type,
      nm.canonical_name,
      nm.display_name,
      nm.source_table,
      nm.source_id,
      nm.metadata,
      nm.confidence,
      (
        nm.base_score
        + CASE
            WHEN (SELECT n FROM token_count) = 0 THEN 0
            ELSE 0.05 * (
              SELECT COUNT(*)::real
              FROM tokens tok
              WHERE nm.norm_display LIKE '%' || tok.token || '%'
                 OR nm.norm_canonical LIKE '%' || tok.token || '%'
            ) / (SELECT n FROM token_count)::real
          END
      )::REAL AS match_score
    FROM name_matches nm
  ),
  alias_matches AS (
    SELECT
      e.id,
      e.entity_type,
      e.canonical_name,
      e.display_name,
      e.source_table,
      e.source_id,
      e.metadata,
      e.confidence,
      0.75::REAL AS match_score
    FROM public.graph_entity_aliases a
    JOIN public.graph_entities e ON e.id = a.entity_id
    CROSS JOIN q
    CROSS JOIN eff
    WHERE a.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND (p_entity_types IS NULL OR e.entity_type = ANY(p_entity_types))
      AND public.graphify_can_access_entity(eff.uid, e.id)
      AND (
        a.normalized_alias LIKE '%' || (SELECT term FROM q) || '%'
        OR (
          (SELECT n FROM token_count) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM tokens tok
            WHERE a.normalized_alias NOT LIKE '%' || tok.token || '%'
          )
        )
      )
  ),
  combined AS (
    SELECT * FROM scored_names
    UNION
    SELECT * FROM alias_matches
  ),
  by_id AS (
    SELECT DISTINCT ON (c.id)
      c.id, c.entity_type, c.canonical_name, c.display_name,
      c.source_table, c.source_id, c.metadata, c.confidence, c.match_score
    FROM combined c
    ORDER BY c.id, c.match_score DESC
  ),
  deduped AS (
    SELECT DISTINCT ON (b.entity_type, lower(b.canonical_name))
      b.id, b.entity_type, b.canonical_name, b.display_name,
      b.source_table, b.source_id, b.metadata, b.confidence, b.match_score
    FROM by_id b
    ORDER BY
      b.entity_type,
      lower(b.canonical_name),
      (CASE WHEN b.source_id IS NOT NULL THEN 0 ELSE 1 END),
      b.match_score DESC
  )
  SELECT
    d.id, d.entity_type, d.canonical_name, d.display_name,
    d.source_table, d.source_id, d.metadata, d.confidence, d.match_score
  FROM deduped d
  ORDER BY d.match_score DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.graphify_match_entities(UUID, TEXT, TEXT[], INT, UUID) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.graphify_traverse(UUID, UUID[], INT, TEXT[], INT);

CREATE OR REPLACE FUNCTION public.graphify_traverse(
  p_tenant_id UUID,
  p_seed_entity_ids UUID[],
  p_max_depth INT DEFAULT 2,
  p_relationship_types TEXT[] DEFAULT NULL,
  p_max_nodes INT DEFAULT 50,
  p_caller_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  entity_id UUID,
  entity_type TEXT,
  display_name TEXT,
  source_table TEXT,
  source_id UUID,
  depth INT,
  path UUID[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE eff AS (
    SELECT public.graphify_effective_user_id(p_caller_user_id) AS uid
  ),
  walk AS (
    SELECT
      e.id AS entity_id,
      e.entity_type,
      e.display_name,
      e.source_table,
      e.source_id,
      0 AS depth,
      ARRAY[e.id] AS path
    FROM public.graph_entities e
    CROSS JOIN eff
    WHERE e.id = ANY(p_seed_entity_ids)
      AND e.tenant_id = p_tenant_id
      AND e.status = 'active'
      AND public.graphify_can_access_entity(eff.uid, e.id)

    UNION ALL

    SELECT
      n.id AS entity_id,
      n.entity_type,
      n.display_name,
      n.source_table,
      n.source_id,
      w.depth + 1 AS depth,
      w.path || n.id AS path
    FROM walk w
    CROSS JOIN eff
    JOIN public.graph_relationships r ON (
      (r.source_entity_id = w.entity_id OR r.target_entity_id = w.entity_id)
      AND r.status = 'active'
      AND (p_relationship_types IS NULL OR r.relationship_type = ANY(p_relationship_types))
    )
    JOIN public.graph_entities n ON n.id = CASE
      WHEN r.source_entity_id = w.entity_id THEN r.target_entity_id
      ELSE r.source_entity_id
    END
    WHERE w.depth < GREATEST(p_max_depth, 0)
      AND n.status = 'active'
      AND n.tenant_id = p_tenant_id
      AND NOT n.id = ANY(w.path)
      AND public.graphify_can_access_entity(eff.uid, n.id)
  )
  SELECT DISTINCT ON (entity_id)
    entity_id, entity_type, display_name, source_table, source_id, depth, path
  FROM walk
  ORDER BY entity_id, depth ASC
  LIMIT GREATEST(p_max_nodes, 1);
$$;

GRANT EXECUTE ON FUNCTION public.graphify_traverse(UUID, UUID[], INT, TEXT[], INT, UUID) TO authenticated, service_role;


-- 20260629200000_graphify_service_role_access_fix.sql
-- Fix Graphify access when agent/RAG calls RPCs with service role + acting_user_id.
-- graphify_can_access_entity used get_user_tenant_id() which reads auth.uid() (NULL under service role).

CREATE OR REPLACE FUNCTION public.get_tenant_id_for_user(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT r.tenant_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = p_user_id
      ORDER BY CASE r.slug
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'manager' THEN 3
        WHEN 'member' THEN 4
        WHEN 'viewer' THEN 5
        ELSE 6
      END
      LIMIT 1
    ),
    '00000000-0000-0000-0000-000000000001'::UUID
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_id_for_user(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.graphify_effective_user_id(p_caller_user_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Service-role edge functions pass acting_user_id; auth.uid() is NULL
    WHEN p_caller_user_id IS NOT NULL AND auth.uid() IS NULL THEN p_caller_user_id
    ELSE auth.uid()
  END;
$$;

CREATE OR REPLACE FUNCTION public.graphify_can_access_entity(
  p_user_id UUID,
  p_entity_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity public.graph_entities%ROWTYPE;
  v_owner UUID;
  v_source_id UUID;
  v_tenant_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_entity FROM public.graph_entities WHERE id = p_entity_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_tenant_id := public.get_user_tenant_id();
  ELSE
    v_tenant_id := public.get_tenant_id_for_user(p_user_id);
  END IF;

  IF v_entity.tenant_id <> v_tenant_id THEN
    RETURN false;
  END IF;

  IF public.has_role(p_user_id, 'admin') OR public.has_permission(p_user_id, 'graphify.manage') THEN
    RETURN true;
  END IF;

  v_owner := NULLIF(v_entity.metadata->>'user_id', '')::UUID;

  IF v_entity.source_table = 'agent_memories' AND v_entity.source_id IS NOT NULL THEN
    SELECT am.user_id INTO v_owner FROM public.agent_memories am
    WHERE am.id = v_entity.source_id AND am.deleted_at IS NULL;
    IF v_owner IS NOT NULL AND v_owner <> p_user_id THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  IF v_entity.source_table = 'user_knowledge_files' AND v_entity.source_id IS NOT NULL THEN
    SELECT ukf.user_id INTO v_owner FROM public.user_knowledge_files ukf
    WHERE ukf.id = v_entity.source_id;
    IF v_owner IS NOT NULL AND v_owner <> p_user_id THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  IF v_entity.source_table IN ('knowledge_files', 'unified_documents') AND v_entity.source_id IS NOT NULL THEN
    IF v_entity.source_table = 'knowledge_files' THEN
      SELECT kf.source_id INTO v_source_id FROM public.knowledge_files kf WHERE kf.id = v_entity.source_id;
      IF v_source_id IS NOT NULL AND NOT public.check_kb_source_permission(v_source_id, 'view') THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  IF v_owner IS NOT NULL AND v_owner <> p_user_id THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.graphify_can_access_entity(UUID, UUID) TO authenticated, service_role;


-- 20260630120000_openrouter_integration.sql
-- OpenRouter AI provider integration (Integration Hub catalog + credential fields).
-- Runtime: organization_integrations.config stores encrypted api_key via integration-config Edge Function.
-- AI routing is not wired yet; ai_providers row links the integration for future phases.

-- Environments may have ai_providers without the link column from 20260103_link_ai_providers_to_integrations.
ALTER TABLE public.ai_providers
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.ai_providers
  ADD COLUMN IF NOT EXISTS integration_provider_id UUID
  REFERENCES public.integration_providers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_providers_integration_provider_id
  ON public.ai_providers(integration_provider_id);

DO $$
DECLARE
  ai_category_id UUID;
  openrouter_provider_id UUID;
  dup_category_id UUID;
BEGIN
  -- Use the SAME category tab as OpenAI / Anthropic / Gemini / Perplexity (do not create a second AI tab).
  SELECT ip.category_id INTO ai_category_id
  FROM public.integration_providers ip
  WHERE ip.slug IN ('openai', 'anthropic', 'google-gemini', 'perplexity')
  ORDER BY CASE ip.slug
    WHEN 'openai' THEN 1
    WHEN 'anthropic' THEN 2
    WHEN 'google-gemini' THEN 3
    ELSE 4
  END
  LIMIT 1;

  IF ai_category_id IS NULL THEN
    INSERT INTO public.integration_categories (name, slug, description, icon, display_order, enabled)
    VALUES (
      'AI Providers',
      'ai-providers',
      'AI models for chat, embeddings, and analysis',
      'Brain',
      10,
      true
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      display_order = EXCLUDED.display_order,
      enabled = true,
      updated_at = now();

    SELECT id INTO ai_category_id
    FROM public.integration_categories
    WHERE slug = 'ai-providers'
    LIMIT 1;
  END IF;

  IF ai_category_id IS NULL THEN
    RAISE EXCEPTION 'Could not resolve AI Providers integration category';
  END IF;

  INSERT INTO public.integration_providers (
    category_id,
    name,
    slug,
    description,
    auth_type,
    docs_url,
    is_available,
    is_coming_soon,
    display_order
  )
  VALUES (
    ai_category_id,
    'OpenRouter',
    'openrouter',
    'Access 300+ AI models through a single API.',
    'api_key',
    'https://openrouter.ai/docs',
    true,
    false,
    50
  )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = EXCLUDED.display_order,
    updated_at = now();

  SELECT id INTO openrouter_provider_id
  FROM public.integration_providers
  WHERE slug = 'openrouter'
  LIMIT 1;

  INSERT INTO public.integration_fields (
    provider_id,
    field_key,
    label,
    field_type,
    placeholder,
    default_value,
    is_required,
    is_sensitive,
    help_text,
    display_order
  )
  VALUES
    (
      openrouter_provider_id,
      'api_key',
      'API Key',
      'password',
      'sk-or-...',
      NULL,
      true,
      true,
      'Your OpenRouter API key from openrouter.ai/keys',
      10
    ),
    (
      openrouter_provider_id,
      'default_model',
      'Default Model (optional)',
      'text',
      'deepseek/deepseek-r1',
      'deepseek/deepseek-r1',
      false,
      false,
      'Optional default model slug for future OpenRouter-powered features.',
      20
    )
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    default_value = EXCLUDED.default_value,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;

  INSERT INTO public.ai_providers (
    name,
    slug,
    description,
    api_key_secret_name,
    base_url,
    enabled,
    integration_provider_id
  )
  VALUES (
    'OpenRouter',
    'openrouter',
    'Unified API gateway for 300+ AI models',
    'OPENROUTER_API_KEY',
    'https://openrouter.ai/api/v1',
    true,
    openrouter_provider_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    api_key_secret_name = EXCLUDED.api_key_secret_name,
    base_url = EXCLUDED.base_url,
    enabled = EXCLUDED.enabled,
    integration_provider_id = EXCLUDED.integration_provider_id;

  -- Remove duplicate empty "AI Providers" tabs created when openrouter was assigned to a new category.
  FOR dup_category_id IN
    SELECT ic.id
    FROM public.integration_categories ic
    WHERE ic.id <> ai_category_id
      AND (
        lower(trim(ic.name)) IN ('ai providers', 'ai provider')
        OR ic.slug IN ('ai-providers', 'ai-provider')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.integration_providers ip
        WHERE ip.category_id = ic.id
          AND ip.slug <> 'openrouter'
      )
  LOOP
    DELETE FROM public.integration_categories WHERE id = dup_category_id;
  END LOOP;
END $$;


-- 20260630130000_openrouter_category_repair.sql
-- Repair: OpenRouter was placed on a duplicate "AI Providers" tab in some environments.
-- Move openrouter into the same category as OpenAI/Anthropic/Gemini/Perplexity and remove the extra tab.

DO $$
DECLARE
  canonical_ai_category_id UUID;
  dup_category_id UUID;
BEGIN
  SELECT ip.category_id INTO canonical_ai_category_id
  FROM public.integration_providers ip
  WHERE ip.slug IN ('openai', 'anthropic', 'google-gemini', 'perplexity')
  ORDER BY CASE ip.slug
    WHEN 'openai' THEN 1
    WHEN 'anthropic' THEN 2
    WHEN 'google-gemini' THEN 3
    ELSE 4
  END
  LIMIT 1;

  IF canonical_ai_category_id IS NULL THEN
    RAISE NOTICE 'No canonical AI provider category found; skip openrouter category repair';
    RETURN;
  END IF;

  UPDATE public.integration_providers
  SET category_id = canonical_ai_category_id,
      updated_at = now()
  WHERE slug = 'openrouter'
    AND category_id IS DISTINCT FROM canonical_ai_category_id;

  FOR dup_category_id IN
    SELECT ic.id
    FROM public.integration_categories ic
    WHERE ic.id <> canonical_ai_category_id
      AND (
        lower(trim(ic.name)) IN ('ai providers', 'ai provider')
        OR ic.slug IN ('ai-providers', 'ai-provider')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.integration_providers ip
        WHERE ip.category_id = ic.id
          AND ip.slug <> 'openrouter'
      )
  LOOP
    DELETE FROM public.integration_categories WHERE id = dup_category_id;
  END LOOP;
END $$;


-- 20260630140000_openrouter_default_chat_model.sql
-- Seed a default OpenRouter chat model so agent-default selection can resolve a model id.
DO $$
DECLARE
  openrouter_id UUID;
BEGIN
  SELECT id INTO openrouter_id
  FROM public.ai_providers
  WHERE slug = 'openrouter'
  LIMIT 1;

  IF openrouter_id IS NULL THEN
    RAISE NOTICE 'openrouter ai_provider not found; skipping default chat model seed';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ai_models
    WHERE provider_id = openrouter_id
      AND model_id = 'deepseek/deepseek-r1'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.ai_models (
    provider_id,
    name,
    model_id,
    category,
    context_window,
    input_cost_per_1k,
    output_cost_per_1k,
    embedding_cost_per_1k,
    enabled,
    is_default,
    features
  ) VALUES (
    openrouter_id,
    'DeepSeek R1',
    'deepseek/deepseek-r1',
    'chat',
    64000,
    0,
    0,
    0,
    true,
    true,
    '{"reasoning": true}'::jsonb
  );
END $$;


-- 20260701120000_csa_self_analyser.sql
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


