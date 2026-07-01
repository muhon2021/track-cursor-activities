-- ============================================================================
-- Project Client Access - Client portal authentication and related tables
-- ============================================================================
-- Aligned with sj-control-main. Enables token+password client portal access.
-- ============================================================================

-- ========================
-- project_client_access
-- ========================
CREATE TABLE IF NOT EXISTS public.project_client_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  client_email TEXT NOT NULL,
  client_name TEXT,
  password_hash TEXT NOT NULL,
  access_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  project_slug TEXT,
  login_count INTEGER DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(project_id, client_email)
);

-- ========================
-- project_milestones: pm_notes for client-visible notes
-- ========================
ALTER TABLE public.project_milestones
ADD COLUMN IF NOT EXISTS pm_notes TEXT;

-- ========================
-- project_client_comments (PM comments on sprints/milestones)
-- ========================
CREATE TABLE IF NOT EXISTS public.project_client_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  milestone_id UUID REFERENCES public.project_milestones(id) ON DELETE CASCADE,
  sprint_name TEXT,
  comment_text TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- client_feedback (client-submitted feedback)
-- ========================
CREATE TABLE IF NOT EXISTS public.client_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  client_access_id UUID REFERENCES public.project_client_access(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT NOT NULL,
  week_number INTEGER,
  year INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- project_risks: is_client_visible
-- ========================
ALTER TABLE public.project_risks
ADD COLUMN IF NOT EXISTS is_client_visible BOOLEAN DEFAULT false;

-- ========================
-- RLS
-- ========================
ALTER TABLE public.project_client_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_client_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view client access"
  ON public.project_client_access FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert client access"
  ON public.project_client_access FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update client access"
  ON public.project_client_access FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage client comments"
  ON public.project_client_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can insert feedback"
  ON public.client_feedback FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view feedback"
  ON public.client_feedback FOR SELECT TO authenticated USING (true);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_project_client_access_token ON public.project_client_access(access_token);
CREATE INDEX IF NOT EXISTS idx_project_client_access_project ON public.project_client_access(project_id);
CREATE INDEX IF NOT EXISTS idx_project_client_comments_project ON public.project_client_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_client_feedback_project ON public.client_feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_project_risks_client_visible ON public.project_risks(project_id) WHERE is_client_visible = true;

-- ========================
-- Triggers (updated_at)
-- ========================
CREATE TRIGGER update_project_client_access_updated_at
  BEFORE UPDATE ON public.project_client_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_client_comments_updated_at
  BEFORE UPDATE ON public.project_client_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Unique constraint on projects for sync upserts (external_provider + external_id)
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_external_provider_id
  ON public.projects(external_provider, external_id)
  WHERE external_provider IS NOT NULL AND external_id IS NOT NULL;
