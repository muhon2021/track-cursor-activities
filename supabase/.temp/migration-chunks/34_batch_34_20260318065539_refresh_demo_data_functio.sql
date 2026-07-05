-- 20260310_fix_agent_messages_rls.sql
-- Fix RLS policies for agent_conversations and agent_messages.
-- Two older migrations overlap on these tables and can leave the INSERT
-- policies in a broken/missing state. This migration idempotently recreates
-- the tables (if absent) and drops/recreates every policy with safe names.

-- ============================================================
-- agent_conversations
-- ============================================================

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

CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent_user
  ON public.agent_conversations(agent_id, user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_last_message
  ON public.agent_conversations(last_message_at DESC NULLS LAST);

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

-- Drop all known variants of the conversation policies before recreating
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.agent_conversations;
DROP POLICY IF EXISTS "Admins can view all conversations" ON public.agent_conversations;

CREATE POLICY "Users can view own conversations"
  ON public.agent_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON public.agent_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON public.agent_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON public.agent_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversations"
  ON public.agent_conversations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- agent_messages
-- ============================================================

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

CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation
  ON public.agent_messages(conversation_id, created_at);

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

-- Drop all known variants of the message policies before recreating
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Users can delete messages in their conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Users can delete messages in own conversations" ON public.agent_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON public.agent_messages;

CREATE POLICY "Users can view messages in own conversations"
  ON public.agent_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert messages in own conversations"
  ON public.agent_messages FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete messages in own conversations"
  ON public.agent_messages FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all messages"
  ON public.agent_messages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Trigger: keep message_count and last_message_at in sync
-- ============================================================

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

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON public.agent_messages;
CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_new_message();


-- 20260312090000_clickup_workamajig_providers.sql
-- Enable ClickUp provider and add Workamajig provider + fields
-- This migration assumes the Integration Hub core schema is already applied.

DO $$
DECLARE
  cat_pm UUID;
  provider_clickup UUID;
  provider_workamajig UUID;
BEGIN
  -- Get Project Management category id
  SELECT id INTO cat_pm
  FROM public.integration_categories
  WHERE slug = 'project-management';

  -- Safety guard
  IF cat_pm IS NULL THEN
    RAISE NOTICE 'Project Management category not found, skipping provider setup';
    RETURN;
  END IF;

  -- Ensure ClickUp provider exists and is enabled (was seeded as coming soon)
  SELECT id INTO provider_clickup
  FROM public.integration_providers
  WHERE slug = 'clickup';

  IF provider_clickup IS NULL THEN
    INSERT INTO public.integration_providers (
      category_id,
      name,
      slug,
      description,
      auth_type,
      oauth_config,
      docs_url,
      is_available,
      is_coming_soon,
      display_order
    )
    VALUES (
      cat_pm,
      'ClickUp',
      'clickup',
      'All-in-one productivity platform',
      'oauth2',
      '{"authorize_url": "https://app.clickup.com/api", "token_url": "https://api.clickup.com/api/v2/oauth/token"}'::jsonb,
      'https://clickup.com/api',
      true,
      false,
      50
    )
    RETURNING id INTO provider_clickup;
  ELSE
    UPDATE public.integration_providers
    SET
      category_id    = COALESCE(category_id, cat_pm),
      auth_type      = 'oauth2',
      oauth_config   = COALESCE(
        oauth_config,
        '{"authorize_url": "https://app.clickup.com/api", "token_url": "https://api.clickup.com/api/v2/oauth/token"}'::jsonb
      ),
      is_available   = true,
      is_coming_soon = false
    WHERE id = provider_clickup;
  END IF;

  -- Ensure Workamajig provider exists (token-based API, not browser OAuth)
  SELECT id INTO provider_workamajig
  FROM public.integration_providers
  WHERE slug = 'workamajig';

  IF provider_workamajig IS NULL THEN
    INSERT INTO public.integration_providers (
      category_id,
      name,
      slug,
      description,
      auth_type,
      docs_url,
      is_available,
      is_coming_soon,
      display_order
    )
    VALUES (
      cat_pm,
      'Workamajig',
      'workamajig',
      'Agency project management and finance platform',
      'api_key',
      'https://support.workamajig.com/hc/en-us/articles/360023007451-API-Overview',
      true,
      false,
      60
    )
    RETURNING id INTO provider_workamajig;
  END IF;

  -- Add ClickUp org-level fields (client_id / client_secret) if missing
  IF provider_clickup IS NOT NULL THEN
    INSERT INTO public.integration_fields (
      provider_id,
      field_key,
      label,
      field_type,
      placeholder,
      is_required,
      is_sensitive,
      help_text,
      display_order
    )
    VALUES
      (
        provider_clickup,
        'client_id',
        'Client ID',
        'text',
        'clk_...',
        true,
        false,
        'ClickUp OAuth app Client ID from your workspace settings',
        10
      )
    ON CONFLICT (provider_id, field_key) DO NOTHING;

    INSERT INTO public.integration_fields (
      provider_id,
      field_key,
      label,
      field_type,
      placeholder,
      is_required,
      is_sensitive,
      help_text,
      display_order
    )
    VALUES
      (
        provider_clickup,
        'client_secret',
        'Client Secret',
        'password',
        '****************',
        true,
        true,
        'ClickUp OAuth app Client Secret (keep this safe)',
        20
      )
    ON CONFLICT (provider_id, field_key) DO NOTHING;
  END IF;

  -- Optional Workamajig org-level defaults for API usage
  IF provider_workamajig IS NOT NULL THEN
    INSERT INTO public.integration_fields (
      provider_id,
      field_key,
      label,
      field_type,
      placeholder,
      is_required,
      is_sensitive,
      help_text,
      display_order
    )
    VALUES
      (
        provider_workamajig,
        'base_url',
        'API Base URL',
        'url',
        'https://your-subdomain.workamajig.com',
        true,
        false,
        'Your Workamajig instance base URL (without /api/beta1).',
        10
      )
    ON CONFLICT (provider_id, field_key) DO NOTHING;

    INSERT INTO public.integration_fields (
      provider_id,
      field_key,
      label,
      field_type,
      placeholder,
      is_required,
      is_sensitive,
      help_text,
      display_order
    )
    VALUES
      (
        provider_workamajig,
        'api_access_token',
        'Company API Access Token',
        'password',
        'APIAccessToken from Workamajig',
        true,
        true,
        'Company API access token from Workamajig API settings (APIAccessToken header).',
        20
      )
    ON CONFLICT (provider_id, field_key) DO NOTHING;

    INSERT INTO public.integration_fields (
      provider_id,
      field_key,
      label,
      field_type,
      placeholder,
      is_required,
      is_sensitive,
      help_text,
      display_order
    )
    VALUES
      (
        provider_workamajig,
        'user_token',
        'User Token',
        'password',
        'UserToken from Workamajig',
        true,
        true,
        'User-specific API user token from Workamajig (UserToken header).',
        30
      )
    ON CONFLICT (provider_id, field_key) DO NOTHING;
  END IF;
END;
$$;



-- 20260312095210_b020fad3-3646-4fed-9065-327f8851a96d.sql

-- Add Project Management category and ClickUp/Workamajig providers

INSERT INTO public.integration_categories (name, slug, description, icon, display_order, enabled)
VALUES ('Project Management', 'project-management', 'Project management and productivity tools', 'FolderKanban', 5, true)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  cat_pm UUID;
  provider_clickup UUID;
  provider_workamajig UUID;
BEGIN
  SELECT id INTO cat_pm FROM public.integration_categories WHERE slug = 'project-management';

  IF cat_pm IS NULL THEN
    RAISE EXCEPTION 'Project Management category not found after insert';
  END IF;

  -- ClickUp provider
  SELECT id INTO provider_clickup FROM public.integration_providers WHERE slug = 'clickup';
  IF provider_clickup IS NULL THEN
    INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, oauth_config, docs_url, is_available, is_coming_soon, display_order)
    VALUES (cat_pm, 'ClickUp', 'clickup', 'All-in-one productivity platform', 'oauth2', '{"authorize_url":"https://app.clickup.com/api","token_url":"https://api.clickup.com/api/v2/oauth/token"}'::jsonb, 'https://clickup.com/api', true, false, 50)
    RETURNING id INTO provider_clickup;
  ELSE
    UPDATE public.integration_providers SET category_id = cat_pm, auth_type = 'oauth2', is_available = true, is_coming_soon = false WHERE id = provider_clickup;
  END IF;

  -- Workamajig provider
  SELECT id INTO provider_workamajig FROM public.integration_providers WHERE slug = 'workamajig';
  IF provider_workamajig IS NULL THEN
    INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, docs_url, is_available, is_coming_soon, display_order)
    VALUES (cat_pm, 'Workamajig', 'workamajig', 'Agency project management and finance platform', 'api_key', 'https://support.workamajig.com/hc/en-us/articles/360023007451-API-Overview', true, false, 60)
    RETURNING id INTO provider_workamajig;
  END IF;

  -- ClickUp fields
  IF provider_clickup IS NOT NULL THEN
    INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
    VALUES (provider_clickup, 'client_id', 'Client ID', 'text', 'clk_...', true, false, 'ClickUp OAuth app Client ID', 10)
    ON CONFLICT (provider_id, field_key) DO NOTHING;
    INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
    VALUES (provider_clickup, 'client_secret', 'Client Secret', 'password', '****************', true, true, 'ClickUp OAuth app Client Secret', 20)
    ON CONFLICT (provider_id, field_key) DO NOTHING;
  END IF;

  -- Workamajig fields
  IF provider_workamajig IS NOT NULL THEN
    INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
    VALUES (provider_workamajig, 'base_url', 'API Base URL', 'url', 'https://your-subdomain.workamajig.com', true, false, 'Your Workamajig instance base URL', 10)
    ON CONFLICT (provider_id, field_key) DO NOTHING;
    INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
    VALUES (provider_workamajig, 'api_access_token', 'Company API Access Token', 'password', 'APIAccessToken from Workamajig', true, true, 'Company API access token (APIAccessToken header)', 20)
    ON CONFLICT (provider_id, field_key) DO NOTHING;
    INSERT INTO public.integration_fields (provider_id, field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
    VALUES (provider_workamajig, 'user_token', 'User Token', 'password', 'UserToken from Workamajig', true, true, 'User-specific API token (UserToken header)', 30)
    ON CONFLICT (provider_id, field_key) DO NOTHING;
  END IF;
END;
$$;


-- 20260318052542_40a27b66-4593-41af-9e86-1d7502f57aef.sql

INSERT INTO tasks (title, description, status, priority, created_by)
VALUES (
  'Implement 14 Tier 1 AI Agents — Seed into ai_agents table',
  '## Overview

Review **docs/ai-agent-suggestions.md** for the full analysis of 50+ AI agents from the SJ Innovation catalog mapped against this project''s infrastructure.

This task covers the **14 Tier 1 agents** that can be implemented immediately by seeding rows into the `ai_agents` table — no new tables, no new Edge Functions required.

---

## Agents to Implement

| # | Slug | Category | Priority | What It Does |
|---|------|----------|----------|--------------|
| 1 | deal-ai-chat | Sales & CRM | High | Interactive deal strategy chat using deals, contacts, activities data |
| 2 | deal-daily-briefing | Sales & CRM | Medium | Daily summary of pipeline changes, stale deals, upcoming closes |
| 3 | quick-deal-email | Sales & CRM | High | Generate context-aware follow-up emails for deals |
| 4 | lovable-prototype-builder | Sales & CRM | Medium | Generate Lovable prompts for rapid prototyping from deal/project context |
| 5 | client-call-analyzer | Meetings | High | Analyze meeting transcripts for sentiment, action items, risks |
| 6 | client-communication-coach | Meetings | Medium | Coach on communication style based on meeting history |
| 7 | meeting-efficiency-analyzer | Meetings | High | Score meetings on efficiency, suggest improvements |
| 8 | eos-pattern-detective | EOS | Medium | Find recurring patterns in EOS issues across quarters |
| 9 | eos-pod-health | EOS | Medium | Analyze pod health using issues, scorecards, accountability data |
| 10 | eos-quarterly-digest | EOS | High | Generate quarterly EOS performance digest |
| 11 | bug-feature-planner | Project Mgmt | High | Break down bugs/features into actionable tasks with estimates |
| 12 | code-review-generator | Project Mgmt | Medium | Generate code review checklists based on project context |
| 13 | technical-plan-generator | Project Mgmt | High | Create technical implementation plans from requirements |
| 14 | project-analyzer | Project Mgmt | Medium | Analyze project health, risks, timeline adherence |

---

## Implementation Steps

### Step 1: Craft System Prompts
For each agent, write a system prompt that defines the agent''s role, specifies data sources, sets output format, and includes guardrails.

### Step 2: Insert into ai_agents table
Use this SQL pattern:

INSERT INTO ai_agents (name, slug, description, system_prompt, category, is_enabled, welcome_message, conversation_starters, data_sources) VALUES (''Agent Name'', ''agent-slug'', ''Description'', ''System prompt...'', ''category'', true, ''Welcome message'', ''["Starter 1", "Starter 2"]''::jsonb, ''["table1", "table2"]''::jsonb);

### Step 3: Test via AI Hub
1. Navigate to AI Hub
2. Verify each agent appears
3. Test with sample prompts
4. Iterate on system prompts

---

## Acceptance Criteria
- All 14 agents seeded into ai_agents table
- Each agent has a well-crafted system prompt
- Each agent has conversation starters configured
- Each agent has appropriate data_sources JSON
- All agents visible and runnable in AI Hub
- High-priority agents tested with at least 3 sample prompts each

## Reference
- Full analysis: docs/ai-agent-suggestions.md
- Existing agents: SELECT slug, name FROM ai_agents ORDER BY category;
- Edge function: run-ai-agent (generic agent runner)',
  'todo',
  'high',
  (SELECT id FROM profiles LIMIT 1)
);


-- 20260318060800_83c09a2e-9df3-43ca-a833-6230b68fafa9.sql

-- Seed demo data: assign projects and tasks to PM and IC test accounts
DO $$
DECLARE
  u_pm UUID := (SELECT id FROM auth.users WHERE email = 'demo@collabai.software' LIMIT 1);
  u_ic UUID := (SELECT id FROM auth.users WHERE email = 'ic@collabai.software'   LIMIT 1);
  p_techstart UUID := (SELECT id FROM projects WHERE slug = 'techstart-ai-integration' LIMIT 1);
  p_qbr      UUID := (SELECT id FROM projects WHERE slug = 'enterprise-qbr-prep'      LIMIT 1);
  p_acme     UUID := (SELECT id FROM projects WHERE slug = 'acme-platform-rollout'     LIMIT 1);
BEGIN
  IF u_pm IS NULL OR u_ic IS NULL THEN
    RAISE NOTICE 'PM or IC user not found — skipping demo data seed.';
    RETURN;
  END IF;

  -- Assign PM as owner of 2 projects
  UPDATE projects SET owner_id = u_pm WHERE id IN (p_techstart, p_qbr);

  INSERT INTO project_members (project_id, user_id, role) VALUES
    (p_techstart, u_pm, 'owner'),
    (p_qbr,      u_pm, 'owner')
  ON CONFLICT DO NOTHING;

  -- Assign IC as member on 2 projects
  INSERT INTO project_members (project_id, user_id, role) VALUES
    (p_acme,      u_ic, 'member'),
    (p_techstart, u_ic, 'member')
  ON CONFLICT DO NOTHING;

  -- Reassign tasks to PM
  UPDATE tasks SET assigned_to = u_pm
  WHERE slug IN (
    'implement-sso-entra', 'onboard-acme-corp', 'techstart-training',
    'qbr-enterprise-solutions', 'setup-monitoring-alerts', 'csv-export-productivity'
  );

  -- Reassign tasks to IC
  UPDATE tasks SET assigned_to = u_ic
  WHERE slug IN (
    'fix-datepicker-tz', 'api-rate-limit-docs', 'upgrade-react-router-v7',
    'acme-billing-fix', 'renew-ssl-certs', 'followup-finedge'
  );
END $$;


-- 20260318065539_refresh_demo_data_function.sql
-- ============================================================
-- Migration: refresh_demo_data() function
-- Fixes: owner_dashboard_metrics view slug (in_progress → in-progress)
-- Creates: refresh_demo_data() SECURITY DEFINER function
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Fix the owner_dashboard_metrics view — slug was 'in_progress'
--    but actual project_statuses slug is 'in-progress' (hyphenated)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.owner_dashboard_metrics AS
SELECT
  -- Revenue: sum of deal values closed in the last 7 days
  (
    SELECT COALESCE(SUM(value), 0)::numeric
    FROM public.deals
    WHERE closed_at >= now() - interval '7 days'
  ) AS revenue_this_week,

  -- Team utilization: average across current week's records
  (
    SELECT COALESCE(ROUND(AVG(utilization_pct)::numeric, 1), 0)
    FROM public.productivity_records
    WHERE week_start = date_trunc('week', now())::date
  ) AS team_utilization,

  -- Projects in progress (not archived) — FIXED: 'in-progress' not 'in_progress'
  (
    SELECT COUNT(*)
    FROM public.projects p
    JOIN public.project_statuses ps ON ps.id = p.status_id
    WHERE p.is_archived = false
      AND ps.slug = 'in-progress'
  ) AS projects_in_progress,

  -- At-risk projects
  (
    SELECT COUNT(*)
    FROM public.projects
    WHERE is_at_risk = true
      AND is_archived = false
  ) AS projects_at_risk,

  -- Active clients
  (
    SELECT COUNT(*)
    FROM public.clients
    WHERE status = 'active'
  ) AS active_clients,

  -- Active team members
  (
    SELECT COUNT(*)
    FROM public.profiles
    WHERE is_active = true
  ) AS active_team_members,

  now() AS generated_at;


-- ─────────────────────────────────────────────────────────────
-- 2. refresh_demo_data() — idempotent function that inserts
--    relative-date demo data so dashboards always show content.
--    Tagged rows are cleaned up and re-inserted each call.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_client_id UUID;
  v_in_progress_status UUID;
  v_today DATE := CURRENT_DATE;
  v_week_start DATE := date_trunc('week', now())::date;
  v_result jsonb := '{}'::jsonb;
BEGIN
  -- ── Resolve owner user (first admin, or first user) ──
  SELECT ur.user_id INTO v_owner_id
  FROM user_roles ur
  WHERE ur.role = 'admin'
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT id INTO v_owner_id FROM auth.users LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No users found in auth.users');
  END IF;

  -- ── Resolve first active client ──
  SELECT id INTO v_client_id FROM clients WHERE status = 'active' LIMIT 1;

  -- ── Resolve 'in-progress' status id ──
  SELECT id INTO v_in_progress_status FROM project_statuses WHERE slug = 'in-progress' LIMIT 1;

  -- ═══════════════════════════════════════════════════════
  -- A. DEALS — delete old demo-refresh deals, insert 2 new
  -- ═══════════════════════════════════════════════════════
  DELETE FROM deals WHERE data_source = 'demo_refresh';

  INSERT INTO deals (title, slug, stage, value, currency, probability, closed_at, client_id, owner_id, data_source, created_by)
  VALUES
    (
      'Enterprise Platform License',
      'demo-refresh-deal-1-' || to_char(v_today, 'YYYYMMDD'),
      'won', 35000.00, 'USD', 100,
      (now() - interval '2 days'),
      v_client_id, v_owner_id, 'demo_refresh', v_owner_id
    ),
    (
      'Professional Services Engagement',
      'demo-refresh-deal-2-' || to_char(v_today, 'YYYYMMDD'),
      'won', 25000.00, 'USD', 100,
      (now() - interval '4 days'),
      v_client_id, v_owner_id, 'demo_refresh', v_owner_id
    )
  ON CONFLICT (slug) DO UPDATE SET
    closed_at = EXCLUDED.closed_at,
    updated_at = now();

  v_result := v_result || jsonb_build_object('deals_inserted', 2);

  -- ═══════════════════════════════════════════════════════
  -- B. PRODUCTIVITY RECORDS — delete old, insert 5 for current week
  -- ═══════════════════════════════════════════════════════
  DELETE FROM productivity_records
  WHERE employee_email LIKE 'demo-refresh-%';

  INSERT INTO productivity_records
    (employee_email, week_start, week_number, year, total_hours, billable_hours,
     tasks_completed, tasks_assigned, meetings_attended, utilization_pct, efficiency_score,
     attendance_status, department)
  VALUES
    ('demo-refresh-alice@example.com', v_week_start, EXTRACT(WEEK FROM v_week_start)::int, EXTRACT(YEAR FROM v_week_start)::int,
     40, 35, 12, 14, 5, 87.5, 85.0, 'present', 'Engineering'),
    ('demo-refresh-bob@example.com', v_week_start, EXTRACT(WEEK FROM v_week_start)::int, EXTRACT(YEAR FROM v_week_start)::int,
     38, 30, 8, 10, 4, 78.9, 80.0, 'present', 'Engineering'),
    ('demo-refresh-carol@example.com', v_week_start, EXTRACT(WEEK FROM v_week_start)::int, EXTRACT(YEAR FROM v_week_start)::int,
     42, 37, 15, 16, 6, 88.1, 93.0, 'present', 'Design'),
    ('demo-refresh-dave@example.com', v_week_start, EXTRACT(WEEK FROM v_week_start)::int, EXTRACT(YEAR FROM v_week_start)::int,
     36, 28, 7, 9, 3, 77.8, 78.0, 'present', 'Product'),
    ('demo-refresh-eve@example.com', v_week_start, EXTRACT(WEEK FROM v_week_start)::int, EXTRACT(YEAR FROM v_week_start)::int,
     40, 34, 10, 12, 5, 85.0, 88.0, 'present', 'Engineering')
  ON CONFLICT (employee_email, week_start) DO UPDATE SET
    utilization_pct = EXCLUDED.utilization_pct,
    total_hours = EXCLUDED.total_hours,
    billable_hours = EXCLUDED.billable_hours,
    updated_at = now();

  v_result := v_result || jsonb_build_object('productivity_records_inserted', 5);

  -- ═══════════════════════════════════════════════════════
  -- C. MEETINGS — delete old demo-refresh, insert 4 for current week
  -- ═══════════════════════════════════════════════════════
  DELETE FROM meetings WHERE description LIKE '%[demo-refresh]%';

  INSERT INTO meetings (title, description, organizer_id, client_id, scheduled_at, duration_minutes, status, meeting_type)
  VALUES
    (
      'Weekly Team Standup',
      'Regular team sync to review progress and blockers. [demo-refresh]',
      v_owner_id, v_client_id,
      (v_week_start + interval '1 day' + interval '9 hours'),  -- Monday 9 AM
      30, 'scheduled', 'virtual'
    ),
    (
      'Client Strategy Review',
      'Quarterly strategy alignment with stakeholders. [demo-refresh]',
      v_owner_id, v_client_id,
      (v_week_start + interval '2 days' + interval '14 hours'),  -- Tuesday 2 PM
      60, 'scheduled', 'virtual'
    ),
    (
      'Sprint Planning',
      'Plan next sprint backlog and capacity. [demo-refresh]',
      v_owner_id, NULL,
      (v_week_start + interval '3 days' + interval '10 hours'),  -- Wednesday 10 AM
      45, 'scheduled', 'virtual'
    ),
    (
      'Product Demo & Feedback',
      'Demo latest features to internal stakeholders. [demo-refresh]',
      v_owner_id, v_client_id,
      (v_week_start + interval '4 days' + interval '15 hours'),  -- Thursday 3 PM
      60, 'scheduled', 'virtual'
    );

  v_result := v_result || jsonb_build_object('meetings_inserted', 4);

  -- ═══════════════════════════════════════════════════════
  -- D. PROJECTS — set 3 projects to 'in-progress', 1 at-risk
  -- ═══════════════════════════════════════════════════════
  IF v_in_progress_status IS NOT NULL THEN
    UPDATE projects
    SET status_id = v_in_progress_status,
        is_archived = false,
        updated_at = now()
    WHERE slug IN ('acme-platform-rollout', 'techstart-ai-integration', 'enterprise-qbr-prep')
      AND is_archived = false;

    -- Mark one project at-risk
    UPDATE projects
    SET is_at_risk = true,
        updated_at = now()
    WHERE slug = 'enterprise-qbr-prep'
      AND is_archived = false;

    v_result := v_result || jsonb_build_object('projects_updated', 3, 'projects_at_risk', 1);
  ELSE
    v_result := v_result || jsonb_build_object('projects_warning', 'in-progress status not found');
  END IF;

  v_result := v_result || jsonb_build_object('success', true, 'refreshed_at', now()::text);

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users (admin check can happen in app layer)
GRANT EXECUTE ON FUNCTION public.refresh_demo_data() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Optional: pg_cron schedule (uncomment to auto-refresh weekly)
-- ─────────────────────────────────────────────────────────────
-- SELECT cron.schedule(
--   'refresh-demo-data-weekly',
--   '0 1 * * 1',  -- Every Monday at 1 AM UTC
--   $$SELECT public.refresh_demo_data()$$
-- );


