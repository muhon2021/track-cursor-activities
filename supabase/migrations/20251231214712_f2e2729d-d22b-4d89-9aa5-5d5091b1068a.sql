-- Migration 1: App Config Table (idempotent — may already exist from 20241231000001)
CREATE TABLE IF NOT EXISTS public.app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL DEFAULT 'general',
  description text,
  is_sensitive boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage config" ON public.app_config;
CREATE POLICY "Admins can manage config"
  ON public.app_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can read non-sensitive config" ON public.app_config;
CREATE POLICY "Users can read non-sensitive config"
  ON public.app_config FOR SELECT TO authenticated
  USING (is_sensitive = false);

DROP TRIGGER IF EXISTS update_app_config_updated_at ON public.app_config;
CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migration 2: User Invites Table (idempotent — may already exist from 20241231000002)
CREATE TABLE IF NOT EXISTS public.user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text DEFAULT 'user',
  invited_by uuid REFERENCES public.profiles(id),
  token text UNIQUE NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage invites" ON public.user_invites;
CREATE POLICY "Admins can manage invites"
  ON public.user_invites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_user_invites_email ON public.user_invites(email);
CREATE INDEX IF NOT EXISTS idx_user_invites_token ON public.user_invites(token);
CREATE INDEX IF NOT EXISTS idx_user_invites_expires_at ON public.user_invites(expires_at);

-- Migration 3: User Status Columns on Profiles (idempotent — may already exist from 20241231000003)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;
