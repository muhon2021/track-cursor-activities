-- Migration: Branding Assets Bucket + Extended Branding Config
-- Creates the branding-assets storage bucket and seeds new app_config branding keys

-- ============================================================
-- 1. Create branding-assets storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding-assets',
  'branding-assets',
  true,
  10485760, -- 10 MB max file size
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. RLS policies for branding-assets bucket
-- ============================================================

-- Allow authenticated users to read all branding assets (public logos etc.)
CREATE POLICY "Authenticated users can read branding assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'branding-assets');

-- Allow anonymous users to read branding assets (needed for login page before auth)
CREATE POLICY "Public read access for branding assets"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'branding-assets');

-- Only admins can upload branding assets
CREATE POLICY "Admins can upload branding assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'branding-assets'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can update branding assets
CREATE POLICY "Admins can update branding assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'branding-assets'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can delete branding assets
CREATE POLICY "Admins can delete branding assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'branding-assets'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ============================================================
-- 3. Seed new app_config branding keys
--    Uses ON CONFLICT DO NOTHING so existing values are preserved
-- ============================================================
INSERT INTO public.app_config (key, value, category, description, is_sensitive)
VALUES
  (
    'branding.primaryColor',
    '"#6366f1"',
    'branding',
    'Primary brand color used for buttons, links, and accents',
    false
  ),
  (
    'branding.secondaryColor',
    '""',
    'branding',
    'Secondary brand color used for supporting UI elements',
    false
  ),
  (
    'branding.faviconUrl',
    'null',
    'branding',
    'URL to the favicon (ICO or PNG)',
    false
  ),
  (
    'branding.emailFromName',
    '"Control Tower"',
    'branding',
    'Display name used in outgoing email From field',
    false
  ),
  (
    'branding.replyToEmail',
    '""',
    'branding',
    'Reply-to email address for outgoing notifications',
    false
  ),
  (
    'branding.loginMessage',
    '"Welcome to Control Tower"',
    'branding',
    'Welcome message displayed on the login page',
    false
  ),
  (
    'branding.loginBackgroundUrl',
    'null',
    'branding',
    'URL to the login page background image',
    false
  )
ON CONFLICT (key) DO NOTHING;
