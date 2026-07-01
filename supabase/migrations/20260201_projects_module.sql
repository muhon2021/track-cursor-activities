-- ============================================================================
-- Projects Module Migration
-- ============================================================================
-- Creates tables for: projects, statuses, members, milestones, comments,
-- files, risks, checklists, billing, and resource projections.
-- ============================================================================

-- ========================
-- Project Statuses (configurable)
-- ========================
CREATE TABLE IF NOT EXISTS project_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Projects
-- ========================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  status_id UUID REFERENCES project_statuses(id) ON DELETE SET NULL,
  client_id UUID,
  source_deal_id UUID,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  budget NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  is_archived BOOLEAN DEFAULT false,
  external_id TEXT,
  external_provider TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Members
-- ========================
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'manager', 'member', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, user_id)
);

-- ========================
-- Project Milestones
-- ========================
CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Comments
-- ========================
CREATE TABLE IF NOT EXISTS project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES project_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Files
-- ========================
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  source TEXT DEFAULT 'upload' CHECK (source IN ('upload', 'google_drive', 'activecollab')),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Risks
-- ========================
CREATE TABLE IF NOT EXISTS project_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'mitigated', 'resolved', 'accepted')),
  mitigation TEXT,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Favorites
-- ========================
CREATE TABLE IF NOT EXISTS project_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, user_id)
);

-- ========================
-- Project Billing
-- ========================
CREATE TABLE IF NOT EXISTS project_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  billing_type TEXT DEFAULT 'fixed' CHECK (billing_type IN ('fixed', 'hourly', 'monthly', 'per_task')),
  rate NUMERIC(10,2),
  total_budget NUMERIC(12,2),
  invoiced_amount NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  payment_terms TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Project Invoices
-- ========================
CREATE TABLE IF NOT EXISTS project_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_project ON project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_risks_project ON project_risks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invoices_project ON project_invoices(project_id);

-- ========================
-- RLS Policies
-- ========================
ALTER TABLE project_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view statuses" ON project_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage statuses" ON project_statuses FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view projects" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage projects" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view members" ON project_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage members" ON project_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view milestones" ON project_milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage milestones" ON project_milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view comments" ON project_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage comments" ON project_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view files" ON project_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage files" ON project_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view risks" ON project_risks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage risks" ON project_risks FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own favorites" ON project_favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own favorites" ON project_favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE project_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view billing" ON project_billing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage billing" ON project_billing FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE project_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view invoices" ON project_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage invoices" ON project_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========================
-- Seed default statuses
-- ========================
INSERT INTO project_statuses (name, slug, color, sort_order, is_default) VALUES
  ('Planning', 'planning', '#6366f1', 1, true),
  ('In Progress', 'in-progress', '#f59e0b', 2, false),
  ('On Hold', 'on-hold', '#ef4444', 3, false),
  ('Completed', 'completed', '#22c55e', 4, false),
  ('Archived', 'archived', '#6b7280', 5, false)
ON CONFLICT (slug) DO NOTHING;
