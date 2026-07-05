-- App configuration table for multi-tenant settings
-- This table stores platform configuration as key-value pairs
-- Allows admins to configure branding, features, integrations without code changes

CREATE TABLE IF NOT EXISTS public.app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  is_sensitive boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write config (idempotent: drop if exists then create)
DROP POLICY IF EXISTS "Admins can manage config" ON public.app_config;
CREATE POLICY "Admins can manage config"
  ON public.app_config
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can read non-sensitive config
DROP POLICY IF EXISTS "Users can read non-sensitive config" ON public.app_config;
CREATE POLICY "Users can read non-sensitive config"
  ON public.app_config
  FOR SELECT
  TO authenticated
  USING (is_sensitive = false);

-- Trigger for updated_at (idempotent)
DROP TRIGGER IF EXISTS update_app_config_updated_at ON public.app_config;
CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default configuration
INSERT INTO public.app_config (key, value, category, description) VALUES
  -- Branding
  ('branding.company_name', '"CollabAi"', 'branding', 'Platform name displayed in UI'),
  ('branding.tagline', '"AI-Powered Collaboration Platform"', 'branding', 'Platform tagline'),
  ('branding.support_email', '"support@collabai.software"', 'branding', 'Support contact email'),

  -- Features
  ('features.enableAIChat', 'true', 'features', 'Enable AI chat functionality'),
  ('features.enableKnowledgeBase', 'true', 'features', 'Enable knowledge base module'),
  ('features.enableMeetings', 'true', 'features', 'Enable meetings module'),
  ('features.enableTasks', 'true', 'features', 'Enable tasks module'),
  ('features.enableNotifications', 'true', 'features', 'Enable notifications system'),
  ('features.enableSemanticSearch', 'true', 'features', 'Enable semantic search'),

  -- Email
  ('email.enableEmailNotifications', 'true', 'email', 'Enable email notifications'),
  ('email.fromName', '"CollabAi"', 'email', 'Email sender name'),
  ('email.fromEmail', '"noreply@collabai.software"', 'email', 'Email sender address'),

  -- System
  ('system.maintenanceMode', 'false', 'system', 'Put platform in maintenance mode'),
  ('system.allowSignups', 'true', 'system', 'Allow new user registrations'),
  ('system.requireEmailVerification', 'false', 'system', 'Require email verification'),
  ('system.sessionTimeout', '7', 'system', 'Session timeout in days')
ON CONFLICT (key) DO NOTHING;
