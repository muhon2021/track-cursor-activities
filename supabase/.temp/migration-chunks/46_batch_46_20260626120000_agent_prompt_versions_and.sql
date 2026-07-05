-- 20260623130000_mfa_enforcement.sql
-- MFA Enforcement (Sprint 2): policy table + per-user enrollment tracking

CREATE TABLE IF NOT EXISTS public.mfa_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  required BOOLEAN NOT NULL DEFAULT false,
  grace_period_days INTEGER NOT NULL DEFAULT 7,
  allowed_factors TEXT[] NOT NULL DEFAULT ARRAY['totp'],
  trust_idp_mfa BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS public.mfa_enrollment_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enrolled BOOLEAN NOT NULL DEFAULT false,
  enrolled_at TIMESTAMPTZ,
  grace_period_ends_at TIMESTAMPTZ,
  last_reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.mfa_policies (tenant_id, required, grace_period_days, allowed_factors, trust_idp_mfa)
VALUES ('00000000-0000-0000-0000-000000000001', false, 7, ARRAY['totp'], false)
ON CONFLICT (tenant_id) DO NOTHING;

ALTER TABLE public.mfa_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_enrollment_status ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read the policy (needed to enforce the grace gate client-side)
CREATE POLICY "mfa_policies_select_authenticated" ON public.mfa_policies
  FOR SELECT TO authenticated USING (true);

-- Only privileged users (checked via has_permission in edge functions using the service role) write policy;
-- block direct writes from the client entirely.
CREATE POLICY "mfa_policies_no_direct_write" ON public.mfa_policies
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Users can see and update their own enrollment status row
CREATE POLICY "mfa_enrollment_status_select_own" ON public.mfa_enrollment_status
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "mfa_enrollment_status_update_own" ON public.mfa_enrollment_status
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "mfa_enrollment_status_insert_own" ON public.mfa_enrollment_status
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Admins (via has_permission) can read all rows through edge functions using the service role,
-- so no broader SELECT policy is required here.


-- 20260623140000_ai_model_policy.sql
-- Org-wide AI model policy for agent chat (default model, user choice vs locked, visibility)

ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS ai_model_policy JSONB NOT NULL DEFAULT '{
    "selection_mode": "user_choice",
    "default_chat_model_id": null,
    "default_provider_slug": null,
    "user_visible_models": "all_enabled"
  }'::jsonb;

COMMENT ON COLUMN public.integration_settings.ai_model_policy IS
  'Org-wide agent chat model policy: selection_mode (admin_locked|user_choice), default_chat_model_id, user_visible_models (all_enabled|default_only)';

-- Ensure at most one default chat model globally
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY updated_at DESC NULLS LAST, name ASC) AS rn
  FROM public.ai_models
  WHERE category = 'chat' AND is_default = true
)
UPDATE public.ai_models
SET is_default = false
WHERE category = 'chat'
  AND is_default = true
  AND id NOT IN (SELECT id FROM ranked WHERE rn = 1);

-- Agent chat UI needs read access to org policy for all authenticated users
CREATE POLICY "Authenticated users can read integration_settings for agent chat"
  ON public.integration_settings FOR SELECT
  TO authenticated
  USING (true);


-- 20260623140000_disable_four_spaces.sql
-- Disable Four Spaces IA — revert to legacy Control Tower layout
UPDATE public.app_config
SET value = 'false'
WHERE key = 'features.enableFourSpaces';

INSERT INTO public.app_config (key, value, category, description)
VALUES (
  'features.enableFourSpaces',
  'false',
  'features',
  'Four Spaces IA (disabled — legacy layout)'
)
ON CONFLICT (key) DO UPDATE SET value = 'false';


-- 20260623140000_signup_domain_whitelist.sql
-- Self-Signup Domain Whitelist (Sprint 3)
-- Restricts open self-signup to approved email domains. Invited users and the
-- bootstrap first user are always exempt. If no domains are configured, the
-- whitelist is treated as disabled (all domains allowed).

INSERT INTO public.permissions (key, name, category, resource, action, description, is_assignable) VALUES
  ('org.manage_signup_policy', 'Manage Signup Domain Whitelist', 'Organization', 'org', 'manage_signup_policy', 'Configure allowed email domains for self-signup', true)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.signup_domain_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.signup_domain_allowlist ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read the configured domains (admin UI relies on this).
CREATE POLICY "signup_domain_allowlist_select_authenticated" ON public.signup_domain_allowlist
  FOR SELECT TO authenticated USING (true);

-- Writes only via edge function using the service role (checks org.manage_signup_policy).
CREATE POLICY "signup_domain_allowlist_no_direct_write" ON public.signup_domain_allowlist
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- =====================================================
-- ENFORCEMENT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION public.enforce_signup_domain_whitelist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_domain_count INTEGER;
  existing_user_count INTEGER;
  has_pending_invite BOOLEAN;
  signup_domain TEXT;
  domain_allowed BOOLEAN;
BEGIN
  -- Whitelist disabled (not configured yet) — allow all signups.
  SELECT COUNT(*) INTO active_domain_count
  FROM public.signup_domain_allowlist
  WHERE is_active = true;

  IF active_domain_count = 0 THEN
    RETURN NEW;
  END IF;

  -- Bootstrap: never block the very first user.
  SELECT COUNT(*) INTO existing_user_count FROM auth.users;
  IF existing_user_count <= 1 THEN
    RETURN NEW;
  END IF;

  -- Invited users (admin-issued invite) bypass the whitelist regardless of domain.
  SELECT EXISTS (
    SELECT 1 FROM public.user_invites
    WHERE lower(email) = lower(NEW.email)
  ) INTO has_pending_invite;

  IF has_pending_invite THEN
    RETURN NEW;
  END IF;

  signup_domain := lower(split_part(NEW.email, '@', 2));

  SELECT EXISTS (
    SELECT 1 FROM public.signup_domain_allowlist
    WHERE domain = signup_domain AND is_active = true
  ) INTO domain_allowed;

  IF NOT domain_allowed THEN
    RAISE EXCEPTION 'Sign-ups from this email domain are not permitted. Contact your administrator for an invite.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_enforce_domain_whitelist ON auth.users;

CREATE TRIGGER on_auth_user_created_enforce_domain_whitelist
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_signup_domain_whitelist();

COMMENT ON FUNCTION public.enforce_signup_domain_whitelist() IS
  'Blocks self-signup for email domains not on signup_domain_allowlist, unless the user has a pending invite or is the bootstrap first user.';


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


