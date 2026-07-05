-- 20260218000000_prompt_templates.sql
-- ============================================================================
-- Create Prompt Templates Table (AI Hub - Admin)
-- ============================================================================
-- Reusable AI prompt templates with placeholders (e.g. {{recipient_name}}).
-- Used for email generation, deal coaching, and other AI agent prompts.
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'General Purpose',
  template_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_slug ON prompt_templates(slug);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_active ON prompt_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_usage ON prompt_templates(usage_count DESC);

ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

-- Admin / authenticated users can manage (restrict to admin in app or add role check)
CREATE POLICY "Authenticated users can view prompt templates"
  ON prompt_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert prompt templates"
  ON prompt_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update prompt templates"
  ON prompt_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete prompt templates"
  ON prompt_templates FOR DELETE TO authenticated USING (true);

-- Seed example templates
INSERT INTO prompt_templates (name, slug, description, category, template_content, is_active) VALUES
  (
    'Professional Email',
    'professional-email',
    'Standard professional email template.',
    'Email Generation',
    'Write a professional email to {{recipient_name}} about {{topic}}. Keep the tone {{tone}} and length {{length}}.',
    true
  ),
  (
    'Follow-up Email',
    'follow-up-email',
    'Follow-up after initial contact.',
    'Email Generation',
    'Draft a brief follow-up email to {{recipient_name}} regarding {{subject}}. Be polite and include a clear next step.',
    true
  ),
  (
    'Meeting Summary',
    'meeting-summary',
    'Summarize meeting notes into bullet points.',
    'General Purpose',
    'Summarize the following meeting notes into clear bullet points. Include: attendees, decisions, and action items.',
    true
  ),
  (
    'Deal Update',
    'deal-update',
    'Structured update for deal progress.',
    'General Purpose',
    'Write a concise deal update for {{deal_name}}. Include: current stage, next steps, and any blockers.',
    true
  )
ON CONFLICT (slug) DO NOTHING;


-- 20260218120000_ai_agent_categories.sql
-- AI Agent Categories: organize AI agents into named categories (slug links to ai_agents.category)
CREATE TABLE IF NOT EXISTS public.ai_agent_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_agent_categories_slug ON public.ai_agent_categories(slug);
CREATE INDEX idx_ai_agent_categories_is_active ON public.ai_agent_categories(is_active);

ALTER TABLE public.ai_agent_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai_agent_categories"
  ON public.ai_agent_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_ai_agent_categories_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER ai_agent_categories_updated_at
  BEFORE UPDATE ON public.ai_agent_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_agent_categories_updated_at();

-- Seed from distinct ai_agents.category values (slug: lowercase, spaces/special to underscore)
INSERT INTO public.ai_agent_categories (name, slug, description, is_active)
SELECT sub.name, sub.slug, NULL, true
FROM (
  SELECT
    TRIM(cat) AS name,
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(cat), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '_', 'g')) AS slug
  FROM (
    SELECT DISTINCT category AS cat
    FROM public.ai_agents
    WHERE category IS NOT NULL AND TRIM(category) <> ''
  ) d
) sub
WHERE sub.slug <> ''
ON CONFLICT (slug) DO NOTHING;

-- If no categories from agents, insert a default so the page has something
INSERT INTO public.ai_agent_categories (name, slug, description, is_active)
VALUES ('General', 'general', 'General purpose agents', true)
ON CONFLICT (slug) DO NOTHING;


-- 20260218122031_7f91b1f5-ac31-4791-9f36-9fe9546f5c55.sql

CREATE TABLE public.ai_agent_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(100) DEFAULT 'FolderOpen',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.ai_agent_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read categories"
  ON public.ai_agent_categories FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert categories"
  ON public.ai_agent_categories FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update categories"
  ON public.ai_agent_categories FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete categories"
  ON public.ai_agent_categories FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE TRIGGER update_ai_agent_categories_updated_at
  BEFORE UPDATE ON public.ai_agent_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- 20260218130000_ai_agent_categories_icon_display_order.sql
