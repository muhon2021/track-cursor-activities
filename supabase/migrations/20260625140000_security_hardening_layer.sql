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
