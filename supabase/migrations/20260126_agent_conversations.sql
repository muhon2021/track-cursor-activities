-- =============================================
-- Phase 1: Agent Conversation Threading
-- Migration: Add conversation threading to AI agents
-- =============================================

-- 1. Add new columns to ai_agents table
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS avatar VARCHAR(255);
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS welcome_message TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS conversation_starters JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- 2. Create agent_conversations table (conversation threads)
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title VARCHAR(255),
  summary TEXT,

  is_archived BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,

  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for agent_conversations
CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent_user
  ON public.agent_conversations(agent_id, user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user
  ON public.agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_created_at
  ON public.agent_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_last_message
  ON public.agent_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_archived
  ON public.agent_conversations(user_id, is_archived) WHERE is_archived = false;

-- 3. Create agent_messages table (individual messages in conversations)
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,

  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,

  -- AI response metadata
  model_used VARCHAR(100),
  provider_used VARCHAR(50),
  tokens_input INTEGER,
  tokens_output INTEGER,
  latency_ms INTEGER,

  -- Tool usage tracking
  tool_calls JSONB,
  tool_results JSONB,

  -- Citations from RAG
  citations JSONB DEFAULT '[]'::jsonb,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for agent_messages
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation
  ON public.agent_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created_at
  ON public.agent_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_messages_role
  ON public.agent_messages(conversation_id, role);

-- 4. Enable RLS on new tables
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for agent_conversations

-- Users can view their own conversations
CREATE POLICY "Users can view their own conversations"
  ON public.agent_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create conversations
CREATE POLICY "Users can create conversations"
  ON public.agent_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "Users can update their own conversations"
  ON public.agent_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own conversations
CREATE POLICY "Users can delete their own conversations"
  ON public.agent_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all conversations
CREATE POLICY "Admins can view all conversations"
  ON public.agent_conversations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. RLS Policies for agent_messages

-- Users can view messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
  ON public.agent_messages FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.agent_conversations
      WHERE user_id = auth.uid()
    )
  );

-- Users can create messages in their conversations
CREATE POLICY "Users can create messages in their conversations"
  ON public.agent_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.agent_conversations
      WHERE user_id = auth.uid()
    )
  );

-- Users can delete messages in their conversations
CREATE POLICY "Users can delete messages in their conversations"
  ON public.agent_messages FOR DELETE
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.agent_conversations
      WHERE user_id = auth.uid()
    )
  );

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
  ON public.agent_messages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Create triggers for updated_at
CREATE TRIGGER update_agent_conversations_updated_at
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Create function to update conversation stats after message insert
CREATE OR REPLACE FUNCTION public.update_conversation_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  -- Also increment agent usage count
  UPDATE public.ai_agents
  SET usage_count = usage_count + 1
  WHERE id = (
    SELECT agent_id FROM public.agent_conversations
    WHERE id = NEW.conversation_id
  )
  AND NEW.role = 'user';  -- Only count user messages

  RETURN NEW;
END;
$$;

CREATE TRIGGER update_conversation_stats_on_message
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_stats();

-- 9. Create function to auto-generate conversation title
CREATE OR REPLACE FUNCTION public.generate_conversation_title()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only set title if it's null and this is the first user message
  IF NEW.role = 'user' THEN
    UPDATE public.agent_conversations
    SET title = CASE
      WHEN title IS NULL OR title = ''
      THEN LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END
      ELSE title
    END
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_generate_conversation_title
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW EXECUTE FUNCTION public.generate_conversation_title();

-- 10. Create helper function to get or create conversation
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_agent_id UUID,
  p_user_id UUID,
  p_conversation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- If conversation_id provided, verify it exists and belongs to user
  IF p_conversation_id IS NOT NULL THEN
    SELECT id INTO v_conversation_id
    FROM public.agent_conversations
    WHERE id = p_conversation_id
      AND user_id = p_user_id
      AND agent_id = p_agent_id;

    IF v_conversation_id IS NOT NULL THEN
      RETURN v_conversation_id;
    END IF;
  END IF;

  -- Create new conversation
  INSERT INTO public.agent_conversations (agent_id, user_id)
  VALUES (p_agent_id, p_user_id)
  RETURNING id INTO v_conversation_id;

  RETURN v_conversation_id;
END;
$$;

-- 11. Create function to archive old conversations
CREATE OR REPLACE FUNCTION public.archive_old_conversations(
  p_user_id UUID,
  p_days_old INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.agent_conversations
  SET is_archived = true
  WHERE user_id = p_user_id
    AND is_archived = false
    AND last_message_at < NOW() - (p_days_old || ' days')::INTERVAL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 12. Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_conversations(UUID, INTEGER) TO authenticated;
