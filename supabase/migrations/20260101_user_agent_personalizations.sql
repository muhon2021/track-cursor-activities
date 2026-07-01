-- Create user_agent_personalizations table
-- This table stores user-specific customizations for AI agents
-- Including personal knowledge attachment and additional prompts

CREATE TABLE public.user_agent_personalizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  additional_prompt TEXT,
  attached_knowledge_files UUID[],
  use_all_knowledge BOOLEAN DEFAULT false,
  max_context_files INTEGER DEFAULT 5,
  relevance_threshold NUMERIC DEFAULT 0.7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, agent_id)
);

-- Create indexes for common queries
CREATE INDEX idx_user_agent_personalizations_user ON public.user_agent_personalizations(user_id);
CREATE INDEX idx_user_agent_personalizations_agent ON public.user_agent_personalizations(agent_id);
CREATE INDEX idx_user_agent_personalizations_enabled ON public.user_agent_personalizations(is_enabled);

-- Enable RLS
ALTER TABLE public.user_agent_personalizations ENABLE ROW LEVEL SECURITY;

-- Users can manage their own personalizations
CREATE POLICY "Users can view their own personalizations"
  ON public.user_agent_personalizations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own personalizations"
  ON public.user_agent_personalizations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own personalizations"
  ON public.user_agent_personalizations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own personalizations"
  ON public.user_agent_personalizations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can manage all personalizations
CREATE POLICY "Admins can manage all personalizations"
  ON public.user_agent_personalizations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_user_agent_personalizations_updated_at
  BEFORE UPDATE ON public.user_agent_personalizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
