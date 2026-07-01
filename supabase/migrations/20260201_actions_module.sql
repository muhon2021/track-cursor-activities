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
