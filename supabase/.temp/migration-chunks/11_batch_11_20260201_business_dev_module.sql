-- 20260201_actions_module.sql
-- ============================================================================
-- Migration: Actions Module (Phase 1)
-- Adds task streams, task comments, subtask support, categories, and
-- contributors to enable full standalone task management.
--
-- The existing "tasks" table is preserved. New columns are added via ALTER
-- rather than creating a separate tasks_v2, keeping migration simpler
-- and avoiding data duplication.
-- ============================================================================

-- ===================
-- 1. task_streams
-- ===================
-- Organizational buckets for tasks (like channels or workspaces).

CREATE TABLE IF NOT EXISTS task_streams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  is_archived BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE task_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read task_streams"
  ON task_streams FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create task_streams"
  ON task_streams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Stream creators and admins can update task_streams"
  ON task_streams FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );


-- ===================
-- 2. task_stream_members
-- ===================
-- Stream membership for access control and notifications.

CREATE TABLE IF NOT EXISTS task_stream_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES task_streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stream_id, user_id)
);

ALTER TABLE task_stream_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read their stream memberships"
  ON task_stream_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Stream owners and admins can manage members"
  ON task_stream_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM task_stream_members sm
      WHERE sm.stream_id = task_stream_members.stream_id
      AND sm.user_id = auth.uid()
      AND sm.role IN ('owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );


-- ===================
-- 3. task_categories
-- ===================
-- Label/tag system for tasks.

CREATE TABLE IF NOT EXISTS task_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  color TEXT DEFAULT '#8b5cf6',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read task_categories"
  ON task_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage task_categories"
  ON task_categories FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Seed default categories
INSERT INTO task_categories (name, slug, color, sort_order) VALUES
  ('Bug Fix', 'bug-fix', '#ef4444', 1),
  ('Feature', 'feature', '#3b82f6', 2),
  ('Improvement', 'improvement', '#8b5cf6', 3),
  ('Research', 'research', '#f59e0b', 4),
  ('Documentation', 'documentation', '#10b981', 5)
ON CONFLICT (slug) DO NOTHING;


-- ===================
-- 4. Extend tasks table
-- ===================
-- Add new columns for streams, subtasks, and richer task data.

-- Stream reference
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS stream_id UUID REFERENCES task_streams(id) ON DELETE SET NULL;

-- Subtask support (self-referencing)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE;

-- Category reference
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES task_categories(id) ON DELETE SET NULL;

-- Completion tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Slug for URL-friendly identifiers
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS slug TEXT;

-- Position for manual ordering within a stream or view
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_tasks_slug ON tasks(slug);

-- Create index for stream filtering
CREATE INDEX IF NOT EXISTS idx_tasks_stream_id ON tasks(stream_id);

-- Create index for subtask lookups
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);

-- Create index for assigned user filtering
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);


-- ===================
-- 5. task_comments
-- ===================
-- Threaded comments on tasks.

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES task_comments(id) ON DELETE CASCADE,
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read task_comments"
  ON task_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create task_comments"
  ON task_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Comment authors can update their comments"
  ON task_comments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Comment authors and admins can delete comments"
  ON task_comments FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);


-- ===================
-- 6. task_attachments
-- ===================
-- File attachments on tasks (stored in Supabase Storage).

CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read task_attachments"
  ON task_attachments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload task_attachments"
  ON task_attachments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Uploaders and admins can delete task_attachments"
  ON task_attachments FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );


-- ===================
-- 7. task_contributors
-- ===================
-- Additional contributors/watchers on a task beyond the assignee.

CREATE TABLE IF NOT EXISTS task_contributors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'contributor' CHECK (role IN ('contributor', 'reviewer', 'watcher')),
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, user_id)
);

ALTER TABLE task_contributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read task_contributors"
  ON task_contributors FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Task assignees and admins can manage task_contributors"
  ON task_contributors FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_contributors.task_id
      AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );


-- 20260201_app_modules.sql
-- ============================================================================
-- Migration: app_modules, user_module_permissions, system_settings
-- Phase 0: Foundation for modular architecture
-- ============================================================================

-- ===================
-- 1. app_modules table
-- ===================
-- Registry of available modules. Admin can toggle modules on/off.

CREATE TABLE IF NOT EXISTS app_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'Layout',
  category TEXT DEFAULT 'business' CHECK (category IN ('core', 'business', 'intelligence', 'operations')),
  is_core BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  dependencies TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE app_modules ENABLE ROW LEVEL SECURITY;

-- Everyone can read modules (needed for navigation filtering)
CREATE POLICY "Anyone can read app_modules"
  ON app_modules FOR SELECT
  USING (true);

-- Only admins can update modules
CREATE POLICY "Admins can update app_modules"
  ON app_modules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can insert modules
CREATE POLICY "Admins can insert app_modules"
  ON app_modules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Seed default modules