-- Add icon and display_order to ai_agent_categories (Create New Category modal)
ALTER TABLE public.ai_agent_categories
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ai_agent_categories_display_order
  ON public.ai_agent_categories(display_order);


-- 20260218133215_77373985-b978-4349-b1e9-7f2367deed9a.sql

CREATE TABLE public.prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(100) NOT NULL DEFAULT 'general',
  template_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select prompt templates"
  ON public.prompt_templates FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert prompt templates"
  ON public.prompt_templates FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update prompt templates"
  ON public.prompt_templates FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete prompt templates"
  ON public.prompt_templates FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');

CREATE TRIGGER update_prompt_templates_updated_at
  BEFORE UPDATE ON public.prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- 20260219000000_pod_management_complete.sql
-- ============================================================================
-- Pod Management -- Complete Implementation
-- ============================================================================
-- Creates comprehensive pod management system with HR sync, Resource Projection,
-- module permissions, and health tracking capabilities.
-- ============================================================================

-- ========================
-- 1. Update pods table
-- ========================
-- Add missing columns to existing pods table
ALTER TABLE IF EXISTS pods
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS show_in_resource_projection BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ========================
-- 2. pod_employees table
-- ========================
-- Members with login/profile info (used for Resource Projection and module access)
CREATE TABLE IF NOT EXISTS pod_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id UUID, -- FK to Employee table (if exists) or employee_profiles
  has_login BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'synced')),
  is_active BOOLEAN DEFAULT true,
  role TEXT CHECK (role IN ('manager', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pod_id, employee_id),
  UNIQUE (pod_id, user_id)
);

-- Indexes for pod_employees
CREATE INDEX IF NOT EXISTS idx_pod_employees_pod_id ON pod_employees(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_employees_user_id ON pod_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_pod_employees_employee_id ON pod_employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_pod_employees_is_active ON pod_employees(is_active);

-- ========================
-- 3. employee_pods table
-- ========================
-- HR-synced pod membership (read-only from HR system)
CREATE TABLE IF NOT EXISTS employee_pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL, -- FK to Employee or employee_profiles
  pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  synced_from_hr BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (pod_id, employee_id)
);

-- Indexes for employee_pods
CREATE INDEX IF NOT EXISTS idx_employee_pods_pod_id ON employee_pods(pod_id);
CREATE INDEX IF NOT EXISTS idx_employee_pods_employee_id ON employee_pods(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_pods_synced_from_hr ON employee_pods(synced_from_hr);

-- ========================
-- 4. pod_permissions table
-- ========================
-- Module access per pod
CREATE TABLE IF NOT EXISTS pod_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES app_modules(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pod_id, module_id)
);

