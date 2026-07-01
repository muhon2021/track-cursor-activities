-- Create or replace trigger function for updated_at
CREATE OR REPLACE FUNCTION update_user_microsoft_teams_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table to store Microsoft Teams channels
CREATE TABLE IF NOT EXISTS public.user_microsoft_teams_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  membership_type TEXT,
  web_url TEXT,
  email TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_date_time TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, team_id, channel_id)
);

-- Enable RLS
ALTER TABLE public.user_microsoft_teams_channels ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own channels" ON public.user_microsoft_teams_channels
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own channels" ON public.user_microsoft_teams_channels
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own channels" ON public.user_microsoft_teams_channels
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own channels" ON public.user_microsoft_teams_channels
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_user_ms_channels_user_team 
  ON public.user_microsoft_teams_channels(user_id, team_id);
CREATE INDEX idx_user_ms_channels_channel_id 
  ON public.user_microsoft_teams_channels(channel_id);

-- Updated_at trigger
CREATE TRIGGER trigger_update_user_ms_channels_timestamp
  BEFORE UPDATE ON public.user_microsoft_teams_channels
  FOR EACH ROW
  EXECUTE FUNCTION update_user_microsoft_teams_timestamp();