-- Table to store user's Microsoft Teams
CREATE TABLE IF NOT EXISTS public.user_microsoft_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  visibility TEXT,
  web_url TEXT,
  is_archived BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, team_id)
);

-- Enable RLS
ALTER TABLE public.user_microsoft_teams ENABLE ROW LEVEL SECURITY;

-- Users can only see their own teams
CREATE POLICY "Users can view own teams" ON public.user_microsoft_teams
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own teams
CREATE POLICY "Users can insert own teams" ON public.user_microsoft_teams
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own teams
CREATE POLICY "Users can update own teams" ON public.user_microsoft_teams
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own teams
CREATE POLICY "Users can delete own teams" ON public.user_microsoft_teams
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_user_microsoft_teams_user_id ON public.user_microsoft_teams(user_id);
CREATE INDEX idx_user_microsoft_teams_team_id ON public.user_microsoft_teams(team_id);

-- Updated_at trigger
CREATE TRIGGER trigger_update_user_microsoft_teams_timestamp
  BEFORE UPDATE ON public.user_microsoft_teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();