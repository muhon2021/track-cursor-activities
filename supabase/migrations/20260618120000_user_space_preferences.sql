-- User space preferences for Four Spaces IA (favorites, recents, default space)
CREATE TABLE IF NOT EXISTS public.user_space_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_space TEXT NOT NULL DEFAULT 'sales'
    CHECK (default_space IN ('sales', 'knowledge', 'operations', 'eos')),
  favorites JSONB NOT NULL DEFAULT '[]'::jsonb,
  recent_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_space_preferences_user_id
  ON public.user_space_preferences(user_id);

ALTER TABLE public.user_space_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own space preferences"
  ON public.user_space_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own space preferences"
  ON public.user_space_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own space preferences"
  ON public.user_space_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_space_preferences IS 'Per-user Four Spaces navigation preferences';
