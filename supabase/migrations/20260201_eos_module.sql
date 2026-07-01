-- ============================================================================
-- EOS Module Migration
-- ============================================================================
-- Creates tables for:
-- - VTO (Vision/Traction Organizer)
-- - OKRs (Objectives & Key Results)
-- - Issues (with pod organization)
-- - Scorecard (metrics tracking)
-- - Accountability (org chart + GWC assessments)
-- ============================================================================

-- ========================
-- EOS Pods (team groupings)
-- ========================
CREATE TABLE IF NOT EXISTS eos_pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  lead_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- VTO (Vision/Traction Organizer)
-- ========================
CREATE TABLE IF NOT EXISTS eos_vto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- OKRs
-- ========================
CREATE TABLE IF NOT EXISTS okrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'at_risk', 'behind', 'on_track', 'completed', 'closed')),
  quarter TEXT NOT NULL, -- e.g. 'Q1 2026'
  start_date DATE,
  end_date DATE,
  progress NUMERIC(5,2) DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  pod_id UUID REFERENCES eos_pods(id) ON DELETE SET NULL,
  parent_okr_id UUID REFERENCES okrs(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS okr_key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL DEFAULT 'number'
    CHECK (metric_type IN ('number', 'percentage', 'currency', 'boolean')),
  current_value NUMERIC DEFAULT 0,
  target_value NUMERIC NOT NULL DEFAULT 100,
  start_value NUMERIC DEFAULT 0,
  unit TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'on_track', 'at_risk', 'behind', 'completed')),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS okr_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  key_result_id UUID REFERENCES okr_key_results(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_value NUMERIC,
  new_value NUMERIC NOT NULL,
  confidence TEXT DEFAULT 'medium'
    CHECK (confidence IN ('low', 'medium', 'high')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Issues
-- ========================
CREATE TABLE IF NOT EXISTS eos_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'solved', 'archived')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category TEXT DEFAULT 'process'
    CHECK (category IN ('people', 'process', 'system', 'external')),
  pod_id UUID REFERENCES eos_pods(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_anonymous BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'meeting', 'project', 'ai')),
  meeting_id UUID,
  solved_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eos_issue_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES eos_issues(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL
    CHECK (suggestion_type IN ('root_cause', 'action_item', 'related_pattern')),
  content TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  ai_model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Scorecard
-- ========================
CREATE TABLE IF NOT EXISTS eos_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  frequency TEXT DEFAULT 'weekly'
    CHECK (frequency IN ('weekly', 'monthly', 'quarterly')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eos_scorecard_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id UUID NOT NULL REFERENCES eos_scorecards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  metric_type TEXT DEFAULT 'number'
    CHECK (metric_type IN ('number', 'percentage', 'currency', 'boolean')),
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  unit TEXT DEFAULT '',
  goal_direction TEXT DEFAULT 'higher_is_better'
    CHECK (goal_direction IN ('higher_is_better', 'lower_is_better', 'target')),
  week_of DATE,
  status TEXT DEFAULT 'on_track'
    CHECK (status IN ('on_track', 'off_track', 'needs_attention')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Accountability
-- ========================
CREATE TABLE IF NOT EXISTS accountability_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_current BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accountability_responsibilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_id UUID NOT NULL REFERENCES accountability_charts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role_title TEXT NOT NULL,
  department TEXT,
  reports_to UUID REFERENCES accountability_responsibilities(id) ON DELETE SET NULL,
  responsibilities JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gwc_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  responsibility_id UUID NOT NULL REFERENCES accountability_responsibilities(id) ON DELETE CASCADE,
  assessor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gets_it BOOLEAN DEFAULT false,
  wants_it BOOLEAN DEFAULT false,
  has_capacity BOOLEAN DEFAULT false,
  notes TEXT,
  assessment_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (responsibility_id, assessor_id, assessment_date)
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_okrs_owner ON okrs(owner_id);
CREATE INDEX IF NOT EXISTS idx_okrs_status ON okrs(status);
CREATE INDEX IF NOT EXISTS idx_okrs_quarter ON okrs(quarter);
CREATE INDEX IF NOT EXISTS idx_okrs_pod ON okrs(pod_id);
CREATE INDEX IF NOT EXISTS idx_okr_key_results_okr ON okr_key_results(okr_id);
CREATE INDEX IF NOT EXISTS idx_okr_check_ins_okr ON okr_check_ins(okr_id);
CREATE INDEX IF NOT EXISTS idx_okr_check_ins_kr ON okr_check_ins(key_result_id);

CREATE INDEX IF NOT EXISTS idx_eos_issues_status ON eos_issues(status);
CREATE INDEX IF NOT EXISTS idx_eos_issues_priority ON eos_issues(priority);
CREATE INDEX IF NOT EXISTS idx_eos_issues_pod ON eos_issues(pod_id);
CREATE INDEX IF NOT EXISTS idx_eos_issues_assigned ON eos_issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_eos_issue_suggestions_issue ON eos_issue_suggestions(issue_id);

CREATE INDEX IF NOT EXISTS idx_scorecard_metrics_scorecard ON eos_scorecard_metrics(scorecard_id);
CREATE INDEX IF NOT EXISTS idx_scorecard_metrics_week ON eos_scorecard_metrics(week_of);

CREATE INDEX IF NOT EXISTS idx_accountability_resp_chart ON accountability_responsibilities(chart_id);
CREATE INDEX IF NOT EXISTS idx_accountability_resp_user ON accountability_responsibilities(user_id);
CREATE INDEX IF NOT EXISTS idx_accountability_resp_reports_to ON accountability_responsibilities(reports_to);
CREATE INDEX IF NOT EXISTS idx_gwc_responsibility ON gwc_assessments(responsibility_id);

-- ========================
-- RLS Policies
-- ========================

-- Pods
ALTER TABLE eos_pods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view pods" ON eos_pods
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage pods" ON eos_pods
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- VTO
ALTER TABLE eos_vto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view VTO" ON eos_vto
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage VTO" ON eos_vto
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OKRs
ALTER TABLE okrs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view OKRs" ON okrs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage OKRs" ON okrs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE okr_key_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view key results" ON okr_key_results
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage key results" ON okr_key_results
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE okr_check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view check-ins" ON okr_check_ins
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create check-ins" ON okr_check_ins
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Issues
ALTER TABLE eos_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view issues" ON eos_issues
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage issues" ON eos_issues
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE eos_issue_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view suggestions" ON eos_issue_suggestions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage suggestions" ON eos_issue_suggestions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Scorecard
ALTER TABLE eos_scorecards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view scorecards" ON eos_scorecards
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage scorecards" ON eos_scorecards
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE eos_scorecard_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view metrics" ON eos_scorecard_metrics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage metrics" ON eos_scorecard_metrics
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Accountability
ALTER TABLE accountability_charts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view charts" ON accountability_charts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage charts" ON accountability_charts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE accountability_responsibilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view responsibilities" ON accountability_responsibilities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage responsibilities" ON accountability_responsibilities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE gwc_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view GWC assessments" ON gwc_assessments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their own assessments" ON gwc_assessments
  FOR ALL TO authenticated USING (auth.uid() = assessor_id) WITH CHECK (auth.uid() = assessor_id);

-- ========================
-- Seed VTO sections
-- ========================
INSERT INTO eos_vto (section, title, content, sort_order) VALUES
  ('core_values', 'Core Values', '{"values": []}', 1),
  ('core_focus', 'Core Focus', '{"purpose": "", "niche": ""}', 2),
  ('ten_year_target', '10-Year Target', '{"target": ""}', 3),
  ('marketing_strategy', 'Marketing Strategy', '{"target_market": "", "uniques": [], "proven_process": "", "guarantee": ""}', 4),
  ('three_year_picture', '3-Year Picture', '{"revenue": "", "profit": "", "measurables": []}', 5),
  ('one_year_plan', '1-Year Plan', '{"revenue": "", "profit": "", "goals": []}', 6),
  ('quarterly_rocks', 'Quarterly Rocks', '{"quarter": "", "rocks": []}', 7),
  ('issues_list', 'Issues List', '{"issues": []}', 8)
ON CONFLICT (section) DO NOTHING;
