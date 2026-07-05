-- 20260201_meetings_v2.sql
-- ============================================================================
-- Meetings Module V2 Migration
-- ============================================================================
-- Extends existing meetings table and adds:
-- - meeting_series (recurring meeting definitions)
-- - meeting_agenda_items (structured agendas)
-- - meeting_takeaways (decisions, action items, notes)
-- - meeting_participants (attendee management)
-- - meeting_transcripts (transcript storage)
-- - meeting_categorizations (auto/manual categorization)
-- - meeting_assignments (link meetings to clients/projects)
-- ============================================================================

-- ========================
-- Extend existing meetings table
-- ========================
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS series_id UUID,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS agenda_finalized BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS action_items JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS efficiency_score NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- ========================
-- Meeting Series
-- ========================
CREATE TABLE IF NOT EXISTS meeting_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  recurrence_rule TEXT NOT NULL, -- iCal RRULE format (e.g. 'FREQ=WEEKLY;BYDAY=MO')
  duration_minutes INTEGER DEFAULT 60,
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_agenda JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  next_occurrence TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add FK for series_id after table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'meetings_series_id_fkey'
  ) THEN
    ALTER TABLE meetings
      ADD CONSTRAINT meetings_series_id_fkey
      FOREIGN KEY (series_id) REFERENCES meeting_series(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ========================
-- Agenda Items
-- ========================
CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  presenter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Takeaways
-- ========================
CREATE TABLE IF NOT EXISTS meeting_takeaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agenda_item_id UUID REFERENCES meeting_agenda_items(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  takeaway_type TEXT NOT NULL DEFAULT 'note'
    CHECK (takeaway_type IN ('decision', 'action_item', 'note', 'follow_up')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  is_completed BOOLEAN DEFAULT false,
  task_id UUID, -- Link to tasks table if converted
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Participants
-- ========================
CREATE TABLE IF NOT EXISTS meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  name TEXT,
  role TEXT DEFAULT 'attendee'
    CHECK (role IN ('organizer', 'presenter', 'attendee', 'optional')),
  rsvp_status TEXT DEFAULT 'pending'
    CHECK (rsvp_status IN ('pending', 'accepted', 'declined', 'tentative')),
  attended BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (meeting_id, user_id)
);

-- ========================
-- Transcripts
-- ========================
CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('zoom', 'teams', 'google_meet', 'manual', 'upload')),
  word_count INTEGER,
  duration_seconds INTEGER,
  speakers JSONB DEFAULT '[]', -- [{name, segments}]
  processed_at TIMESTAMPTZ,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Categorizations
-- ========================
CREATE TABLE IF NOT EXISTS meeting_categorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 1.0,
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai', 'rule')),
  rule_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (meeting_id, category)
);

-- ========================
-- Assignments (link to clients/projects)
-- ========================
CREATE TABLE IF NOT EXISTS meeting_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'project', 'deal')),
  entity_id UUID NOT NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (meeting_id, entity_type, entity_id)
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_meetings_series ON meetings(series_id);
CREATE INDEX IF NOT EXISTS idx_meetings_slug ON meetings(slug);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_meeting_series_organizer ON meeting_series(organizer_id);
CREATE INDEX IF NOT EXISTS idx_meeting_series_active ON meeting_series(is_active);

CREATE INDEX IF NOT EXISTS idx_agenda_items_meeting ON meeting_agenda_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_agenda_items_order ON meeting_agenda_items(meeting_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_takeaways_meeting ON meeting_takeaways(meeting_id);
CREATE INDEX IF NOT EXISTS idx_takeaways_assigned ON meeting_takeaways(assigned_to);
CREATE INDEX IF NOT EXISTS idx_takeaways_type ON meeting_takeaways(takeaway_type);

CREATE INDEX IF NOT EXISTS idx_participants_meeting ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON meeting_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_transcripts_meeting ON meeting_transcripts(meeting_id);

CREATE INDEX IF NOT EXISTS idx_categorizations_meeting ON meeting_categorizations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_categorizations_category ON meeting_categorizations(category);

CREATE INDEX IF NOT EXISTS idx_assignments_meeting ON meeting_assignments(meeting_id);
CREATE INDEX IF NOT EXISTS idx_assignments_entity ON meeting_assignments(entity_type, entity_id);

-- ========================
-- RLS Policies
-- ========================

-- Meeting Series
ALTER TABLE meeting_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view series" ON meeting_series
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their own series" ON meeting_series
  FOR ALL TO authenticated USING (auth.uid() = organizer_id) WITH CHECK (auth.uid() = organizer_id);

-- Agenda Items
ALTER TABLE meeting_agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view agenda items" ON meeting_agenda_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage agenda items" ON meeting_agenda_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Takeaways
ALTER TABLE meeting_takeaways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view takeaways" ON meeting_takeaways
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage takeaways" ON meeting_takeaways
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Participants
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view participants" ON meeting_participants
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage participants" ON meeting_participants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Transcripts
ALTER TABLE meeting_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view transcripts" ON meeting_transcripts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage transcripts" ON meeting_transcripts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Categorizations
ALTER TABLE meeting_categorizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view categorizations" ON meeting_categorizations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage categorizations" ON meeting_categorizations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Assignments
ALTER TABLE meeting_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view assignments" ON meeting_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage assignments" ON meeting_assignments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 20260201_productivity_module.sql
-- ============================================================================
-- Productivity Module Migration
-- ============================================================================
-- Creates tables for productivity tracking, employee profiles, departments,
-- pods, leave events, process documentation, alerts, and AI insights.
-- ============================================================================

-- ========================
-- Departments
-- ========================
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Pods (Teams)
-- ========================
CREATE TABLE IF NOT EXISTS pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  description TEXT,
  lead_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Pod Members
-- ========================
CREATE TABLE IF NOT EXISTS pod_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('lead', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pod_id, user_id)
);

