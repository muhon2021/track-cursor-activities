-- ============================================
-- Integration Preferences — per-category primary integration with multi-source
-- ============================================

ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS primary_by_category JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.integration_settings.primary_by_category IS
  'Per-category integration preferences: { [category_slug]: { primary_slug: string | null, active_slugs: string[] } }. Supersedes primary_integrations, which is kept for backward-compatible reads.';
