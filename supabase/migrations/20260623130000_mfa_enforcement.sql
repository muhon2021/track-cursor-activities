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