-- ========================
-- Employee Profiles
-- ========================
CREATE TABLE IF NOT EXISTS employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  title TEXT,
  manager_email TEXT,
  hire_date DATE,
  location TEXT,
  employment_type TEXT DEFAULT 'full-time'
    CHECK (employment_type IN ('full-time', 'part-time', 'contractor', 'intern')),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Productivity Records (weekly)
-- ========================
CREATE TABLE IF NOT EXISTS productivity_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT NOT NULL,
  week_start DATE NOT NULL,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  total_hours NUMERIC(5,2) DEFAULT 0,
  billable_hours NUMERIC(5,2) DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  tasks_assigned INTEGER DEFAULT 0,
  meetings_attended INTEGER DEFAULT 0,
  utilization_pct NUMERIC(5,2) DEFAULT 0,
  efficiency_score NUMERIC(5,2) DEFAULT 0,
  attendance_status TEXT DEFAULT 'present'
    CHECK (attendance_status IN ('present', 'partial', 'absent', 'leave')),
  department TEXT,
  location TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (employee_email, week_start)
);

-- ========================
-- Leave Events
-- ========================
CREATE TABLE IF NOT EXISTS leave_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('pto', 'sick', 'personal', 'holiday', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_half_day BOOLEAN DEFAULT false,
  notes TEXT,
  approved_by TEXT,
  status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Process Categories
-- ========================
CREATE TABLE IF NOT EXISTS process_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Process Documents
-- ========================
CREATE TABLE IF NOT EXISTS process_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES process_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (category_id, slug)
);

-- ========================
-- Productivity Alerts
-- ========================
CREATE TABLE IF NOT EXISTS productivity_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_utilization', 'declining_trend', 'high_performer', 'absence_pattern', 'workload_imbalance')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  week_start DATE,
  is_read BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- AI Productivity Insights
-- ========================
CREATE TABLE IF NOT EXISTS ai_productivity_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT,
  department TEXT,
  pod_id UUID REFERENCES pods(id) ON DELETE SET NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('individual', 'department', 'pod', 'company')),
  week_start DATE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  recommendations TEXT[],
  confidence_score NUMERIC(3,2),
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Seed Process Categories
-- ========================
INSERT INTO process_categories (name, slug, description, icon, sort_order) VALUES
  ('Business Development', 'business-dev', 'Sales and client acquisition processes', 'Briefcase', 1),
  ('Human Resources', 'hr', 'HR policies and procedures', 'Users', 2),
  ('Quality Assurance', 'qa', 'Testing and quality standards', 'ShieldCheck', 3),
  ('Engineering', 'engineering', 'Development workflows and standards', 'Code', 4),
  ('Operations', 'operations', 'Operational procedures', 'Settings', 5),
  ('Onboarding', 'onboarding', 'New hire onboarding processes', 'UserPlus', 6)
ON CONFLICT (slug) DO NOTHING;

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_employee_profiles_user ON employee_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_dept ON employee_profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_email ON employee_profiles(email);
CREATE INDEX IF NOT EXISTS idx_productivity_records_email ON productivity_records(employee_email);
CREATE INDEX IF NOT EXISTS idx_productivity_records_week ON productivity_records(week_start);
CREATE INDEX IF NOT EXISTS idx_productivity_records_dept ON productivity_records(department);
CREATE INDEX IF NOT EXISTS idx_pods_department ON pods(department_id);
CREATE INDEX IF NOT EXISTS idx_pod_members_pod ON pod_members(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_members_user ON pod_members(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_events_email ON leave_events(employee_email);
CREATE INDEX IF NOT EXISTS idx_process_docs_category ON process_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_process_docs_status ON process_documents(status);
CREATE INDEX IF NOT EXISTS idx_productivity_alerts_email ON productivity_alerts(employee_email);
CREATE INDEX IF NOT EXISTS idx_ai_insights_employee ON ai_productivity_insights(employee_email);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_productivity_insights(insight_type);

-- ========================
-- RLS Policies
-- ========================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view departments" ON departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage departments" ON departments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE pods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view pods" ON pods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage pods" ON pods FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE pod_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view pod members" ON pod_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage pod members" ON pod_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view employees" ON employee_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage employees" ON employee_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE productivity_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view productivity" ON productivity_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage productivity" ON productivity_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE leave_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view leave" ON leave_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage leave" ON leave_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE process_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view categories" ON process_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage categories" ON process_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE process_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view documents" ON process_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage documents" ON process_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE productivity_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view alerts" ON productivity_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage alerts" ON productivity_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE ai_productivity_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view insights" ON ai_productivity_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage insights" ON ai_productivity_insights FOR ALL TO authenticated USING (true) WITH CHECK (true);


