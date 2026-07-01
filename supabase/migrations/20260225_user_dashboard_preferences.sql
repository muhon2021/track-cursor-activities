-- ============================================================================
-- MIGRATION: User Dashboard Preferences (Personalization)
-- Date: 2026-02-25
-- Purpose: Let users customize which dashboard cards they see + apply filters
-- ============================================================================

-- 1. Create enum for dashboard types
DO $$ BEGIN
  CREATE TYPE dashboard_type AS ENUM ('owner', 'pm', 'ic');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create user_dashboard_preferences table
CREATE TABLE IF NOT EXISTS public.user_dashboard_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dashboard_type dashboard_type NOT NULL,

  -- Widget visibility (which cards are shown)
  widget_slug text NOT NULL,
  is_visible boolean DEFAULT true,
  sort_order integer DEFAULT 0,

  -- Filters (what data the cards show)
  filter_pod_id uuid,
  filter_client_status text,
  filter_project_status text,
  filter_risk_level text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Unique constraint: user can only have one preference per widget per dashboard
  UNIQUE(user_id, dashboard_type, widget_slug)
);

-- 3. Enable RLS
ALTER TABLE public.user_dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- 4. RLS policy: users can only read/write their own preferences
CREATE POLICY "Users manage own dashboard preferences"
  ON public.user_dashboard_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. Create indexes for performance
CREATE INDEX idx_user_dashboard_prefs_user_id_type
  ON public.user_dashboard_preferences(user_id, dashboard_type);
CREATE INDEX idx_user_dashboard_prefs_pod_filter
  ON public.user_dashboard_preferences(filter_pod_id)
  WHERE filter_pod_id IS NOT NULL;

-- 6. Trigger for updated_at
CREATE TRIGGER update_user_dashboard_preferences_updated_at
  BEFORE UPDATE ON public.user_dashboard_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