-- Indexes for pod_permissions
CREATE INDEX IF NOT EXISTS idx_pod_permissions_pod_id ON pod_permissions(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_permissions_module_id ON pod_permissions(module_id);

-- ========================
-- 5. Update app_modules if needed
-- ========================
-- Ensure app_modules has page_route column for pod permissions
ALTER TABLE IF EXISTS app_modules
  ADD COLUMN IF NOT EXISTS page_route TEXT;

-- ========================
-- 6. RLS Policies
-- ========================

-- Enable RLS on all tables
ALTER TABLE pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_permissions ENABLE ROW LEVEL SECURITY;

-- Pods policies
DROP POLICY IF EXISTS "Admins can manage pods" ON pods;
CREATE POLICY "Admins can manage pods"
  ON pods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view active pods" ON pods;
CREATE POLICY "Users can view active pods"
  ON pods FOR SELECT
  USING (is_active = true);

-- pod_employees policies
DROP POLICY IF EXISTS "Admins can manage pod_employees" ON pod_employees;
CREATE POLICY "Admins can manage pod_employees"
  ON pod_employees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view own pod membership" ON pod_employees;
CREATE POLICY "Users can view own pod membership"
  ON pod_employees FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- employee_pods policies (read-only for non-admins)
DROP POLICY IF EXISTS "Admins can manage employee_pods" ON employee_pods;
CREATE POLICY "Admins can manage employee_pods"
  ON employee_pods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view employee_pods" ON employee_pods;
CREATE POLICY "Users can view employee_pods"
  ON employee_pods FOR SELECT
  USING (true);

-- pod_permissions policies
DROP POLICY IF EXISTS "Admins can manage pod_permissions" ON pod_permissions;
CREATE POLICY "Admins can manage pod_permissions"
  ON pod_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view pod_permissions" ON pod_permissions;
CREATE POLICY "Users can view pod_permissions"
  ON pod_permissions FOR SELECT
  USING (true);

-- ========================
-- 7. Sync Function
-- ========================
-- Copies HR-synced members from employee_pods into pod_employees
-- Resolves user_id via email matching against profiles table
CREATE OR REPLACE FUNCTION sync_pod_employees_from_hr()
RETURNS TABLE (
  pod_id UUID,
  employees_synced INTEGER,
  employees_with_login INTEGER,
  employees_without_login INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pod RECORD;
  v_employee RECORD;
  v_user_id UUID;
  v_synced_count INTEGER;
  v_with_login_count INTEGER;
  v_without_login_count INTEGER;
BEGIN
  -- Loop through each pod
  FOR v_pod IN SELECT id FROM pods WHERE is_active = true
  LOOP
    v_synced_count := 0;
    v_with_login_count := 0;
    v_without_login_count := 0;

    -- Get all HR-synced employees for this pod
    FOR v_employee IN
      SELECT DISTINCT ep.employee_id, ep.pod_id
      FROM employee_pods ep
      WHERE ep.pod_id = v_pod.id
        AND ep.synced_from_hr = true
    LOOP
      -- Try to find matching user_id via email
      -- First try employee_profiles
      SELECT user_id INTO v_user_id
      FROM employee_profiles
      WHERE id::text = v_employee.employee_id::text
        OR email = (
          SELECT email FROM employee_profiles WHERE id::text = v_employee.employee_id::text
        )
      LIMIT 1;

      -- If not found, try profiles table by email
      IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id
        FROM profiles
        WHERE email = (
          SELECT email FROM employee_profiles WHERE id::text = v_employee.employee_id::text
        )
        LIMIT 1;
      END IF;

      -- Upsert into pod_employees
      INSERT INTO pod_employees (
        pod_id,
        employee_id,
        user_id,
        has_login,
        source,
        is_active
      )
      VALUES (
        v_employee.pod_id,
        v_employee.employee_id,
        v_user_id,
        v_user_id IS NOT NULL,
        'synced',
        true
      )
      ON CONFLICT (pod_id, employee_id) 
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        has_login = EXCLUDED.has_login,
        updated_at = now()
      WHERE pod_employees.source = 'synced'; -- Only update if it was synced

      v_synced_count := v_synced_count + 1;
      IF v_user_id IS NOT NULL THEN
        v_with_login_count := v_with_login_count + 1;
      ELSE
        v_without_login_count := v_without_login_count + 1;
      END IF;
    END LOOP;

    -- Return stats for this pod
    RETURN QUERY SELECT v_pod.id, v_synced_count, v_with_login_count, v_without_login_count;
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION sync_pod_employees_from_hr() TO authenticated;

-- ========================
-- 8. Triggers
-- ========================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_pod_employees_updated_at ON pod_employees;
CREATE TRIGGER update_pod_employees_updated_at
  BEFORE UPDATE ON pod_employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employee_pods_updated_at ON employee_pods;
CREATE TRIGGER update_employee_pods_updated_at
  BEFORE UPDATE ON employee_pods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pods_updated_at ON pods;
CREATE TRIGGER update_pods_updated_at
  BEFORE UPDATE ON pods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================
-- 9. Helper Views (Optional)
-- ========================

-- View: pods_with_stats
CREATE OR REPLACE VIEW pods_with_stats AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.color,
  p.is_active,
  p.show_in_resource_projection,
  p.created_by,
  p.created_at,
  p.updated_at,
  COUNT(DISTINCT ep.employee_id) FILTER (WHERE ep.synced_from_hr = true) as hr_synced_count,
  COUNT(DISTINCT pe.employee_id) FILTER (WHERE pe.is_active = true) as rp_members_count,
  COUNT(DISTINCT pe.user_id) FILTER (WHERE pe.has_login = true AND pe.is_active = true) as has_login_count,
  COUNT(DISTINCT pe.employee_id) FILTER (WHERE pe.has_login = false AND pe.is_active = true) as no_login_count
FROM pods p
LEFT JOIN employee_pods ep ON ep.pod_id = p.id
LEFT JOIN pod_employees pe ON pe.pod_id = p.id
GROUP BY p.id, p.name, p.description, p.color, p.is_active, p.show_in_resource_projection, p.created_by, p.created_at, p.updated_at;

-- Grant access to view
GRANT SELECT ON pods_with_stats TO authenticated;



-- 20260219102528_621f0472-f86a-4209-89eb-1d5c65a61a5c.sql

-- Create agent_conversations table
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(500),
  summary TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create agent_messages table
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  content TEXT NOT NULL DEFAULT '',
  model_used VARCHAR(200),
  provider_used VARCHAR(200),
  tokens_input INTEGER,
  tokens_output INTEGER,
  latency_ms INTEGER,
  tool_calls JSONB,
  tool_results JSONB,
  citations JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_agent_conversations_agent_user ON public.agent_conversations(agent_id, user_id);
CREATE INDEX idx_agent_conversations_last_message ON public.agent_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX idx_agent_messages_conversation ON public.agent_messages(conversation_id, created_at);

-- RLS for agent_conversations
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON public.agent_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON public.agent_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON public.agent_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON public.agent_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- RLS for agent_messages (scoped through conversation ownership)
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own conversations"
  ON public.agent_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert messages in own conversations"
  ON public.agent_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete messages in own conversations"
  ON public.agent_messages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

-- Trigger: auto-update updated_at on conversations
CREATE TRIGGER update_agent_conversations_updated_at
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function + trigger: update message_count and last_message_at on new message
CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.agent_conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_new_message();


-- 20260219113304_10c58ef2-1938-43b8-836d-356000b05126.sql
-- Refresh conversation message_count and last_message_at from agent_messages.
-- Call after sending messages so the sidebar shows correct counts even if triggers fail.

CREATE OR REPLACE FUNCTION public.refresh_conversation_stats(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_conversations
  SET
    message_count = (SELECT count(*)::integer FROM public.agent_messages WHERE conversation_id = p_conversation_id),
    last_message_at = (SELECT max(created_at) FROM public.agent_messages WHERE conversation_id = p_conversation_id),
    updated_at = now()
  WHERE id = p_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_conversation_stats(UUID) TO authenticated;

-- 20260219151611_c6be66da-fa84-46d8-b84f-07c23bca7e0e.sql

-- 1. ai_agent_categories: add UNIQUE(name), set icon default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_agent_categories_name_key'
    AND conrelid = 'public.ai_agent_categories'::regclass
  ) THEN
    ALTER TABLE public.ai_agent_categories ADD CONSTRAINT ai_agent_categories_name_key UNIQUE (name);
  END IF;
END $$;

ALTER TABLE public.ai_agent_categories
  ALTER COLUMN icon SET DEFAULT 'folder';

-- 2. RLS: allow authenticated users to SELECT (active-only for non-admins; admins see all)
DROP POLICY IF EXISTS "Authenticated can read active categories" ON public.ai_agent_categories;
CREATE POLICY "Authenticated can read active categories"
  ON public.ai_agent_categories FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 3. ai_agents: add deleted_at for soft deletes
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.ai_agents.deleted_at IS 'Soft delete; agents with deleted_at set are excluded from category counts';


-- 20260220065929_a973936a-9bb9-492e-8ba9-746bb2220d53.sql

-- Refresh conversation message_count and last_message_at from agent_messages.
-- Call after sending messages so the sidebar shows correct counts even if triggers fail.

CREATE OR REPLACE FUNCTION public.refresh_conversation_stats(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_conversations
  SET
    message_count = (SELECT count(*)::integer FROM public.agent_messages WHERE conversation_id = p_conversation_id),
    last_message_at = (SELECT max(created_at) FROM public.agent_messages WHERE conversation_id = p_conversation_id),
    updated_at = now()
  WHERE id = p_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_conversation_stats(UUID) TO authenticated;


-- 20260220070027_25dc9660-689a-4012-8b06-3f3258eee7f2.sql

-- ============================================================================
-- Admin Semantic Search: RPC with optional project/client/manager filters
-- ============================================================================

CREATE OR REPLACE FUNCTION match_embeddings_admin(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_entity_type text DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL,
  filter_project_name text DEFAULT NULL,
  filter_project_manager text DEFAULT NULL,
  filter_client_name text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  entity_id text,
  content text,
  metadata jsonb,
  user_id uuid,
  similarity float,
  unified_document_id uuid,
  project_name text,
  project_manager text,
  client_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      e.id,
      e.entity_type,
      e.entity_id::text,
      e.content,
      e.metadata,
      e.user_id,
      (1 - (e.embedding <=> query_embedding))::float AS sim,
      e.unified_document_id
    FROM public.embeddings e
    WHERE (1 - (e.embedding <=> query_embedding)) > match_threshold
      AND (filter_entity_type IS NULL OR e.entity_type = filter_entity_type)
      AND (filter_user_id IS NULL OR e.user_id = filter_user_id)
    ORDER BY e.embedding <=> query_embedding
    LIMIT CASE
      WHEN filter_project_name IS NOT NULL AND filter_project_name != ''
        OR filter_project_manager IS NOT NULL AND filter_project_manager != ''
        OR filter_client_name IS NOT NULL AND filter_client_name != ''
      THEN LEAST(500, match_count * 10)
      ELSE match_count
    END
  ),
  ctx AS (
    SELECT
      b.id,
      b.entity_type,
      b.entity_id,
      b.content,
      b.metadata,
      b.user_id,
      b.sim,
      b.unified_document_id,
      p.name AS proj_name,
      prof.full_name AS proj_manager,
      c.name AS cli_name
    FROM base b
    LEFT JOIN public.meeting_transcripts mt
      ON b.entity_type = 'meeting_transcript' AND b.entity_id::uuid = mt.id
    LEFT JOIN public.meetings m ON mt.meeting_id = m.id
    LEFT JOIN public.clients c ON m.client_id = c.id
    LEFT JOIN public.meeting_assignments ma
      ON ma.meeting_id = m.id AND ma.entity_type = 'project'
    LEFT JOIN public.projects p ON ma.entity_id = p.id
    LEFT JOIN public.profiles prof ON p.owner_id = prof.id
  )
  SELECT
    ctx.id,
    ctx.entity_type,
    ctx.entity_id,
    ctx.content,
    ctx.metadata,
    ctx.user_id,
    ctx.sim,
    ctx.unified_document_id,
    ctx.proj_name,
    ctx.proj_manager,
    ctx.cli_name
  FROM ctx
  WHERE
    (filter_project_name IS NULL OR filter_project_name = '' OR ctx.proj_name ILIKE '%' || filter_project_name || '%')
    AND (filter_project_manager IS NULL OR filter_project_manager = '' OR ctx.proj_manager ILIKE '%' || filter_project_manager || '%')
    AND (filter_client_name IS NULL OR filter_client_name = '' OR ctx.cli_name ILIKE '%' || filter_client_name || '%')
  ORDER BY ctx.sim DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_embeddings_admin IS 'Admin semantic search with optional entity_type and meeting context filters (project_name, project_manager, client_name). Returns similarity and optional project/client/manager for meeting transcripts.';

-- Ensure embeddings has index for vector search (may already exist)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_cosine
  ON public.embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);


-- 20260220080121_e28f8a30-8531-4557-9db2-3619a3188847.sql
INSERT INTO public.system_settings (category, key, value, description, created_at, updated_at)
VALUES (
  'ai',
  'embedding_processing_enabled',
  'true'::jsonb,
  'When true, embedding Edge Functions process pending meetings and knowledge files. When false, they return 503 or skip work.',
  NOW(),
  NOW()
)
ON CONFLICT (category, key) DO UPDATE SET
  updated_at = NOW(),
  description = EXCLUDED.description;

