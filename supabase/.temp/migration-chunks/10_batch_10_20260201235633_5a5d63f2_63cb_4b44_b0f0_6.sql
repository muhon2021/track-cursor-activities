-- 20260126_tool_config_streaming_memory.sql
-- =============================================
-- Phase 2, 3, 5: Tool Config, Streaming, Memory
-- Migration: Add tool configuration and memory system
-- =============================================

-- ============================================
-- PHASE 2: Tool Configuration
-- ============================================

-- Add tool configuration columns to ai_agents
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_code_interpreter BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_file_search BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_web_search BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_image_generation BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_mcp BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  mcp_server_ids UUID[] DEFAULT '{}';

-- Custom tools configuration (for function calling)
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tools_config JSONB DEFAULT '[]'::jsonb;

-- Comment on columns for documentation
COMMENT ON COLUMN public.ai_agents.tool_code_interpreter IS 'Enable code execution capability';
COMMENT ON COLUMN public.ai_agents.tool_file_search IS 'Enable searching through knowledge base files';
COMMENT ON COLUMN public.ai_agents.tool_web_search IS 'Enable real-time web search (requires Perplexity or similar)';
COMMENT ON COLUMN public.ai_agents.tool_image_generation IS 'Enable image generation (DALL-E, etc.)';
COMMENT ON COLUMN public.ai_agents.tool_mcp IS 'Enable Model Context Protocol servers';
COMMENT ON COLUMN public.ai_agents.mcp_server_ids IS 'Array of connected MCP server IDs';
COMMENT ON COLUMN public.ai_agents.tools_config IS 'Custom function/tool definitions for the agent';

-- ============================================
-- PHASE 5: Agent Memory System
-- ============================================

