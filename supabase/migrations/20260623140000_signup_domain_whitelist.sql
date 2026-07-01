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