INSERT INTO app_modules (name, slug, description, icon, category, is_core, is_active, sort_order, dependencies) VALUES
  ('Platform Core', 'platform', 'Authentication, layouts, navigation, UI components', 'Layout', 'core', true, true, 0, '{}'),
  ('Actions', 'actions', 'Standalone task management with streams and comments', 'CheckSquare', 'operations', false, true, 1, '{platform}'),
  ('EOS', 'eos', 'Entrepreneurial Operating System - V/TO, OKRs, issues, scorecards', 'Target', 'business', false, true, 2, '{platform}'),
  ('Meetings', 'meetings', 'Meeting lifecycle management with AI summaries', 'Calendar', 'operations', false, true, 3, '{platform}'),
  ('Knowledge Base', 'knowledge', 'Knowledge management with vector embeddings and semantic search', 'BookOpen', 'intelligence', false, true, 4, '{platform}'),
  ('Projects', 'projects', 'Project lifecycle management with billing and resource projection', 'FolderKanban', 'business', false, true, 5, '{platform}'),
  ('Business Development', 'business-dev', 'Deal pipeline, client management, contacts, CRM integration', 'TrendingUp', 'business', false, true, 6, '{platform}'),
  ('Productivity', 'productivity', 'Team and individual productivity metrics and AI insights', 'BarChart3', 'operations', false, true, 7, '{platform}'),
  ('Admin', 'admin', 'Administrative control panel for platform configuration', 'Shield', 'core', true, true, 8, '{platform}')
ON CONFLICT (slug) DO NOTHING;


-- ==============================
-- 2. user_module_permissions table
-- ==============================
-- Per-user module access. If no row exists, user has access to all active modules.
-- When rows exist for a user, they can only access modules listed here.

CREATE TABLE IF NOT EXISTS user_module_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES app_modules(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Enable RLS
ALTER TABLE user_module_permissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own permissions
CREATE POLICY "Users can read own module permissions"
  ON user_module_permissions FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all permissions
CREATE POLICY "Admins can read all module permissions"
  ON user_module_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Admins can manage permissions
CREATE POLICY "Admins can insert module permissions"
  ON user_module_permissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete module permissions"
  ON user_module_permissions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );


-- ========================
-- 3. system_settings table
-- ========================
-- Key-value settings organized by category.
-- Used for module-specific configuration that doesn't fit in app_config.

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category, key)
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can read system_settings"
  ON system_settings FOR SELECT
  USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can manage system_settings"
  ON system_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );


-- ==============================
-- 4. RPC: get_user_modules
-- ==============================
-- Returns list of module slugs the current user can access.

CREATE OR REPLACE FUNCTION get_user_modules()
RETURNS TABLE(slug TEXT, name TEXT, icon TEXT, category TEXT) AS $$
DECLARE
  has_restrictions BOOLEAN;
BEGIN
  -- Check if user has specific module restrictions
  SELECT EXISTS(
    SELECT 1 FROM user_module_permissions WHERE user_id = auth.uid()
  ) INTO has_restrictions;

  IF has_restrictions THEN
    -- Return only granted modules that are also active
    RETURN QUERY
      SELECT m.slug, m.name, m.icon, m.category
      FROM app_modules m
      INNER JOIN user_module_permissions p ON p.module_id = m.id
      WHERE p.user_id = auth.uid()
      AND m.is_active = true
      ORDER BY m.sort_order;
  ELSE
    -- No restrictions: return all active modules
    RETURN QUERY
      SELECT m.slug, m.name, m.icon, m.category
      FROM app_modules m
      WHERE m.is_active = true
      ORDER BY m.sort_order;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 20260201_business_dev_module.sql
-- ============================================================================
-- Business Development Module Migration
-- ============================================================================
-- Adds deals pipeline, contacts, lead follow-up, and communication tracking.
-- Note: clients table already exists.
-- ============================================================================

-- ========================
-- Deals
-- ========================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  stage TEXT NOT NULL DEFAULT 'lead'
    CHECK (stage IN ('lead', 'discovery', 'estimation', 'proposal', 'won', 'lost')),
  value NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  client_id UUID,
  contact_id UUID,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expected_close_date DATE,
  closed_at TIMESTAMPTZ,
  lost_reason TEXT,
  source TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Deal Activities
-- ========================
CREATE TABLE IF NOT EXISTS deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('note', 'call', 'email', 'meeting', 'stage_change', 'task')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Deal Comments
-- ========================
CREATE TABLE IF NOT EXISTS deal_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Contacts
-- ========================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,
  linkedin_url TEXT,
  client_id UUID,
  source TEXT DEFAULT 'manual',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Lead Follow-Up
-- ========================
CREATE TABLE IF NOT EXISTS lead_followup_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'not_interested', 'converted', 'dormant')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  next_follow_up DATE,
  follow_up_notes TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (contact_id)
);

-- ========================
-- Contact Communications
-- ========================
CREATE TABLE IF NOT EXISTS contact_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'phone', 'linkedin', 'meeting', 'other')),
  direction TEXT DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  content TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Scheduled Emails
-- ========================
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FK for deals.contact_id now that contacts table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deals_contact_id_fkey') THEN
    ALTER TABLE deals ADD CONSTRAINT deals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_client ON deals(client_id);
CREATE INDEX IF NOT EXISTS idx_deals_slug ON deals(slug);
CREATE INDEX IF NOT EXISTS idx_deal_activities_deal ON deal_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_comments_deal ON deal_comments(deal_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_client ON contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_lead_followup_status ON lead_followup_contacts(status);
CREATE INDEX IF NOT EXISTS idx_lead_followup_assigned ON lead_followup_contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contact_comms_contact ON contact_communications(contact_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON scheduled_emails(status);

-- ========================
-- RLS Policies
-- ========================
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view deals" ON deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage deals" ON deals FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view activities" ON deal_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage activities" ON deal_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE deal_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view deal comments" ON deal_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage deal comments" ON deal_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view contacts" ON contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage contacts" ON contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE lead_followup_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view followups" ON lead_followup_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage followups" ON lead_followup_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE contact_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view communications" ON contact_communications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage communications" ON contact_communications FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view emails" ON scheduled_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage emails" ON scheduled_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);