-- Create agent_memory table for long-term memory
CREATE TABLE IF NOT EXISTS public.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Memory classification
  memory_type VARCHAR(50) NOT NULL CHECK (memory_type IN (
    'summary',      -- Conversation summaries
    'context',      -- User background/context
    'pattern',      -- Learned user patterns
    'fact',         -- Important facts to remember
    'decision',     -- Previous decisions made
    'preference'    -- User preferences
  )),

  -- Content
  content TEXT NOT NULL,
  embedding vector(1536),  -- For semantic search

  -- Source tracking
  source_conversation_id UUID REFERENCES public.agent_conversations(id) ON DELETE SET NULL,
  source_message_id UUID REFERENCES public.agent_messages(id) ON DELETE SET NULL,

  -- Relevance and access tracking
  relevance_score DECIMAL(3,2) DEFAULT 0.5 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,

  -- Lifecycle
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,  -- Optional memory expiration

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for agent_memory
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_user
  ON public.agent_memory(agent_id, user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type
  ON public.agent_memory(agent_id, user_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_active
  ON public.agent_memory(agent_id, user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_agent_memory_relevance
  ON public.agent_memory(agent_id, user_id, relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memory_embedding
  ON public.agent_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS on agent_memory
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_memory

-- Users can view their own memories
CREATE POLICY "Users can view their own agent memories"
  ON public.agent_memory FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create memories
CREATE POLICY "Users can create agent memories"
  ON public.agent_memory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own memories
CREATE POLICY "Users can update their own agent memories"
  ON public.agent_memory FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own memories
CREATE POLICY "Users can delete their own agent memories"
  ON public.agent_memory FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all memories
CREATE POLICY "Admins can view all agent memories"
  ON public.agent_memory FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_agent_memory_updated_at
  BEFORE UPDATE ON public.agent_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Memory Retrieval Functions
-- ============================================

-- Function to match memories by semantic similarity
CREATE OR REPLACE FUNCTION public.match_agent_memories(
  query_embedding vector,
  p_agent_id UUID,
  p_user_id UUID,
  match_count INTEGER DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  memory_type VARCHAR,
  similarity FLOAT,
  relevance_score DECIMAL,
  source_conversation_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    am.id,
    am.content,
    am.memory_type,
    1 - (am.embedding <=> query_embedding) as similarity,
    am.relevance_score,
    am.source_conversation_id,
    am.created_at
  FROM public.agent_memory am
  WHERE am.agent_id = p_agent_id
    AND am.user_id = p_user_id
    AND am.is_active = true
    AND (am.expires_at IS NULL OR am.expires_at > NOW())
    AND am.embedding IS NOT NULL
    AND (1 - (am.embedding <=> query_embedding)) > match_threshold
  ORDER BY
    am.relevance_score DESC,
    am.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Function to get recent memories by type
CREATE OR REPLACE FUNCTION public.get_recent_memories(
  p_agent_id UUID,
  p_user_id UUID,
  p_memory_type VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  memory_type VARCHAR,
  relevance_score DECIMAL,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    am.id,
    am.content,
    am.memory_type,
    am.relevance_score,
    am.created_at
  FROM public.agent_memory am
  WHERE am.agent_id = p_agent_id
    AND am.user_id = p_user_id
    AND am.is_active = true
    AND (am.expires_at IS NULL OR am.expires_at > NOW())
    AND (p_memory_type IS NULL OR am.memory_type = p_memory_type)
  ORDER BY am.created_at DESC
  LIMIT p_limit;
$$;

-- Function to update memory access stats
CREATE OR REPLACE FUNCTION public.update_memory_access(
  p_memory_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_memory
  SET
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = ANY(p_memory_ids);
END;
$$;

-- Function to extract and store memories from conversation
CREATE OR REPLACE FUNCTION public.store_agent_memory(
  p_agent_id UUID,
  p_user_id UUID,
  p_memory_type VARCHAR,
  p_content TEXT,
  p_embedding vector DEFAULT NULL,
  p_source_conversation_id UUID DEFAULT NULL,
  p_source_message_id UUID DEFAULT NULL,
  p_relevance_score DECIMAL DEFAULT 0.8,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_memory_id UUID;
BEGIN
  INSERT INTO public.agent_memory (
    agent_id,
    user_id,
    memory_type,
    content,
    embedding,
    source_conversation_id,
    source_message_id,
    relevance_score,
    metadata
  ) VALUES (
    p_agent_id,
    p_user_id,
    p_memory_type,
    p_content,
    p_embedding,
    p_source_conversation_id,
    p_source_message_id,
    p_relevance_score,
    p_metadata
  )
  RETURNING id INTO v_memory_id;

  RETURN v_memory_id;
END;
$$;

-- Function to decay old memories (reduce relevance over time)
CREATE OR REPLACE FUNCTION public.decay_agent_memories(
  p_agent_id UUID DEFAULT NULL,
  p_decay_factor DECIMAL DEFAULT 0.95,
  p_min_relevance DECIMAL DEFAULT 0.1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.agent_memory
  SET
    relevance_score = GREATEST(relevance_score * p_decay_factor, p_min_relevance),
    updated_at = NOW()
  WHERE is_active = true
    AND relevance_score > p_min_relevance
    AND (p_agent_id IS NULL OR agent_id = p_agent_id)
    AND last_accessed_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.match_agent_memories(vector, UUID, UUID, INTEGER, FLOAT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_memories(UUID, UUID, VARCHAR, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_memory_access(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_agent_memory(UUID, UUID, VARCHAR, TEXT, vector, UUID, UUID, DECIMAL, JSONB) TO authenticated;

-- ============================================
-- PHASE 3: Streaming Support
-- ============================================

-- Add streaming tracking to agent_messages
ALTER TABLE public.agent_messages ADD COLUMN IF NOT EXISTS
  is_streaming BOOLEAN DEFAULT false;

ALTER TABLE public.agent_messages ADD COLUMN IF NOT EXISTS
  stream_completed_at TIMESTAMPTZ;

-- Track tool calls more explicitly
ALTER TABLE public.agent_messages ADD COLUMN IF NOT EXISTS
  tool_call_status VARCHAR(20) CHECK (tool_call_status IN (
    'pending', 'executing', 'completed', 'failed'
  ));

-- Add streaming session tracking
CREATE TABLE IF NOT EXISTS public.streaming_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.agent_messages(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'completed', 'cancelled', 'error'
  )),

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  tokens_streamed INTEGER DEFAULT 0,
  error_message TEXT,

  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_streaming_sessions_conversation
  ON public.streaming_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_streaming_sessions_status
  ON public.streaming_sessions(status) WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.streaming_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for streaming_sessions
CREATE POLICY "Users can view their streaming sessions"
  ON public.streaming_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create streaming sessions"
  ON public.streaming_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their streaming sessions"
  ON public.streaming_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);


-- 20260128_auto_first_admin.sql
-- Migration: Auto-assign first user as admin
-- Purpose: Automatically grant admin role to the first user who signs up
-- Date: 2026-01-28
-- Solves: Admin panel visibility issue - chicken-and-egg problem

-- =====================================================
-- FUNCTION: Auto-assign admin to first user
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_assign_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Count existing users (including the one being inserted)
  SELECT COUNT(*) INTO user_count
  FROM auth.users;

  -- Log for debugging
  RAISE NOTICE 'User signup detected: % (Total users: %)', NEW.email, user_count;

  -- If this is the first user (count = 1 after insert), make them admin
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'First user % automatically granted admin role', NEW.email;
  ELSE
    -- For subsequent users, assign default 'user' role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'User % assigned default user role', NEW.email;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGER: Execute on user creation
-- =====================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_first_admin();

-- =====================================================
-- BACKFILL: Assign roles to existing users
-- =====================================================

-- First, count existing users
DO $$
DECLARE
  existing_user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO existing_user_count
  FROM auth.users;

  RAISE NOTICE 'Found % existing users', existing_user_count;
END $$;

-- Backfill existing users without roles
-- If only one user exists and has no role, make them admin
DO $$
DECLARE
  total_users INTEGER;
  users_without_roles INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM auth.users;
  SELECT COUNT(*) INTO users_without_roles
  FROM auth.users u
  WHERE u.id NOT IN (SELECT user_id FROM public.user_roles);

  RAISE NOTICE 'Total users: %, Users without roles: %', total_users, users_without_roles;

  -- If there's only one user and they have no role, make them admin
  IF total_users = 1 AND users_without_roles = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT id, 'admin'::app_role
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM public.user_roles)
    LIMIT 1;

    RAISE NOTICE 'Granted admin role to the only existing user';
  ELSE
    -- Otherwise, give all users without roles the default 'user' role
    INSERT INTO public.user_roles (user_id, role)
    SELECT id, 'user'::app_role
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM public.user_roles);

    RAISE NOTICE 'Granted user role to % existing users', users_without_roles;
  END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERY (comment out in production)
-- =====================================================

-- Show all users and their roles
SELECT
  u.id,
  u.email,
  ur.role,
  u.created_at,
  CASE
    WHEN ur.role IS NULL THEN '⚠️  NO ROLE'
    WHEN ur.role = 'admin' THEN '✅ ADMIN'
    WHEN ur.role = 'moderator' THEN '✅ MODERATOR'
    ELSE '👤 USER'
  END as status
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
ORDER BY u.created_at ASC;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION public.auto_assign_first_admin() IS
  'Automatically assigns admin role to first user, user role to subsequent users';

COMMENT ON TRIGGER on_auth_user_created_assign_role ON auth.users IS
  'Triggers role assignment when new user signs up';


-- 20260128_verify_user_roles_rls.sql
-- Migration: Verify and enhance RLS policies for user_roles table
-- Purpose: Ensure secure access control for user role management
-- Date: 2026-01-28
-- Related to: Admin panel visibility fix

-- =====================================================
-- VERIFICATION: Check existing policies
-- =====================================================

-- List all policies on user_roles table
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'user_roles';

  RAISE NOTICE 'Found % existing policies on user_roles table', policy_count;
END $$;

-- =====================================================
-- ENSURE: Service role has full access
-- =====================================================

-- Drop existing service role policy if exists (for clean re-creation)
DROP POLICY IF EXISTS "Service role can manage all user roles" ON public.user_roles;

-- Create policy for service role (used by edge functions)
CREATE POLICY "Service role can manage all user roles"
  ON public.user_roles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- VERIFY: Core RLS policies exist
-- =====================================================

-- These policies should already exist from the initial migration:
-- 1. "Users can view their own roles" - FOR SELECT (users see own role)
-- 2. "Admins can view all user roles" - FOR SELECT (admins see all roles)
-- 3. "Admins can manage user roles" - FOR ALL (admins can CRUD roles)

-- Verification query (comment out in production)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_roles'
ORDER BY policyname;

-- =====================================================
-- FUNCTION: Check if user is admin (helper)
-- =====================================================

-- Create or replace helper function for checking admin status
-- This is used throughout the application
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = COALESCE(_user_id, auth.uid())
      AND role IN ('admin', 'moderator')
  )
$$;

-- Add comment
COMMENT ON FUNCTION public.is_admin IS
  'Returns true if the given user (or current user) has admin or moderator role';

-- =====================================================
-- FUNCTION: Get user role (helper)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID DEFAULT auth.uid())
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = COALESCE(_user_id, auth.uid())
  LIMIT 1
$$;

-- Add comment
COMMENT ON FUNCTION public.get_user_role IS
  'Returns the role of the given user (or current user). Returns NULL if no role assigned.';

-- =====================================================
-- INDEX: Optimize role lookups
-- =====================================================

-- Create index on user_id for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- Create index on role for faster admin queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);

-- =====================================================
-- GRANT: Ensure proper permissions
-- =====================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

-- Grant select on user_roles to authenticated (RLS will filter)
GRANT SELECT ON public.user_roles TO authenticated;

-- Grant all operations to service role
GRANT ALL ON public.user_roles TO service_role;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role TO authenticated, anon, service_role;

-- =====================================================
-- SECURITY AUDIT: Show all policies
-- =====================================================

-- Generate security audit report
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'USER_ROLES SECURITY AUDIT';
  RAISE NOTICE '========================================';

  RAISE NOTICE 'RLS Enabled: %', (
    SELECT relrowsecurity
    FROM pg_class
    WHERE relname = 'user_roles'
  );

  RAISE NOTICE '';
  RAISE NOTICE 'Active Policies:';
  FOR rec IN
    SELECT policyname, cmd, roles::text
    FROM pg_policies
    WHERE tablename = 'user_roles'
    ORDER BY policyname
  LOOP
    RAISE NOTICE '  - % (%, %)', rec.policyname, rec.cmd, rec.roles;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Helper Functions:';
  RAISE NOTICE '  - has_role(UUID, app_role) -> BOOLEAN';
  RAISE NOTICE '  - is_admin(UUID) -> BOOLEAN';
  RAISE NOTICE '  - get_user_role(UUID) -> app_role';

  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.user_roles IS
  'Stores user role assignments. Protected by RLS policies. Only admins can modify.';

COMMENT ON COLUMN public.user_roles.user_id IS
  'Reference to auth.users. Cascades on delete.';

COMMENT ON COLUMN public.user_roles.role IS
  'User role: admin, moderator, or user. See app_role enum type.';

COMMENT ON POLICY "Users can view their own roles" ON public.user_roles IS
  'Allows authenticated users to see their own role assignment';

COMMENT ON POLICY "Admins can view all user roles" ON public.user_roles IS
  'Allows admins to see all user role assignments';

COMMENT ON POLICY "Admins can manage user roles" ON public.user_roles IS
  'Allows admins to INSERT/UPDATE/DELETE user role assignments';

COMMENT ON POLICY "Service role can manage all user roles" ON public.user_roles IS
  'Allows edge functions with service role key to manage roles programmatically';


-- 20260201235633_5a5d63f2-63cb-4b44-b0f0-696c35f57e0e.sql
-- Add unique constraints for seed file ON CONFLICT clauses

-- clients.email unique
ALTER TABLE public.clients 
ADD CONSTRAINT clients_email_unique UNIQUE (email);

-- app_modules.slug unique
ALTER TABLE public.app_modules 
ADD CONSTRAINT app_modules_slug_unique UNIQUE (slug);

-- system_settings (category, key) unique
ALTER TABLE public.system_settings 
ADD CONSTRAINT system_settings_category_key_unique UNIQUE (category, key);

-- app_config.key unique
ALTER TABLE public.app_config 
ADD CONSTRAINT app_config_key_unique UNIQUE (key);

