-- ============================================
-- Integration Preferences — organization-level settings
-- Primary integrations and primary knowledge sources
-- ============================================

CREATE TABLE IF NOT EXISTS public.integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NULL,
  primary_integrations JSONB NOT NULL DEFAULT '[]'::jsonb,
  primary_knowledge_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single global config row for single-tenant deployments
CREATE UNIQUE INDEX IF NOT EXISTS integration_settings_global_singleton
  ON public.integration_settings ((1))
  WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_integration_settings_organization_id
  ON public.integration_settings(organization_id)
  WHERE organization_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_integration_settings_updated_at ON public.integration_settings;
CREATE TRIGGER set_integration_settings_updated_at
  BEFORE UPDATE ON public.integration_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

-- Admins and moderators can view preferences
CREATE POLICY "Admins and moderators can view integration_settings"
  ON public.integration_settings FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

-- Only admins can create or update preferences
CREATE POLICY "Admins can insert integration_settings"
  ON public.integration_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update integration_settings"
  ON public.integration_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete integration_settings"
  ON public.integration_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.integration_settings IS
  'Organization-level primary integration and knowledge source preferences for AI and knowledge features';
