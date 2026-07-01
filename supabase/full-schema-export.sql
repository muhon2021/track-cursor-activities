-- ============================================================
-- SJ Control Tower — Complete Database Schema Export
-- Generated: 2026-02-27
-- 
-- This migration recreates the full database structure from scratch.
-- Execute in a fresh Supabase project via SQL Editor.
-- 
-- Tables: 140+  |  Views: 8  |  Functions: 30+  |  Indexes: 200+
-- ============================================================

-- ============================================================
-- 0. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ============================================================
-- 1. ENUM TYPES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. HELPER FUNCTIONS (needed before tables for triggers/defaults)
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. TABLES
-- ============================================================

-- === Auth & Profiles ===

CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID
);

CREATE TABLE public.roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE public.user_role_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  agency_role TEXT,
  is_eos_user BOOLEAN NOT NULL DEFAULT false,
  dashboard_layout JSONB DEFAULT '{}'::jsonb,
  primary_pod_id UUID,
  ai_digest_enabled BOOLEAN NOT NULL DEFAULT true,
  ai_digest_frequency TEXT NOT NULL DEFAULT 'weekly'::text,
  hide_completed_tasks BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE public.user_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user'::text,
  invited_by UUID,
  token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + '7 days'::interval),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === App Config ===

CREATE TABLE public.app_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  category TEXT NOT NULL DEFAULT 'general'::text,
  description TEXT,
  is_sensitive BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.app_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'Layout'::text,
  category TEXT DEFAULT 'business'::text,
  is_core BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  dependencies TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  page_route TEXT
);

CREATE TABLE public.user_module_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_id UUID NOT NULL,
  granted_by UUID,
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id)
);

CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category, key)
);

CREATE TABLE public.dashboard_widgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  widget_slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  component_name TEXT NOT NULL,
  agency_roles TEXT[] NOT NULL DEFAULT '{}'::text[],
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === Activity & Notifications ===

CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info'::text,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  rating INTEGER,
  status TEXT DEFAULT 'pending'::text,
  admin_notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  module TEXT
);

-- === CRM: Clients & Contacts ===

CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  phone TEXT,
  status TEXT DEFAULT 'active'::text,
  created_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_source TEXT DEFAULT 'manual'::text,
  external_id TEXT,
  external_url TEXT,
  last_synced_at TIMESTAMPTZ
);

CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,
  linkedin_url TEXT,
  client_id UUID,
  source TEXT DEFAULT 'manual'::text,
  tags TEXT[] DEFAULT '{}'::text[],
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_lead_follow_up BOOLEAN DEFAULT false,
  followup_status TEXT DEFAULT 'pending'::text,
  followup_interval_days INTEGER DEFAULT 7,
  last_contact_date TIMESTAMPTZ,
  next_followup_date TIMESTAMPTZ,
  followup_notes TEXT,
  followup_assigned_to UUID,
  followup_attempt_count INTEGER DEFAULT 0,
  preferred_contact_channel TEXT DEFAULT 'email'::text,
  is_upwork_lead BOOLEAN DEFAULT false,
  current_mood_label TEXT,
  current_mood_score INTEGER,
  current_intent_status TEXT,
  last_mood_analysis_at TIMESTAMPTZ,
  last_intent_analysis_at TIMESTAMPTZ,
  department TEXT,
  website TEXT,
  hubspot_id TEXT,
  lead_score INTEGER DEFAULT 0,
  lead_temperature TEXT DEFAULT 'cold'::text,
  engagement_score INTEGER DEFAULT 0,
  profile_score INTEGER DEFAULT 0,
  deal_potential_score INTEGER DEFAULT 0,
  recency_score INTEGER DEFAULT 0,
  last_score_calculated_at TIMESTAMPTZ,
  data_source TEXT DEFAULT 'manual'::text,
  external_id TEXT,
  external_url TEXT,
  last_synced_at TIMESTAMPTZ
);

CREATE TABLE public.contact_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  subject TEXT,
  description TEXT,
  channel TEXT NOT NULL,
  direction TEXT NOT NULL,
  email_to TEXT[] DEFAULT '{}'::text[],
  email_cc TEXT[] DEFAULT '{}'::text[],
  email_bcc TEXT[] DEFAULT '{}'::text[],
  email_body TEXT,
  email_sent_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.contact_ai_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL UNIQUE,
  summary_text TEXT,
  talking_points JSONB DEFAULT '[]'::jsonb,
  recommended_approach TEXT,
  data_snapshot JSONB DEFAULT '{}'::jsonb,
  engagement_level TEXT,
  lead_score INTEGER,
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + '24:00:00'::interval),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.contact_communications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  channel TEXT NOT NULL,
  direction TEXT DEFAULT 'outbound'::text,
  subject TEXT,
  content TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.contact_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'custom'::text,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  variables JSONB DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.contact_meeting_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  meeting_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.common_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[] DEFAULT '{}'::text[],
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- === Deals ===

CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  stage TEXT NOT NULL DEFAULT 'lead'::text,
  value NUMERIC,
  currency TEXT DEFAULT 'USD'::text,
  probability INTEGER DEFAULT 0,
  client_id UUID,
  contact_id UUID,
  owner_id UUID,
  expected_close_date DATE,
  closed_at TIMESTAMPTZ,
  lost_reason TEXT,
  source TEXT,
  tags TEXT[] DEFAULT '{}'::text[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  data_source TEXT DEFAULT 'manual'::text,
  external_id TEXT,
  external_url TEXT,
  last_synced_at TIMESTAMPTZ
);

CREATE TABLE public.deal_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL,
  user_id UUID,
  activity_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.deal_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- === Lead Follow-up ===

CREATE TABLE public.lead_followup_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  status TEXT DEFAULT 'new'::text,
  priority TEXT DEFAULT 'medium'::text,
  next_follow_up DATE,
  follow_up_notes TEXT,
  assigned_to UUID,
  converted_deal_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.lead_intent_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  lead_id UUID,
  intent_status TEXT NOT NULL,
  momentum_score INTEGER NOT NULL,
  confidence TEXT DEFAULT 'medium'::text,
  momentum_signals JSONB DEFAULT '[]'::jsonb,
  decay_signals JSONB DEFAULT '[]'::jsonb,
  days_since_activity INTEGER,
  reasoning TEXT,
  suggested_action TEXT DEFAULT 'hold_for_now'::text,
  analyzed_at TIMESTAMPTZ DEFAULT now(),
  agent_run_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.lead_mood_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  lead_id UUID,
  mood_score INTEGER NOT NULL,
  mood_label TEXT NOT NULL,
  confidence TEXT DEFAULT 'medium'::text,
  key_signals JSONB DEFAULT '[]'::jsonb,
  reasoning TEXT,
  suggested_action TEXT DEFAULT 'hold_for_now'::text,
  analyzed_at TIMESTAMPTZ DEFAULT now(),
  agent_run_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === Organizations & Pods ===

CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  manager_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.pods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  department_id UUID,
  description TEXT,
  lead_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  color TEXT DEFAULT '#3b82f6'::text,
  show_in_resource_projection BOOLEAN DEFAULT true,
  created_by UUID
);

CREATE TABLE public.pod_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pod_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member'::text,
  joined_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.pod_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pod_id UUID NOT NULL,
  module_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.pod_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pod_id UUID NOT NULL,
  user_id UUID,
  employee_id UUID,
  has_login BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual'::text,
  is_active BOOLEAN DEFAULT true,
  role TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pod_id, employee_id)
);

CREATE TABLE public.employee_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  department_id UUID,
  title TEXT,
  manager_email TEXT,
  hire_date DATE,
  location TEXT,
  employment_type TEXT DEFAULT 'full-time'::text,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.employee_pods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  pod_id UUID NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  synced_from_hr BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, pod_id)
);

CREATE TABLE public.skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.employee_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  skill_id UUID NOT NULL,
  proficiency_level TEXT DEFAULT 'intermediate'::text,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === EOS ===

CREATE TABLE public.eos_pods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1'::text,
  lead_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.eos_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open'::text,
  priority TEXT NOT NULL DEFAULT 'medium'::text,
  category TEXT DEFAULT 'process'::text,
  pod_id UUID,
  assigned_to UUID,
  reported_by UUID,
  is_anonymous BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual'::text,
  meeting_id UUID,
  solved_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.eos_issue_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL,
  suggestion_type TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence NUMERIC DEFAULT 0.5,
  status TEXT DEFAULT 'pending'::text,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  ai_model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.eos_scorecards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID,
  frequency TEXT DEFAULT 'weekly'::text,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.eos_scorecard_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scorecard_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  metric_type TEXT DEFAULT 'number'::text,
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  unit TEXT DEFAULT ''::text,
  goal_direction TEXT DEFAULT 'higher_is_better'::text,
  week_of DATE,
  status TEXT DEFAULT 'on_track'::text,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.eos_vto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER DEFAULT 0,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.accountability_charts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_current BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  published_at TIMESTAMPTZ,
  published_by UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.accountability_responsibilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chart_id UUID NOT NULL,
  user_id UUID,
  role_title TEXT NOT NULL,
  department TEXT,
  reports_to UUID,
  responsibilities JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.gwc_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  responsibility_id UUID NOT NULL,
  assessor_id UUID NOT NULL,
  gets_it BOOLEAN DEFAULT false,
  wants_it BOOLEAN DEFAULT false,
  has_capacity BOOLEAN DEFAULT false,
  notes TEXT,
  assessment_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === OKRs ===

CREATE TABLE public.okrs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID,
  status TEXT NOT NULL DEFAULT 'draft'::text,
  quarter TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  progress NUMERIC DEFAULT 0,
  pod_id UUID,
  parent_okr_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  okr_type TEXT DEFAULT 'personal'::text,
  year INTEGER,
  is_archived BOOLEAN DEFAULT false,
  updated_by UUID
);

CREATE TABLE public.okr_key_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  okr_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL DEFAULT 'number'::text,
  current_value NUMERIC DEFAULT 0,
  target_value NUMERIC NOT NULL DEFAULT 100,
  start_value NUMERIC DEFAULT 0,
  unit TEXT DEFAULT ''::text,
  status TEXT NOT NULL DEFAULT 'not_started'::text,
  owner_id UUID,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  update_frequency TEXT DEFAULT 'weekly'::text,
  last_updated_at TIMESTAMPTZ,
  next_update_due TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ
);

CREATE TABLE public.okr_check_ins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  okr_id UUID NOT NULL,
  key_result_id UUID,
  user_id UUID NOT NULL,
  previous_value NUMERIC,
  new_value NUMERIC NOT NULL,
  confidence TEXT DEFAULT 'medium'::text,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.key_result_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_result_id UUID NOT NULL,
  previous_value NUMERIC,
  new_value NUMERIC NOT NULL,
  notes TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- === Meetings ===

CREATE TABLE public.meeting_series (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  recurrence_rule TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  organizer_id UUID NOT NULL,
  default_agenda JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  next_occurrence TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  client_id UUID,
  organizer_id UUID NOT NULL,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  status TEXT DEFAULT 'scheduled'::text,
  location TEXT,
  meeting_type TEXT DEFAULT 'virtual'::text,
  zoom_id TEXT,
  zoom_meeting_id TEXT,
  zoom_uuid TEXT,
  zoom_join_url TEXT,
  zoom_start_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider TEXT DEFAULT 'zoom'::text,
  external_id TEXT,
  external_meeting_id TEXT,
  external_uuid TEXT,
  join_url TEXT,
  host_url TEXT,
  series_id UUID,
  slug TEXT,
  is_recurring BOOLEAN DEFAULT false,
  agenda_finalized BOOLEAN DEFAULT false,
  summary TEXT,
  action_items JSONB DEFAULT '[]'::jsonb,
  efficiency_score NUMERIC,
  closed_at TIMESTAMPTZ,
  deal_id UUID,
  pod_id UUID,
  recording_url TEXT,
  transcript_content TEXT,
  transcript_text TEXT,
  embedding_status TEXT DEFAULT 'pending'::text,
  is_external BOOLEAN DEFAULT false,
  notes TEXT,
  timezone TEXT DEFAULT 'UTC'::text,
  recurrence_pattern TEXT DEFAULT 'none'::text,
  recurrence_end_date TIMESTAMPTZ,
  parent_meeting_id UUID,
  categorization_data JSONB,
  ai_summary TEXT,
  notify_participants BOOLEAN DEFAULT false,
  ai_summary_status TEXT NOT NULL DEFAULT 'pending'::text,
  ai_summary_generated_at TIMESTAMPTZ,
  action_items_extracted_at TIMESTAMPTZ
);

CREATE TABLE public.meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  user_id UUID,
  email TEXT,
  name TEXT,
  role TEXT DEFAULT 'attendee'::text,
  rsvp_status TEXT DEFAULT 'pending'::text,
  attended BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  response_at TIMESTAMPTZ
);

CREATE TABLE public.meeting_external_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  external_email TEXT NOT NULL,
  external_name TEXT,
  role TEXT NOT NULL DEFAULT 'optional'::text,
  status TEXT DEFAULT 'pending'::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.meeting_agenda_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  presenter_id UUID,
  sort_order INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  assigned_to UUID
);

CREATE TABLE public.meeting_takeaways (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  agenda_item_id UUID,
  content TEXT NOT NULL,
  takeaway_type TEXT NOT NULL DEFAULT 'note'::text,
  assigned_to UUID,
  due_date DATE,
  is_completed BOOLEAN DEFAULT false,
  task_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  priority TEXT DEFAULT 'medium'::text,
  status TEXT DEFAULT 'open'::text
);

CREATE TABLE public.meeting_transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  speaker TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.meeting_action_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  text TEXT NOT NULL,
  assignee_id UUID,
  assignee_email TEXT,
  due_date DATE,
  priority TEXT DEFAULT 'medium'::text,
  task_id UUID,
  status TEXT DEFAULT 'pending'::text,
  extracted_from_transcript BOOLEAN DEFAULT false,
  extraction_confidence NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.meeting_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  assigned_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.meeting_assignment_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  suggested_type TEXT NOT NULL,
  suggested_id UUID NOT NULL,
  confidence NUMERIC,
  reasoning TEXT,
  review_status TEXT DEFAULT 'pending'::text,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.meeting_categorizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  category TEXT NOT NULL,
  confidence NUMERIC DEFAULT 1.0,
  source TEXT DEFAULT 'manual'::text,
  rule_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  meeting_type TEXT,
  related_clients JSONB,
  related_projects JSONB,
  related_pods JSONB,
  tags JSONB
);

CREATE TABLE public.meeting_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID,
  provider TEXT NOT NULL DEFAULT 'zoom'::text,
  external_meeting_id TEXT,
  file_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_path TEXT,
  storage_path TEXT,
  download_url TEXT,
  transcript_text TEXT,
  transcript_content JSONB,
  is_processed BOOLEAN DEFAULT false,
  has_embeddings BOOLEAN DEFAULT false,
  processing_status TEXT DEFAULT 'pending'::text,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assignment_status TEXT DEFAULT 'unreviewed'::text,
  assignment_confidence NUMERIC,
  suggested_client_id UUID,
  suggested_project_id UUID,
  suggested_pod_id UUID,
  assignment_reasoning TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE public.client_meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  meeting_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.zoom_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  file_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_path TEXT,
  storage_path TEXT,
  download_url TEXT,
  transcript_text TEXT,
  transcript_content JSONB,
  is_processed BOOLEAN DEFAULT false,
  has_embeddings BOOLEAN DEFAULT false,
  processing_status TEXT DEFAULT 'pending'::text,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === Projects ===

CREATE TABLE public.project_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1'::text,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status_id UUID,
  client_id UUID,
  source_deal_id UUID,
  owner_id UUID,
  start_date DATE,
  end_date DATE,
  budget NUMERIC,
  currency TEXT DEFAULT 'USD'::text,
  is_archived BOOLEAN DEFAULT false,
  external_id TEXT,
  external_provider TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_at_risk BOOLEAN NOT NULL DEFAULT false,
  risk_flags TEXT[] NOT NULL DEFAULT '{}'::text[],
  owner_notified_at TIMESTAMPTZ,
  expected_completion_date DATE
);

CREATE TABLE public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member'::text,
  joined_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.project_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT DEFAULT 'pending'::text,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  pm_notes TEXT
);

CREATE TABLE public.project_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.project_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  source TEXT DEFAULT 'upload'::text,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.project_risks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'medium'::text,
  status TEXT DEFAULT 'open'::text,
  mitigation TEXT,
  reported_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_client_visible BOOLEAN DEFAULT false
);

CREATE TABLE public.project_billing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  billing_type TEXT DEFAULT 'fixed'::text,
  rate NUMERIC,
  total_budget NUMERIC,
  invoiced_amount NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD'::text,
  payment_terms TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.project_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'draft'::text,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.project_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE TABLE public.project_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  backup_type TEXT DEFAULT 'manual'::text,
  status TEXT DEFAULT 'completed'::text,
  notes TEXT,
  snapshot JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.project_client_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  client_email TEXT NOT NULL,
  client_name TEXT,
  password_hash TEXT NOT NULL,
  access_token UUID NOT NULL DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  project_slug TEXT,
  login_count INTEGER DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  created_by UUID
);

CREATE TABLE public.project_client_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  milestone_id UUID,
  sprint_name TEXT,
  comment_text TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.client_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  client_access_id UUID,
  rating INTEGER,
  feedback_text TEXT NOT NULL,
  week_number INTEGER,
  year INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.project_at_risk_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  flag_type TEXT NOT NULL,
  description TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === Tasks ===

CREATE TABLE public.task_streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  color TEXT DEFAULT '#6366f1'::text,
  is_archived BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.task_stream_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member'::text,
  joined_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.task_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  color TEXT DEFAULT '#8b5cf6'::text,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo'::text,
  priority TEXT NOT NULL DEFAULT 'medium'::text,
  due_date TIMESTAMPTZ,
  assigned_to UUID,
  created_by UUID NOT NULL,
  client_id UUID,
  meeting_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stream_id UUID,
  parent_id UUID,
  category_id UUID,
  completed_at TIMESTAMPTZ,
  slug TEXT,
  position INTEGER DEFAULT 0
);

CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  parent_comment_id UUID,
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.task_contributors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'contributor'::text,
  added_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === Knowledge Base ===

CREATE TABLE public.knowledge_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  parent_id UUID,
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner_id UUID
);

CREATE TABLE public.knowledge_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  category_id UUID,
  author_id UUID NOT NULL,
  status TEXT DEFAULT 'draft'::text,
  tags TEXT[] DEFAULT '{}'::text[],
  search_vector TSVECTOR,
  view_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.knowledge_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.knowledge_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID,
  source_id UUID,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  processing_status TEXT DEFAULT 'pending'::text,
  processing_error TEXT,
  chunk_count INTEGER DEFAULT 0,
  embedding_model TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  uploaded_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.knowledge_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID,
  entry_id UUID,
  content TEXT NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  token_count INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.user_knowledge_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  processing_status TEXT DEFAULT 'pending'::text,
  chunk_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.unified_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id UUID NOT NULL,
  source_id UUID,
  title TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  storage_path TEXT,
  drive_file_id TEXT,
  processing_status TEXT DEFAULT 'pending'::text,
  processing_error TEXT,
  chunk_count INTEGER DEFAULT 0,
  embedding_model TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- === Embeddings & Vector Search ===

CREATE TABLE public.embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  embedding extensions.vector(1536),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID,
  chunk_index INTEGER DEFAULT 0,
  gemini_corpus_id TEXT,
  gemini_document_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider_corpus_id TEXT,
  provider_document_id TEXT,
  unified_document_id UUID
);

CREATE TABLE public.embedding_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending'::text,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.vector_search_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  query TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  top_score NUMERIC,
  search_type TEXT DEFAULT 'semantic'::text,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === AI Agents ===

CREATE TABLE public.ai_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  base_url TEXT,
  api_key_secret_name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL,
  name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  category TEXT NOT NULL,
  context_window INTEGER NOT NULL DEFAULT 128000,
  input_cost_per_1k NUMERIC NOT NULL DEFAULT 0,
  output_cost_per_1k NUMERIC NOT NULL DEFAULT 0,
  embedding_cost_per_1k NUMERIC NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  category TEXT,
  system_prompt TEXT NOT NULL,
  data_sources JSONB DEFAULT '[]'::jsonb,
  provider_config JSONB DEFAULT '{}'::jsonb,
  required_role public.app_role,
  is_enabled BOOLEAN DEFAULT true,
  memory_enabled BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  avatar TEXT,
  welcome_message TEXT,
  conversation_starters JSONB,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.ai_agent_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(100) DEFAULT 'folder'::character varying,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.ai_agent_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'pending'::text,
  context JSONB DEFAULT '{}'::jsonb,
  input TEXT,
  output TEXT,
  token_metrics JSONB DEFAULT '{}'::jsonb,
  latency_ms INTEGER,
  provider_used TEXT,
  model_used TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_chat_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  agent_id UUID,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  model_id UUID,
  function_name TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  embedding_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_productivity_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_email TEXT,
  department TEXT,
  pod_id UUID,
  insight_type TEXT NOT NULL,
  week_start DATE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  recommendations TEXT[],
  confidence_score NUMERIC,
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.ai_digest_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  digest_type TEXT NOT NULL DEFAULT 'weekly'::text,
  subject TEXT NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  was_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.prompt_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(100) NOT NULL DEFAULT 'general'::character varying,
  template_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- === Agent Conversations ===

CREATE TABLE public.agent_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title VARCHAR(500),
  summary TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user'::character varying,
  content TEXT NOT NULL DEFAULT ''::text,
  model_used VARCHAR(200),
  provider_used VARCHAR(200),
  tokens_input INTEGER,
  tokens_output INTEGER,
  latency_ms INTEGER,
  tool_calls JSONB,
  tool_results JSONB,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === Agent Execution ===

CREATE TABLE public.agent_execution_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  user_id UUID NOT NULL,
  input TEXT NOT NULL,
  goal TEXT NOT NULL,
  plan_summary TEXT,
  status TEXT NOT NULL DEFAULT 'planning'::text,
  current_step_number INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_output JSONB,
  success BOOLEAN,
  total_tokens_used INTEGER DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  planning_time_ms INTEGER,
  execution_time_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.agent_execution_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL,
  parent_step_id UUID,
  step_number INTEGER NOT NULL,
  step_name TEXT,
  description TEXT,
  action_type TEXT NOT NULL,
  action_details JSONB,
  depends_on INTEGER[],
  can_run_parallel BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  result JSONB,
  output_for_next_step TEXT,
  error_message TEXT,
  error_code TEXT,
  tokens_used INTEGER DEFAULT 0,
  cost NUMERIC DEFAULT 0,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.agent_reasoning_traces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL,
  step_id UUID,
  reasoning_type TEXT NOT NULL,
  content TEXT NOT NULL,
  context JSONB,
  confidence_score DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === Agent Memory ===

CREATE TABLE public.agent_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  user_id UUID NOT NULL,
  memory_type TEXT NOT NULL,
  memory_category TEXT,
  content TEXT NOT NULL,
  summary TEXT,
  embedding extensions.vector(1536),
  source_type TEXT,
  source_id UUID,
  importance_score DOUBLE PRECISION DEFAULT 0.5,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  consolidated BOOLEAN DEFAULT false,
  superseded_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.agent_learning_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_description TEXT NOT NULL,
  related_memory_id UUID,
  related_conversation_id UUID,
  related_message_id UUID,
  feedback_type TEXT,
  feedback_text TEXT,
  agent_action_taken TEXT,
  behavior_change JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_id UUID,
  preference_key TEXT NOT NULL,
  preference_value JSONB NOT NULL,
  learned_from TEXT,
  confidence_score DOUBLE PRECISION DEFAULT 0.5,
  evidence_count INTEGER DEFAULT 1,
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- === MCP ===

CREATE TABLE public.mcp_servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  server_url TEXT NOT NULL,
  transport_type TEXT NOT NULL DEFAULT 'http'::text,
  auth_type TEXT NOT NULL DEFAULT 'none'::text,
  auth_config JSONB,
  supports_tools BOOLEAN DEFAULT true,
  supports_resources BOOLEAN DEFAULT false,
  supports_prompts BOOLEAN DEFAULT false,
  supports_sampling BOOLEAN DEFAULT false,
  version TEXT,
  homepage_url TEXT,
  documentation_url TEXT,
  is_global BOOLEAN DEFAULT false,
  created_by UUID,
  organization_id UUID,
  is_verified BOOLEAN DEFAULT false,
  is_enabled BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  verification_status TEXT,
  verification_error TEXT,
  total_tool_calls INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.mcp_tools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  input_schema JSONB NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  avg_execution_time_ms INTEGER,
  last_executed_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.mcp_tool_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_id UUID NOT NULL,
  server_id UUID NOT NULL,
  agent_id UUID,
  user_id UUID NOT NULL,
  input_parameters JSONB NOT NULL,
  output_result JSONB,
  status TEXT NOT NULL,
  error_message TEXT,
  error_code TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  execution_time_ms INTEGER,
  execution_context JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === Email ===

CREATE TABLE public.sendgrid_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_encrypted TEXT,
  from_email TEXT DEFAULT 'noreply@sjinnovation.com'::text,
  from_name TEXT DEFAULT 'SJ Innovation'::text,
  is_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT,
  webhook_secret TEXT,
  enable_open_tracking BOOLEAN DEFAULT true,
  enable_click_tracking BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  api_key TEXT
);

CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID,
  user_id UUID NOT NULL,
  contact_id UUID,
  client_id UUID,
  recipient TEXT NOT NULL,
  recipient_name TEXT,
  cc TEXT,
  bcc TEXT,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  status TEXT DEFAULT 'queued'::text,
  priority TEXT DEFAULT 'normal'::text,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  provider TEXT DEFAULT 'sendgrid'::text,
  provider_message_id TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.email_tracking_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID,
  contact_id UUID,
  event_type TEXT NOT NULL,
  clicked_url TEXT,
  user_agent TEXT,
  ip_address TEXT,
  sendgrid_event_id TEXT,
  sendgrid_message_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.scheduled_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending'::text,
  sent_at TIMESTAMPTZ,
  deal_id UUID,
  contact_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === Integrations ===

CREATE TABLE public.integration_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'Cloud'::text,
  display_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.integration_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  docs_url TEXT,
  auth_type TEXT NOT NULL DEFAULT 'api_key'::text,
  oauth_config JSONB DEFAULT '{}'::jsonb,
  is_available BOOLEAN DEFAULT true,
  is_coming_soon BOOLEAN DEFAULT false,
  is_beta BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.integration_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text'::text,
  placeholder TEXT,
  default_value TEXT,
  is_required BOOLEAN DEFAULT false,
  is_sensitive BOOLEAN DEFAULT false,
  help_text TEXT,
  validation_regex TEXT,
  select_options JSONB,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.integration_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL,
  name TEXT NOT NULL,
  service_key TEXT NOT NULL,
  description TEXT,
  features JSONB DEFAULT '{}'::jsonb,
  has_cost BOOLEAN DEFAULT false,
  cost_model JSONB,
  enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  is_beta BOOLEAN DEFAULT false,
  requires_config BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.integration_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  provider_id UUID,
  service_id UUID,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success'::text,
  request_metadata JSONB,
  response_metadata JSONB,
  error_message TEXT,
  estimated_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  connection_status TEXT DEFAULT 'disconnected'::text,
  connection_message TEXT,
  last_tested_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  oauth_tokens JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.oauth_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  redirect_uri TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider_slug TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer'::text,
  expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}'::text[],
  account_email TEXT,
  account_name TEXT,
  account_id TEXT,
  account_avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  error_message TEXT,
  error_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider_slug)
);

-- === Microsoft Teams ===

CREATE TABLE public.user_microsoft_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  team_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  visibility TEXT,
  web_url TEXT,
  is_archived BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, team_id)
);

CREATE TABLE public.user_microsoft_teams_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  team_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  membership_type TEXT,
  web_url TEXT,
  email TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_date_time TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, team_id, channel_id)
);

CREATE TABLE public.graph_webhook_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  change_types TEXT[] NOT NULL DEFAULT ARRAY['created'::text, 'updated'::text, 'deleted'::text],
  notification_url TEXT NOT NULL,
  client_state TEXT NOT NULL,
  expiration_datetime TIMESTAMPTZ NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_notification_at TIMESTAMPTZ,
  error_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB
);

CREATE TABLE public.graph_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  resource_data JSONB,
  client_state_valid BOOLEAN NOT NULL DEFAULT false,
  processing_status TEXT NOT NULL DEFAULT 'pending'::text,
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  metadata JSONB
);

-- === Gemini / RAG ===

CREATE TABLE public.gemini_corpora (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT,
  external_corpus_id TEXT,
  document_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.gemini_query_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  corpus_id UUID,
  user_id UUID,
  query_text TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.gemini_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  corpus_id UUID NOT NULL,
  sync_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending'::text,
  documents_added INTEGER DEFAULT 0,
  documents_removed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  triggered_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === Productivity ===

CREATE TABLE public.productivity_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_email TEXT NOT NULL,
  week_start DATE NOT NULL,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  total_hours NUMERIC DEFAULT 0,
  billable_hours NUMERIC DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  tasks_assigned INTEGER DEFAULT 0,
  meetings_attended INTEGER DEFAULT 0,
  utilization_pct NUMERIC DEFAULT 0,
  efficiency_score NUMERIC DEFAULT 0,
  attendance_status TEXT DEFAULT 'present'::text,
  department TEXT,
  location TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_email, week_start)
);

CREATE TABLE public.productivity_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_email TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium'::text,
  title TEXT NOT NULL,
  description TEXT,
  week_start DATE,
  is_read BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.leave_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_email TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_half_day BOOLEAN DEFAULT false,
  notes TEXT,
  approved_by TEXT,
  status TEXT DEFAULT 'approved'::text,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === Process Management ===

CREATE TABLE public.process_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.process_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft'::text,
  tags TEXT[] DEFAULT '{}'::text[],
  created_by UUID,
  updated_by UUID,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.processing_queue_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_type TEXT NOT NULL,
  total_items INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running'::text,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  triggered_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. FOREIGN KEY CONSTRAINTS
-- ============================================================

-- Auth & Profiles
ALTER TABLE public.accountability_charts ADD CONSTRAINT accountability_charts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.accountability_charts ADD CONSTRAINT accountability_charts_published_by_fkey FOREIGN KEY (published_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.accountability_responsibilities ADD CONSTRAINT accountability_responsibilities_chart_id_fkey FOREIGN KEY (chart_id) REFERENCES accountability_charts(id) ON DELETE CASCADE;
ALTER TABLE public.accountability_responsibilities ADD CONSTRAINT accountability_responsibilities_reports_to_fkey FOREIGN KEY (reports_to) REFERENCES accountability_responsibilities(id) ON DELETE SET NULL;
ALTER TABLE public.accountability_responsibilities ADD CONSTRAINT accountability_responsibilities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Agent system
ALTER TABLE public.agent_conversations ADD CONSTRAINT agent_conversations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.agent_conversations ADD CONSTRAINT agent_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.agent_execution_plans ADD CONSTRAINT agent_execution_plans_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.agent_execution_plans ADD CONSTRAINT agent_execution_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.agent_execution_steps ADD CONSTRAINT agent_execution_steps_parent_step_id_fkey FOREIGN KEY (parent_step_id) REFERENCES agent_execution_steps(id);
ALTER TABLE public.agent_execution_steps ADD CONSTRAINT agent_execution_steps_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES agent_execution_plans(id) ON DELETE CASCADE;
ALTER TABLE public.agent_learning_events ADD CONSTRAINT agent_learning_events_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.agent_learning_events ADD CONSTRAINT agent_learning_events_related_memory_id_fkey FOREIGN KEY (related_memory_id) REFERENCES agent_memories(id);
ALTER TABLE public.agent_learning_events ADD CONSTRAINT agent_learning_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.agent_memories ADD CONSTRAINT agent_memories_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.agent_memories ADD CONSTRAINT agent_memories_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES agent_memories(id);
ALTER TABLE public.agent_memories ADD CONSTRAINT agent_memories_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.agent_messages ADD CONSTRAINT agent_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES agent_conversations(id) ON DELETE CASCADE;
ALTER TABLE public.agent_reasoning_traces ADD CONSTRAINT agent_reasoning_traces_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES agent_execution_plans(id) ON DELETE CASCADE;
ALTER TABLE public.agent_reasoning_traces ADD CONSTRAINT agent_reasoning_traces_step_id_fkey FOREIGN KEY (step_id) REFERENCES agent_execution_steps(id) ON DELETE CASCADE;

-- AI
ALTER TABLE public.ai_agent_runs ADD CONSTRAINT ai_agent_runs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.ai_agent_runs ADD CONSTRAINT ai_agent_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ai_chat_history ADD CONSTRAINT ai_chat_history_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE SET NULL;
ALTER TABLE public.ai_chat_history ADD CONSTRAINT ai_chat_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ai_digest_logs ADD CONSTRAINT ai_digest_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ai_models ADD CONSTRAINT ai_models_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES ai_providers(id) ON DELETE CASCADE;
ALTER TABLE public.ai_productivity_insights ADD CONSTRAINT ai_productivity_insights_pod_id_fkey FOREIGN KEY (pod_id) REFERENCES pods(id) ON DELETE SET NULL;
ALTER TABLE public.ai_usage_logs ADD CONSTRAINT ai_usage_logs_model_id_fkey FOREIGN KEY (model_id) REFERENCES ai_models(id) ON DELETE SET NULL;

-- CRM
ALTER TABLE public.client_feedback ADD CONSTRAINT client_feedback_client_access_id_fkey FOREIGN KEY (client_access_id) REFERENCES project_client_access(id) ON DELETE SET NULL;
ALTER TABLE public.client_feedback ADD CONSTRAINT client_feedback_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.client_meetings ADD CONSTRAINT client_meetings_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_meetings ADD CONSTRAINT client_meetings_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
ALTER TABLE public.contact_activities ADD CONSTRAINT contact_activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE public.contact_ai_summaries ADD CONSTRAINT contact_ai_summaries_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE public.contact_communications ADD CONSTRAINT contact_communications_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE public.contact_meeting_links ADD CONSTRAINT contact_meeting_links_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE public.contact_meeting_links ADD CONSTRAINT contact_meeting_links_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;

-- Deals
ALTER TABLE public.deal_activities ADD CONSTRAINT deal_activities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE public.deal_activities ADD CONSTRAINT deal_activities_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.deal_comments ADD CONSTRAINT deal_comments_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE public.deal_comments ADD CONSTRAINT deal_comments_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.deals ADD CONSTRAINT deals_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.deals ADD CONSTRAINT deals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public.deals ADD CONSTRAINT deals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.deals ADD CONSTRAINT deals_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- EOS
ALTER TABLE public.eos_issue_suggestions ADD CONSTRAINT eos_issue_suggestions_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES eos_issues(id) ON DELETE CASCADE;
ALTER TABLE public.eos_scorecard_metrics ADD CONSTRAINT eos_scorecard_metrics_scorecard_id_fkey FOREIGN KEY (scorecard_id) REFERENCES eos_scorecards(id) ON DELETE CASCADE;
ALTER TABLE public.gwc_assessments ADD CONSTRAINT gwc_assessments_responsibility_id_fkey FOREIGN KEY (responsibility_id) REFERENCES accountability_responsibilities(id) ON DELETE CASCADE;

-- Meetings
ALTER TABLE public.meeting_action_items ADD CONSTRAINT meeting_action_items_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
ALTER TABLE public.meeting_agenda_items ADD CONSTRAINT meeting_agenda_items_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
ALTER TABLE public.meeting_assignment_suggestions ADD CONSTRAINT meeting_assignment_suggestions_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
ALTER TABLE public.meeting_assignments ADD CONSTRAINT meeting_assignments_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
ALTER TABLE public.meeting_categorizations ADD CONSTRAINT meeting_categorizations_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
ALTER TABLE public.meeting_external_participants ADD CONSTRAINT meeting_external_participants_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
ALTER TABLE public.meeting_participants ADD CONSTRAINT meeting_participants_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
ALTER TABLE public.meeting_takeaways ADD CONSTRAINT meeting_takeaways_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
ALTER TABLE public.meeting_transcripts ADD CONSTRAINT meeting_transcripts_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
ALTER TABLE public.meetings ADD CONSTRAINT meetings_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD CONSTRAINT meetings_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.zoom_files ADD CONSTRAINT zoom_files_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;

-- Projects
ALTER TABLE public.project_at_risk_flags ADD CONSTRAINT project_at_risk_flags_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_billing ADD CONSTRAINT project_billing_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_client_access ADD CONSTRAINT project_client_access_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_client_comments ADD CONSTRAINT project_client_comments_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_comments ADD CONSTRAINT project_comments_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_favorites ADD CONSTRAINT project_favorites_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_files ADD CONSTRAINT project_files_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_invoices ADD CONSTRAINT project_invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_members ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_milestones ADD CONSTRAINT project_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.project_risks ADD CONSTRAINT project_risks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE public.projects ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_id_fkey FOREIGN KEY (status_id) REFERENCES project_statuses(id) ON DELETE SET NULL;

-- Tasks
ALTER TABLE public.task_attachments ADD CONSTRAINT task_attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE public.task_comments ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE public.task_contributors ADD CONSTRAINT task_contributors_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE public.task_stream_members ADD CONSTRAINT task_stream_members_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES task_streams(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES task_streams(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_category_id_fkey FOREIGN KEY (category_id) REFERENCES task_categories(id) ON DELETE SET NULL;

-- Knowledge
ALTER TABLE public.knowledge_categories ADD CONSTRAINT knowledge_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES knowledge_categories(id) ON DELETE SET NULL;
ALTER TABLE public.knowledge_entries ADD CONSTRAINT knowledge_entries_category_id_fkey FOREIGN KEY (category_id) REFERENCES knowledge_categories(id) ON DELETE SET NULL;
ALTER TABLE public.knowledge_embeddings ADD CONSTRAINT knowledge_embeddings_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE;
ALTER TABLE public.knowledge_embeddings ADD CONSTRAINT knowledge_embeddings_file_id_fkey FOREIGN KEY (file_id) REFERENCES knowledge_files(id) ON DELETE CASCADE;
ALTER TABLE public.knowledge_files ADD CONSTRAINT knowledge_files_category_id_fkey FOREIGN KEY (category_id) REFERENCES knowledge_categories(id) ON DELETE SET NULL;
ALTER TABLE public.knowledge_files ADD CONSTRAINT knowledge_files_source_id_fkey FOREIGN KEY (source_id) REFERENCES knowledge_sources(id) ON DELETE SET NULL;

-- Integrations
ALTER TABLE public.integration_fields ADD CONSTRAINT integration_fields_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES integration_providers(id) ON DELETE CASCADE;
ALTER TABLE public.integration_providers ADD CONSTRAINT integration_providers_category_id_fkey FOREIGN KEY (category_id) REFERENCES integration_categories(id) ON DELETE CASCADE;
ALTER TABLE public.integration_services ADD CONSTRAINT integration_services_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES integration_providers(id) ON DELETE CASCADE;

-- MCP
ALTER TABLE public.mcp_tools ADD CONSTRAINT mcp_tools_server_id_fkey FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE;
ALTER TABLE public.mcp_tool_executions ADD CONSTRAINT mcp_tool_executions_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES mcp_tools(id) ON DELETE CASCADE;
ALTER TABLE public.mcp_tool_executions ADD CONSTRAINT mcp_tool_executions_server_id_fkey FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE;

-- OKRs
ALTER TABLE public.okr_key_results ADD CONSTRAINT okr_key_results_okr_id_fkey FOREIGN KEY (okr_id) REFERENCES okrs(id) ON DELETE CASCADE;
ALTER TABLE public.okr_check_ins ADD CONSTRAINT okr_check_ins_okr_id_fkey FOREIGN KEY (okr_id) REFERENCES okrs(id) ON DELETE CASCADE;
ALTER TABLE public.key_result_history ADD CONSTRAINT key_result_history_key_result_id_fkey FOREIGN KEY (key_result_id) REFERENCES okr_key_results(id) ON DELETE CASCADE;

-- Pods
ALTER TABLE public.pod_members ADD CONSTRAINT pod_members_pod_id_fkey FOREIGN KEY (pod_id) REFERENCES pods(id) ON DELETE CASCADE;
ALTER TABLE public.pod_permissions ADD CONSTRAINT pod_permissions_pod_id_fkey FOREIGN KEY (pod_id) REFERENCES pods(id) ON DELETE CASCADE;
ALTER TABLE public.pod_permissions ADD CONSTRAINT pod_permissions_module_id_fkey FOREIGN KEY (module_id) REFERENCES app_modules(id) ON DELETE CASCADE;
ALTER TABLE public.employee_pods ADD CONSTRAINT employee_pods_pod_id_fkey FOREIGN KEY (pod_id) REFERENCES pods(id) ON DELETE CASCADE;
ALTER TABLE public.employee_pods ADD CONSTRAINT employee_pods_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employee_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.employee_skills ADD CONSTRAINT employee_skills_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employee_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.employee_skills ADD CONSTRAINT employee_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE;

-- Gemini
ALTER TABLE public.gemini_query_logs ADD CONSTRAINT gemini_query_logs_corpus_id_fkey FOREIGN KEY (corpus_id) REFERENCES gemini_corpora(id) ON DELETE SET NULL;
ALTER TABLE public.gemini_sync_logs ADD CONSTRAINT gemini_sync_logs_corpus_id_fkey FOREIGN KEY (corpus_id) REFERENCES gemini_corpora(id) ON DELETE CASCADE;

-- User module permissions
ALTER TABLE public.user_module_permissions ADD CONSTRAINT user_module_permissions_module_id_fkey FOREIGN KEY (module_id) REFERENCES app_modules(id) ON DELETE CASCADE;

-- ============================================================
-- 5. INDEXES
-- ============================================================

-- Activity logs
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs (user_id);
CREATE INDEX idx_activity_logs_action ON public.activity_logs (action);
CREATE INDEX idx_activity_logs_resource_type ON public.activity_logs (resource_type);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs (created_at DESC);

-- Agent conversations
CREATE INDEX idx_agent_conversations_agent_user ON public.agent_conversations (agent_id, user_id);
CREATE INDEX idx_agent_conversations_last_message ON public.agent_conversations (last_message_at DESC NULLS LAST);

-- Agent execution
CREATE INDEX idx_agent_plans_agent_id ON public.agent_execution_plans (agent_id);
CREATE INDEX idx_agent_plans_user_id ON public.agent_execution_plans (user_id);
CREATE INDEX idx_agent_plans_status ON public.agent_execution_plans (status);
CREATE INDEX idx_agent_plans_created_at ON public.agent_execution_plans (created_at DESC);
CREATE INDEX idx_agent_steps_plan_id ON public.agent_execution_steps (plan_id);
CREATE INDEX idx_agent_steps_plan_step ON public.agent_execution_steps (plan_id, step_number);
CREATE INDEX idx_agent_steps_status ON public.agent_execution_steps (status);
CREATE INDEX idx_agent_steps_parent_id ON public.agent_execution_steps (parent_step_id);

-- Agent learning
CREATE INDEX idx_learning_events_agent_id ON public.agent_learning_events (agent_id);
CREATE INDEX idx_learning_events_user_id ON public.agent_learning_events (user_id);
CREATE INDEX idx_learning_events_type ON public.agent_learning_events (event_type);
CREATE INDEX idx_learning_events_created_at ON public.agent_learning_events (created_at DESC);

-- Agent memories
CREATE INDEX idx_agent_memories_agent_id ON public.agent_memories (agent_id);
CREATE INDEX idx_agent_memories_user_id ON public.agent_memories (user_id);
CREATE INDEX idx_agent_memories_type ON public.agent_memories (memory_type);
CREATE INDEX idx_agent_memories_category ON public.agent_memories (memory_category);
CREATE INDEX idx_agent_memories_importance ON public.agent_memories (importance_score DESC);
CREATE INDEX idx_agent_memories_created_at ON public.agent_memories (created_at DESC);
CREATE INDEX idx_agent_memories_active ON public.agent_memories (is_active) WHERE is_active = true;

-- Agent messages
CREATE INDEX idx_agent_messages_conversation ON public.agent_messages (conversation_id, created_at);

-- Reasoning traces
CREATE INDEX idx_reasoning_plan_id ON public.agent_reasoning_traces (plan_id);
CREATE INDEX idx_reasoning_step_id ON public.agent_reasoning_traces (step_id);
CREATE INDEX idx_reasoning_type ON public.agent_reasoning_traces (reasoning_type);
CREATE INDEX idx_reasoning_created_at ON public.agent_reasoning_traces (created_at DESC);

-- AI agent runs
CREATE INDEX idx_ai_agent_runs_agent ON public.ai_agent_runs (agent_id);
CREATE INDEX idx_ai_agent_runs_user ON public.ai_agent_runs (user_id);
CREATE INDEX idx_ai_agent_runs_status ON public.ai_agent_runs (status);
CREATE INDEX idx_ai_agent_runs_created ON public.ai_agent_runs (created_at DESC);

-- AI agents
CREATE INDEX idx_ai_agents_slug ON public.ai_agents (slug);
CREATE INDEX idx_ai_agents_category ON public.ai_agents (category);
CREATE INDEX idx_ai_agents_enabled ON public.ai_agents (is_enabled);

-- AI chat
CREATE INDEX idx_ai_chat_session ON public.ai_chat_history (session_id, created_at);
CREATE INDEX idx_ai_chat_user ON public.ai_chat_history (user_id);
CREATE INDEX idx_ai_chat_agent ON public.ai_chat_history (agent_id);

-- AI digest
CREATE INDEX idx_ai_digest_logs_user_id ON public.ai_digest_logs (user_id);
CREATE INDEX idx_ai_digest_logs_sent_at ON public.ai_digest_logs (sent_at DESC);

-- AI models
CREATE INDEX idx_ai_models_provider_id ON public.ai_models (provider_id);
CREATE INDEX idx_ai_models_category ON public.ai_models (category);

-- AI insights
CREATE INDEX idx_ai_insights_type ON public.ai_productivity_insights (insight_type);
CREATE INDEX idx_ai_insights_employee ON public.ai_productivity_insights (employee_email);

-- AI usage
CREATE INDEX idx_ai_usage_logs_user_id ON public.ai_usage_logs (user_id);
CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs (created_at);

-- App config
CREATE UNIQUE INDEX app_config_key_unique ON public.app_config (key);
CREATE UNIQUE INDEX app_modules_slug_unique ON public.app_modules (slug);

-- Client feedback
CREATE INDEX idx_client_feedback_project ON public.client_feedback (project_id);

-- Client meetings
CREATE INDEX idx_client_meetings_client_id ON public.client_meetings (client_id);
CREATE INDEX idx_client_meetings_meeting_id ON public.client_meetings (meeting_id);

-- Clients
CREATE UNIQUE INDEX clients_email_unique ON public.clients (email);
CREATE INDEX idx_clients_data_source ON public.clients (data_source);

-- Contact activities
CREATE INDEX idx_contact_activities_contact_id ON public.contact_activities (contact_id);
CREATE INDEX idx_contact_activities_type ON public.contact_activities (activity_type);
CREATE INDEX idx_contact_activities_channel ON public.contact_activities (channel);
CREATE INDEX idx_contact_activities_created ON public.contact_activities (created_at DESC);
CREATE INDEX idx_contact_activities_not_deleted ON public.contact_activities (deleted_at) WHERE deleted_at IS NULL;

-- Contact AI summaries
CREATE INDEX idx_contact_ai_summaries_contact ON public.contact_ai_summaries (contact_id);
CREATE INDEX idx_contact_ai_summaries_expires_at ON public.contact_ai_summaries (expires_at);

-- Contact communications
CREATE INDEX idx_contact_comms_contact ON public.contact_communications (contact_id);

-- Contact email templates
CREATE INDEX idx_email_templates_category ON public.contact_email_templates (category);
CREATE INDEX idx_email_templates_active ON public.contact_email_templates (is_active);
CREATE INDEX idx_email_templates_usage ON public.contact_email_templates (usage_count DESC);

-- Contact meeting links
CREATE INDEX idx_contact_meeting_links_contact_id ON public.contact_meeting_links (contact_id);
CREATE INDEX idx_contact_meeting_links_meeting_id ON public.contact_meeting_links (meeting_id);

-- Contacts
CREATE INDEX idx_contacts_client ON public.contacts (client_id);
CREATE INDEX idx_contacts_email ON public.contacts (email);
CREATE INDEX idx_contacts_is_lead_follow_up ON public.contacts (is_lead_follow_up);
CREATE INDEX idx_contacts_followup_status ON public.contacts (followup_status);
CREATE INDEX idx_contacts_followup_assigned ON public.contacts (followup_assigned_to, next_followup_date);
CREATE INDEX idx_contacts_lead_score ON public.contacts (lead_score DESC);
CREATE INDEX idx_contacts_lead_temperature ON public.contacts (lead_temperature);
CREATE INDEX idx_contacts_score_temp ON public.contacts (lead_score DESC, lead_temperature);
CREATE INDEX idx_contacts_last_contact_date ON public.contacts (last_contact_date DESC);
CREATE INDEX idx_contacts_next_followup_date ON public.contacts (is_lead_follow_up) WHERE is_lead_follow_up = true;
CREATE INDEX idx_contacts_data_source ON public.contacts (data_source);

-- Deals
CREATE INDEX idx_deals_slug ON public.deals (slug);
CREATE INDEX idx_deals_stage ON public.deals (stage);
CREATE INDEX idx_deals_client ON public.deals (client_id);
CREATE INDEX idx_deals_owner ON public.deals (owner_id);
CREATE INDEX idx_deals_data_source ON public.deals (data_source);
CREATE INDEX idx_deal_activities_deal ON public.deal_activities (deal_id);
CREATE INDEX idx_deal_comments_deal ON public.deal_comments (deal_id);

-- Email
CREATE INDEX idx_email_logs_user_id ON public.email_logs (user_id);
CREATE INDEX idx_email_logs_contact_id ON public.email_logs (contact_id);
CREATE INDEX idx_email_logs_client_id ON public.email_logs (client_id);
CREATE INDEX idx_email_logs_status ON public.email_logs (status);
CREATE INDEX idx_email_logs_sent_at ON public.email_logs (sent_at DESC);
CREATE INDEX idx_email_logs_provider_message_id ON public.email_logs (provider_message_id);
CREATE INDEX idx_email_logs_scheduled_for ON public.email_logs (status) WHERE status = 'scheduled';
CREATE INDEX idx_email_tracking_contact_id ON public.email_tracking_events (contact_id);
CREATE INDEX idx_email_tracking_event_type ON public.email_tracking_events (event_type);
CREATE INDEX idx_email_tracking_activity_id ON public.email_tracking_events (activity_id);
CREATE INDEX idx_email_tracking_sendgrid_id ON public.email_tracking_events (sendgrid_message_id);
CREATE INDEX idx_email_tracking_created_at ON public.email_tracking_events (created_at DESC);

-- Embeddings
CREATE INDEX idx_embeddings_entity ON public.embeddings (entity_type, entity_id);
CREATE INDEX idx_embeddings_user ON public.embeddings (user_id);
CREATE INDEX idx_embeddings_unified_document ON public.embeddings (unified_document_id);
CREATE INDEX idx_embedding_queue_status ON public.embedding_queue (status);
CREATE INDEX idx_embedding_queue_entity ON public.embedding_queue (entity_type, entity_id);

-- Employee
CREATE INDEX idx_employee_profiles_email ON public.employee_profiles (email);
CREATE INDEX idx_employee_profiles_user ON public.employee_profiles (user_id);
CREATE INDEX idx_employee_profiles_dept ON public.employee_profiles (department_id);
CREATE INDEX idx_employee_pods_employee_id ON public.employee_pods (employee_id);
CREATE INDEX idx_employee_pods_pod_id ON public.employee_pods (pod_id);
CREATE INDEX idx_employee_pods_synced_from_hr ON public.employee_pods (synced_from_hr);
CREATE INDEX idx_employee_skills_employee_id ON public.employee_skills (employee_id);
CREATE INDEX idx_employee_skills_skill_id ON public.employee_skills (skill_id);
CREATE INDEX idx_employee_skills_proficiency ON public.employee_skills (proficiency_level);

-- EOS
CREATE INDEX idx_eos_issues_status ON public.eos_issues (status);
CREATE INDEX idx_eos_issues_priority ON public.eos_issues (priority);
CREATE INDEX idx_eos_issues_pod ON public.eos_issues (pod_id);
CREATE INDEX idx_eos_issues_assigned ON public.eos_issues (assigned_to);
CREATE INDEX idx_eos_issue_suggestions_issue ON public.eos_issue_suggestions (issue_id);
CREATE INDEX idx_scorecard_metrics_scorecard ON public.eos_scorecard_metrics (scorecard_id);
CREATE INDEX idx_scorecard_metrics_week ON public.eos_scorecard_metrics (week_of);
CREATE INDEX idx_accountability_resp_chart ON public.accountability_responsibilities (chart_id);
CREATE INDEX idx_accountability_resp_user ON public.accountability_responsibilities (user_id);
CREATE INDEX idx_accountability_resp_reports_to ON public.accountability_responsibilities (reports_to);
CREATE INDEX idx_gwc_responsibility ON public.gwc_assessments (responsibility_id);

-- Feedback
CREATE INDEX idx_feedback_user ON public.feedback (user_id);
CREATE INDEX idx_feedback_type ON public.feedback (type);
CREATE INDEX idx_feedback_status ON public.feedback (status);

-- Gemini
CREATE INDEX idx_gemini_corpora_active ON public.gemini_corpora (is_active);
CREATE INDEX idx_gemini_query_logs_corpus ON public.gemini_query_logs (corpus_id);
CREATE INDEX idx_gemini_query_logs_user ON public.gemini_query_logs (user_id);
CREATE INDEX idx_gemini_query_logs_created ON public.gemini_query_logs (created_at DESC);
CREATE INDEX idx_gemini_sync_logs_corpus ON public.gemini_sync_logs (corpus_id);
CREATE INDEX idx_gemini_sync_logs_started ON public.gemini_sync_logs (started_at DESC);

-- Graph webhooks
CREATE INDEX idx_graph_webhook_subscriptions_subscription_id ON public.graph_webhook_subscriptions (subscription_id);
CREATE INDEX idx_graph_webhook_subscriptions_user ON public.graph_webhook_subscriptions (user_id);
CREATE INDEX idx_graph_webhook_subscriptions_active ON public.graph_webhook_subscriptions (is_active, expiration_datetime);
CREATE INDEX idx_graph_webhook_logs_subscription ON public.graph_webhook_logs (subscription_id);
CREATE INDEX idx_graph_webhook_logs_status ON public.graph_webhook_logs (processing_status);
CREATE INDEX idx_graph_webhook_logs_received ON public.graph_webhook_logs (received_at DESC);

-- Integrations
CREATE INDEX idx_integration_providers_category ON public.integration_providers (category_id);
CREATE INDEX idx_integration_providers_slug ON public.integration_providers (slug);
CREATE INDEX idx_integration_fields_provider ON public.integration_fields (provider_id);
CREATE INDEX idx_integration_services_provider ON public.integration_services (provider_id);
CREATE INDEX idx_integration_usage_logs_user ON public.integration_usage_logs (user_id);
CREATE INDEX idx_integration_usage_logs_provider ON public.integration_usage_logs (provider_id);
CREATE INDEX idx_integration_usage_logs_created ON public.integration_usage_logs (created_at DESC);

-- Key result history
CREATE INDEX idx_key_result_history_kr_id ON public.key_result_history (key_result_id);
CREATE INDEX idx_key_result_history_updated_at ON public.key_result_history (updated_at DESC);

-- Knowledge
CREATE INDEX idx_knowledge_categories_slug ON public.knowledge_categories (slug);
CREATE INDEX idx_knowledge_categories_parent ON public.knowledge_categories (parent_id);
CREATE INDEX idx_knowledge_categories_owner ON public.knowledge_categories (owner_id);
CREATE INDEX idx_knowledge_entries_category ON public.knowledge_entries (category_id);
CREATE INDEX idx_knowledge_entries_author ON public.knowledge_entries (author_id);
CREATE INDEX idx_knowledge_entries_status ON public.knowledge_entries (status);
CREATE INDEX idx_knowledge_entries_search ON public.knowledge_entries USING gin (search_vector);
CREATE INDEX idx_knowledge_entries_tags ON public.knowledge_entries USING gin (tags);
CREATE INDEX idx_knowledge_files_category ON public.knowledge_files (category_id);
CREATE INDEX idx_knowledge_files_status ON public.knowledge_files (processing_status);
CREATE INDEX idx_knowledge_embeddings_file ON public.knowledge_embeddings (file_id);
CREATE INDEX idx_knowledge_embeddings_entry ON public.knowledge_embeddings (entry_id);

-- Lead follow-up
CREATE INDEX idx_lead_followup_status ON public.lead_followup_contacts (status);
CREATE INDEX idx_lead_followup_assigned ON public.lead_followup_contacts (assigned_to);
CREATE INDEX idx_lead_intent_analysis_contact ON public.lead_intent_analysis (contact_id);
CREATE INDEX idx_lead_intent_analysis_lead ON public.lead_intent_analysis (lead_id);
CREATE INDEX idx_lead_intent_analysis_intent_status ON public.lead_intent_analysis (intent_status);
CREATE INDEX idx_lead_intent_analysis_analyzed_at ON public.lead_intent_analysis (analyzed_at DESC);
CREATE INDEX idx_lead_mood_analysis_contact ON public.lead_mood_analysis (contact_id);
CREATE INDEX idx_lead_mood_analysis_lead ON public.lead_mood_analysis (lead_id);
CREATE INDEX idx_lead_mood_analysis_mood_label ON public.lead_mood_analysis (mood_label);
CREATE INDEX idx_lead_mood_analysis_analyzed_at ON public.lead_mood_analysis (analyzed_at DESC);

-- Leave events
CREATE INDEX idx_leave_events_email ON public.leave_events (employee_email);

-- MCP
CREATE INDEX idx_mcp_servers_slug ON public.mcp_servers (slug);
CREATE INDEX idx_mcp_servers_is_enabled ON public.mcp_servers (is_enabled);
CREATE INDEX idx_mcp_servers_is_global ON public.mcp_servers (is_global);
CREATE INDEX idx_mcp_servers_transport ON public.mcp_servers (transport_type);
CREATE INDEX idx_mcp_servers_created_by ON public.mcp_servers (created_by);
CREATE INDEX idx_mcp_tools_server_id ON public.mcp_tools (server_id);
CREATE INDEX idx_mcp_tools_name ON public.mcp_tools (name);
CREATE INDEX idx_mcp_tools_is_enabled ON public.mcp_tools (is_enabled);
CREATE INDEX idx_mcp_executions_tool_id ON public.mcp_tool_executions (tool_id);
CREATE INDEX idx_mcp_executions_server_id ON public.mcp_tool_executions (server_id);
CREATE INDEX idx_mcp_executions_user_id ON public.mcp_tool_executions (user_id);
CREATE INDEX idx_mcp_executions_agent_id ON public.mcp_tool_executions (agent_id);
CREATE INDEX idx_mcp_executions_status ON public.mcp_tool_executions (status);
CREATE INDEX idx_mcp_executions_created_at ON public.mcp_tool_executions (created_at DESC);

-- Meetings
CREATE INDEX idx_meetings_client ON public.meetings (client_id);
CREATE INDEX idx_meetings_client_id ON public.meetings (client_id);
CREATE INDEX idx_meetings_created_by ON public.meetings (organizer_id);
CREATE INDEX idx_meetings_deal_id ON public.meetings (deal_id);
CREATE INDEX idx_meetings_external_id ON public.meetings (external_id);
CREATE INDEX idx_participants_meeting ON public.meeting_participants (meeting_id);
CREATE INDEX idx_participants_user ON public.meeting_participants (user_id);
CREATE INDEX idx_meeting_external_participants_meeting_id ON public.meeting_external_participants (meeting_id);
CREATE INDEX idx_agenda_items_meeting ON public.meeting_agenda_items (meeting_id);
CREATE INDEX idx_agenda_items_order ON public.meeting_agenda_items (meeting_id, sort_order);
CREATE INDEX idx_takeaways_meeting ON public.meeting_takeaways (meeting_id);
CREATE INDEX idx_takeaways_type ON public.meeting_takeaways (takeaway_type);
CREATE INDEX idx_takeaways_assigned ON public.meeting_takeaways (assigned_to);
CREATE INDEX idx_meeting_transcripts_meeting_id ON public.meeting_transcripts (meeting_id);
CREATE INDEX idx_transcripts_meeting ON public.meeting_transcripts (meeting_id);
CREATE INDEX idx_meeting_action_items_meeting_id ON public.meeting_action_items (meeting_id);
CREATE INDEX idx_meeting_action_items_assignee_id ON public.meeting_action_items (assignee_id);
CREATE INDEX idx_meeting_action_items_task_id ON public.meeting_action_items (task_id);
CREATE INDEX idx_assignments_meeting ON public.meeting_assignments (meeting_id);
CREATE INDEX idx_assignments_entity ON public.meeting_assignments (entity_type, entity_id);
CREATE INDEX idx_meeting_assignment_suggestions_meeting_id ON public.meeting_assignment_suggestions (meeting_id);
CREATE INDEX idx_meeting_assignment_suggestions_review_status ON public.meeting_assignment_suggestions (review_status);
CREATE INDEX idx_categorizations_meeting ON public.meeting_categorizations (meeting_id);
CREATE INDEX idx_categorizations_category ON public.meeting_categorizations (category);
CREATE INDEX idx_meeting_files_meeting_id ON public.meeting_files (meeting_id);
CREATE INDEX idx_meeting_files_provider ON public.meeting_files (provider);
CREATE INDEX idx_meeting_files_assignment_status ON public.meeting_files (assignment_status);
CREATE INDEX idx_meeting_series_organizer ON public.meeting_series (organizer_id);
CREATE INDEX idx_meeting_series_active ON public.meeting_series (is_active);

-- Projects
CREATE INDEX idx_project_at_risk_flags_project ON public.project_at_risk_flags (project_id);

-- Tasks
CREATE INDEX idx_tasks_stream ON public.tasks (stream_id);
CREATE INDEX idx_tasks_category ON public.tasks (category_id);

-- ============================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.accountability_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_responsibilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_reasoning_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_digest_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_productivity_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.common_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_meeting_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedding_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eos_issue_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eos_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eos_pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eos_scorecard_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eos_scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eos_vto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gemini_corpora ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gemini_query_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gemini_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gwc_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_result_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_followup_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_intent_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_mood_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_assignment_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_categorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_external_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_takeaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_queue_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productivity_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productivity_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_at_risk_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_client_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_client_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sendgrid_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_stream_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_knowledge_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_microsoft_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_microsoft_teams_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vector_search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_files ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================

-- Accountability
CREATE POLICY "Authenticated users can manage charts" ON public.accountability_charts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view charts" ON public.accountability_charts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage responsibilities" ON public.accountability_responsibilities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view responsibilities" ON public.accountability_responsibilities FOR SELECT TO authenticated USING (true);

-- Activity logs
CREATE POLICY "Admins can delete activity logs" ON public.activity_logs FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all activity logs" ON public.activity_logs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert their own activity logs" ON public.activity_logs FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own activity logs" ON public.activity_logs FOR SELECT USING ((auth.uid() = user_id));

-- Agent conversations
CREATE POLICY "Users can delete own conversations" ON public.agent_conversations FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own conversations" ON public.agent_conversations FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update own conversations" ON public.agent_conversations FOR UPDATE USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own conversations" ON public.agent_conversations FOR SELECT USING ((auth.uid() = user_id));

-- Agent execution plans
CREATE POLICY "Admins can view all agent execution plans" ON public.agent_execution_plans FOR SELECT USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "System can manage agent execution plans" ON public.agent_execution_plans FOR ALL USING ((user_id = auth.uid()));
CREATE POLICY "Users can view their agent execution plans" ON public.agent_execution_plans FOR SELECT USING ((user_id = auth.uid()));

-- Agent execution steps
CREATE POLICY "Admins can view all agent execution steps" ON public.agent_execution_steps FOR SELECT USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "System can manage agent execution steps" ON public.agent_execution_steps FOR ALL USING ((EXISTS (SELECT 1 FROM agent_execution_plans WHERE agent_execution_plans.id = agent_execution_steps.plan_id AND agent_execution_plans.user_id = auth.uid())));
CREATE POLICY "Users can view their agent execution steps" ON public.agent_execution_steps FOR SELECT USING ((EXISTS (SELECT 1 FROM agent_execution_plans WHERE agent_execution_plans.id = agent_execution_steps.plan_id AND agent_execution_plans.user_id = auth.uid())));

-- Agent learning events
CREATE POLICY "Admins can view all learning events" ON public.agent_learning_events FOR SELECT USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "System can create learning events" ON public.agent_learning_events FOR INSERT WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view their learning events" ON public.agent_learning_events FOR SELECT USING ((user_id = auth.uid()));

-- Agent memories
CREATE POLICY "Admins can view all agent memories" ON public.agent_memories FOR SELECT USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "System can manage agent memories" ON public.agent_memories FOR ALL USING ((user_id = auth.uid()));
CREATE POLICY "Users can view their agent memories" ON public.agent_memories FOR SELECT USING ((user_id = auth.uid()));

-- Agent messages
CREATE POLICY "Users can delete messages in own conversations" ON public.agent_messages FOR DELETE USING ((EXISTS (SELECT 1 FROM agent_conversations c WHERE c.id = agent_messages.conversation_id AND c.user_id = auth.uid())));
CREATE POLICY "Users can insert messages in own conversations" ON public.agent_messages FOR INSERT WITH CHECK ((EXISTS (SELECT 1 FROM agent_conversations c WHERE c.id = agent_messages.conversation_id AND c.user_id = auth.uid())));
CREATE POLICY "Users can view messages in own conversations" ON public.agent_messages FOR SELECT USING ((EXISTS (SELECT 1 FROM agent_conversations c WHERE c.id = agent_messages.conversation_id AND c.user_id = auth.uid())));

-- Agent reasoning traces
CREATE POLICY "Admins can view all agent reasoning traces" ON public.agent_reasoning_traces FOR SELECT USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "System can create agent reasoning traces" ON public.agent_reasoning_traces FOR INSERT WITH CHECK ((EXISTS (SELECT 1 FROM agent_execution_plans WHERE agent_execution_plans.id = agent_reasoning_traces.plan_id AND agent_execution_plans.user_id = auth.uid())));
CREATE POLICY "Users can view their agent reasoning traces" ON public.agent_reasoning_traces FOR SELECT USING ((EXISTS (SELECT 1 FROM agent_execution_plans WHERE agent_execution_plans.id = agent_reasoning_traces.plan_id AND agent_execution_plans.user_id = auth.uid())));

-- AI agent categories
CREATE POLICY "Authenticated can read active categories" ON public.ai_agent_categories FOR SELECT TO authenticated USING (((is_active = true) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Authenticated users can delete categories" ON public.ai_agent_categories FOR DELETE USING ((auth.role() = 'authenticated'));
CREATE POLICY "Authenticated users can insert categories" ON public.ai_agent_categories FOR INSERT WITH CHECK ((auth.role() = 'authenticated'));
CREATE POLICY "Authenticated users can read categories" ON public.ai_agent_categories FOR SELECT USING ((auth.role() = 'authenticated'));
CREATE POLICY "Authenticated users can update categories" ON public.ai_agent_categories FOR UPDATE USING ((auth.role() = 'authenticated'));

-- AI agent runs
CREATE POLICY "Admins can view all runs" ON public.ai_agent_runs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create runs" ON public.ai_agent_runs FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own runs" ON public.ai_agent_runs FOR SELECT TO authenticated USING ((auth.uid() = user_id));

-- AI agents
CREATE POLICY "Admins can manage agents" ON public.ai_agents FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view enabled agents" ON public.ai_agents FOR SELECT TO authenticated USING (((is_enabled = true) OR has_role(auth.uid(), 'admin'::app_role)));

-- AI chat history
CREATE POLICY "Users can create chat messages" ON public.ai_chat_history FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own chat history" ON public.ai_chat_history FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own chat history" ON public.ai_chat_history FOR SELECT TO authenticated USING ((auth.uid() = user_id));

-- AI digest
CREATE POLICY "users_read_own_digests" ON public.ai_digest_logs FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "users_update_own_digests" ON public.ai_digest_logs FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

-- AI models
CREATE POLICY "Admins can manage models" ON public.ai_models FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view models" ON public.ai_models FOR SELECT TO authenticated USING (true);

-- AI productivity insights
CREATE POLICY "Authenticated users can manage insights" ON public.ai_productivity_insights FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view insights" ON public.ai_productivity_insights FOR SELECT TO authenticated USING (true);

-- AI providers
CREATE POLICY "Admins can manage providers" ON public.ai_providers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view providers" ON public.ai_providers FOR SELECT TO authenticated USING (true);

-- AI usage logs
CREATE POLICY "Admins can manage all usage logs" ON public.ai_usage_logs FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert their own usage logs" ON public.ai_usage_logs FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own usage logs" ON public.ai_usage_logs FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)));

-- App config
CREATE POLICY "Admins can manage config" ON public.app_config FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can read non-sensitive config" ON public.app_config FOR SELECT TO authenticated USING ((is_sensitive = false));

-- App modules
CREATE POLICY "Admins can insert app_modules" ON public.app_modules FOR INSERT WITH CHECK ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "Admins can update app_modules" ON public.app_modules FOR UPDATE USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "Anyone can read app_modules" ON public.app_modules FOR SELECT USING (true);

-- Client feedback
CREATE POLICY "Anyone can insert feedback" ON public.client_feedback FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "Authenticated users can view feedback" ON public.client_feedback FOR SELECT TO authenticated USING (true);

-- Client meetings
CREATE POLICY "Authenticated users can manage client meetings" ON public.client_meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view client meetings" ON public.client_meetings FOR SELECT TO authenticated USING (true);

-- Clients
CREATE POLICY "Admins can manage all clients" ON public.clients FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can create clients" ON public.clients FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));
CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update clients they created" ON public.clients FOR UPDATE TO authenticated USING ((auth.uid() = created_by));

-- Common knowledge
CREATE POLICY "Authenticated users can manage common knowledge" ON public.common_knowledge FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view common knowledge" ON public.common_knowledge FOR SELECT TO authenticated USING (true);

-- Contact activities
CREATE POLICY "Authenticated users can manage activities" ON public.contact_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view activities" ON public.contact_activities FOR SELECT TO authenticated USING (true);

-- Contact AI summaries
CREATE POLICY "Authenticated users can manage summaries" ON public.contact_ai_summaries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view summaries" ON public.contact_ai_summaries FOR SELECT TO authenticated USING (true);

-- Contact communications
CREATE POLICY "Authenticated users can manage communications" ON public.contact_communications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view communications" ON public.contact_communications FOR SELECT TO authenticated USING (true);

-- Contact email templates
CREATE POLICY "Authenticated users can manage templates" ON public.contact_email_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view templates" ON public.contact_email_templates FOR SELECT TO authenticated USING (true);

-- Contact meeting links
CREATE POLICY "Authenticated users can manage contact meeting links" ON public.contact_meeting_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view contact meeting links" ON public.contact_meeting_links FOR SELECT TO authenticated USING (true);

-- Contacts
CREATE POLICY "Authenticated users can manage contacts" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view contacts" ON public.contacts FOR SELECT TO authenticated USING (true);

-- Dashboard widgets
CREATE POLICY "admins_manage_widgets" ON public.dashboard_widgets FOR ALL TO authenticated USING ((EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role)));
CREATE POLICY "authenticated_read_widgets" ON public.dashboard_widgets FOR SELECT TO authenticated USING (true);

-- Deal activities
CREATE POLICY "Authenticated users can view activities" ON public.deal_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Deal activity authors and deal owners can manage activities" ON public.deal_activities FOR ALL TO authenticated USING (((user_id = auth.uid()) OR (EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_activities.deal_id AND (deals.owner_id = auth.uid() OR deals.created_by = auth.uid()))))) WITH CHECK (((user_id = auth.uid()) OR (EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_activities.deal_id AND (deals.owner_id = auth.uid() OR deals.created_by = auth.uid())))));

-- Deal comments
CREATE POLICY "Authenticated users can view deal comments" ON public.deal_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Deal comment authors and deal owners can manage comments" ON public.deal_comments FOR ALL TO authenticated USING (((user_id = auth.uid()) OR (EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_comments.deal_id AND (deals.owner_id = auth.uid() OR deals.created_by = auth.uid()))))) WITH CHECK (((user_id = auth.uid()) OR (EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_comments.deal_id AND (deals.owner_id = auth.uid() OR deals.created_by = auth.uid())))));

-- Deals
CREATE POLICY "Authenticated users can view deals" ON public.deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Deal owners and creators can manage deals" ON public.deals FOR ALL TO authenticated USING (((owner_id = auth.uid()) OR (created_by = auth.uid()))) WITH CHECK (((owner_id = auth.uid()) OR (created_by = auth.uid())));

-- Departments
CREATE POLICY "Authenticated users can manage departments" ON public.departments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view departments" ON public.departments FOR SELECT TO authenticated USING (true);

-- Email
CREATE POLICY "Authenticated users can manage email logs" ON public.email_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view email logs" ON public.email_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tracking events" ON public.email_tracking_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view tracking events" ON public.email_tracking_events FOR SELECT TO authenticated USING (true);

-- Embeddings
CREATE POLICY "Authenticated users can manage queue" ON public.embedding_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view queue" ON public.embedding_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create embeddings" ON public.embeddings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can delete their own embeddings" ON public.embeddings FOR DELETE TO authenticated USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Users can view public embeddings" ON public.embeddings FOR SELECT TO authenticated USING (((user_id IS NULL) OR (user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

-- Employee
CREATE POLICY "Admins can manage employee_pods" ON public.employee_pods FOR ALL USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "Users can view employee_pods" ON public.employee_pods FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage employees" ON public.employee_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view employees" ON public.employee_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage employee skills" ON public.employee_skills FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view employee skills" ON public.employee_skills FOR SELECT TO authenticated USING (true);

-- EOS
CREATE POLICY "Authenticated users can manage suggestions" ON public.eos_issue_suggestions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view suggestions" ON public.eos_issue_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage issues" ON public.eos_issues FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view issues" ON public.eos_issues FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage pods" ON public.eos_pods FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view pods" ON public.eos_pods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage metrics" ON public.eos_scorecard_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view metrics" ON public.eos_scorecard_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage scorecards" ON public.eos_scorecards FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view scorecards" ON public.eos_scorecards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage VTO" ON public.eos_vto FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view VTO" ON public.eos_vto FOR SELECT TO authenticated USING (true);

-- Feedback
CREATE POLICY "Admins can update feedback" ON public.feedback FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all feedback" ON public.feedback FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create feedback" ON public.feedback FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own feedback" ON public.feedback FOR SELECT TO authenticated USING ((auth.uid() = user_id));

-- Gemini
CREATE POLICY "Admins can manage gemini_corpora" ON public.gemini_corpora FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view gemini_corpora" ON public.gemini_corpora FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can view all gemini_query_logs" ON public.gemini_query_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own gemini_query_logs" ON public.gemini_query_logs FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view own gemini_query_logs" ON public.gemini_query_logs FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Admins can manage gemini_sync_logs" ON public.gemini_sync_logs FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view gemini_sync_logs" ON public.gemini_sync_logs FOR SELECT TO authenticated USING (true);

-- Graph webhooks
CREATE POLICY "Users can view logs for their subscriptions" ON public.graph_webhook_logs FOR SELECT USING ((EXISTS (SELECT 1 FROM graph_webhook_subscriptions s WHERE s.subscription_id = graph_webhook_logs.subscription_id AND s.user_id = auth.uid())));
CREATE POLICY "Users can create their own webhook subscriptions" ON public.graph_webhook_subscriptions FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own webhook subscriptions" ON public.graph_webhook_subscriptions FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "Users can update their own webhook subscriptions" ON public.graph_webhook_subscriptions FOR UPDATE USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own webhook subscriptions" ON public.graph_webhook_subscriptions FOR SELECT USING ((auth.uid() = user_id));

-- GWC assessments
CREATE POLICY "Authenticated users can view GWC assessments" ON public.gwc_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their own assessments" ON public.gwc_assessments FOR ALL TO authenticated USING ((auth.uid() = assessor_id)) WITH CHECK ((auth.uid() = assessor_id));

-- Integrations
CREATE POLICY "Admins can manage categories" ON public.integration_categories FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view categories" ON public.integration_categories FOR SELECT USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Admins can manage fields" ON public.integration_fields FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view fields" ON public.integration_fields FOR SELECT USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Admins can manage providers" ON public.integration_providers FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view providers" ON public.integration_providers FOR SELECT USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Admins can manage services" ON public.integration_services FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view services" ON public.integration_services FOR SELECT USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Admins can manage all usage logs" ON public.integration_usage_logs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create usage logs" ON public.integration_usage_logs FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own usage logs" ON public.integration_usage_logs FOR SELECT USING (((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)));

-- Key result history
CREATE POLICY "Authenticated users can insert key result history" ON public.key_result_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can view key result history" ON public.key_result_history FOR SELECT TO authenticated USING (true);

-- Knowledge
CREATE POLICY "Admins can manage knowledge categories" ON public.knowledge_categories FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view knowledge categories" ON public.knowledge_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage embeddings" ON public.knowledge_embeddings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view embeddings" ON public.knowledge_embeddings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage all entries" ON public.knowledge_entries FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view published entries" ON public.knowledge_entries FOR SELECT TO authenticated USING (((status = 'published') OR (author_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Authors can create entries" ON public.knowledge_entries FOR INSERT TO authenticated WITH CHECK ((auth.uid() = author_id));
CREATE POLICY "Authors can delete their entries" ON public.knowledge_entries FOR DELETE TO authenticated USING ((auth.uid() = author_id));
CREATE POLICY "Authors can update their entries" ON public.knowledge_entries FOR UPDATE TO authenticated USING ((auth.uid() = author_id));
CREATE POLICY "Authenticated users can manage files" ON public.knowledge_files FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view files" ON public.knowledge_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage sources" ON public.knowledge_sources FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view sources" ON public.knowledge_sources FOR SELECT TO authenticated USING (true);

-- Lead follow-up
CREATE POLICY "Authenticated users can manage followups" ON public.lead_followup_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view followups" ON public.lead_followup_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage intent analysis" ON public.lead_intent_analysis FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view intent analysis" ON public.lead_intent_analysis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage mood analysis" ON public.lead_mood_analysis FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view mood analysis" ON public.lead_mood_analysis FOR SELECT TO authenticated USING (true);

-- Leave
CREATE POLICY "Authenticated users can manage leave" ON public.leave_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view leave" ON public.leave_events FOR SELECT TO authenticated USING (true);

-- MCP servers
CREATE POLICY "Users can create their own MCP servers" ON public.mcp_servers FOR INSERT WITH CHECK ((created_by = auth.uid()));
CREATE POLICY "Users can delete their MCP servers" ON public.mcp_servers FOR DELETE USING (((created_by = auth.uid()) OR ((is_global = true) AND (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)))));
CREATE POLICY "Users can update their MCP servers" ON public.mcp_servers FOR UPDATE USING (((created_by = auth.uid()) OR ((is_global = true) AND (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)))));
CREATE POLICY "Users can view accessible MCP servers" ON public.mcp_servers FOR SELECT USING (((is_global = true) OR (created_by = auth.uid()) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY (ARRAY['admin'::app_role, 'moderator'::app_role])))));

-- MCP tools
CREATE POLICY "System can manage MCP tools" ON public.mcp_tools FOR ALL USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "Users can view accessible MCP tools" ON public.mcp_tools FOR SELECT USING ((EXISTS (SELECT 1 FROM mcp_servers WHERE mcp_servers.id = mcp_tools.server_id AND (mcp_servers.is_global = true OR mcp_servers.created_by = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY (ARRAY['admin'::app_role, 'moderator'::app_role]))))));

-- MCP tool executions
CREATE POLICY "Admins can view all MCP tool executions" ON public.mcp_tool_executions FOR SELECT USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "System can create MCP tool executions" ON public.mcp_tool_executions FOR INSERT WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view their MCP tool executions" ON public.mcp_tool_executions FOR SELECT USING ((user_id = auth.uid()));

-- Meeting action items
CREATE POLICY "Authenticated users can manage action items" ON public.meeting_action_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view action items" ON public.meeting_action_items FOR SELECT TO authenticated USING (true);

-- Meeting agenda items
CREATE POLICY "Authenticated users can manage agenda items" ON public.meeting_agenda_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view agenda items" ON public.meeting_agenda_items FOR SELECT TO authenticated USING (true);

-- Meeting assignment suggestions
CREATE POLICY "Authenticated users can manage assignment suggestions" ON public.meeting_assignment_suggestions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view assignment suggestions" ON public.meeting_assignment_suggestions FOR SELECT TO authenticated USING (true);

-- Meeting assignments
CREATE POLICY "Authenticated users can manage assignments" ON public.meeting_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view assignments" ON public.meeting_assignments FOR SELECT TO authenticated USING (true);

-- Meeting categorizations
CREATE POLICY "Authenticated users can manage categorizations" ON public.meeting_categorizations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view categorizations" ON public.meeting_categorizations FOR SELECT TO authenticated USING (true);

-- Meeting external participants
CREATE POLICY "Authenticated users can manage external participants" ON public.meeting_external_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view external participants" ON public.meeting_external_participants FOR SELECT TO authenticated USING (true);

-- Meeting files
CREATE POLICY "Admins can manage all meeting files" ON public.meeting_files FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view meeting files" ON public.meeting_files FOR SELECT USING ((auth.role() = 'authenticated'));
CREATE POLICY "Users can manage meeting files for their meetings" ON public.meeting_files FOR ALL USING ((EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_files.meeting_id AND meetings.organizer_id = auth.uid())));

-- Meeting participants
CREATE POLICY "Authenticated users can manage participants" ON public.meeting_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view participants" ON public.meeting_participants FOR SELECT TO authenticated USING (true);

-- Meeting series
CREATE POLICY "Authenticated users can view series" ON public.meeting_series FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their own series" ON public.meeting_series FOR ALL TO authenticated USING ((auth.uid() = organizer_id)) WITH CHECK ((auth.uid() = organizer_id));

-- Meeting takeaways
CREATE POLICY "Authenticated users can manage takeaways" ON public.meeting_takeaways FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view takeaways" ON public.meeting_takeaways FOR SELECT TO authenticated USING (true);

-- Meeting transcripts
CREATE POLICY "Admins can manage all transcripts" ON public.meeting_transcripts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can manage transcripts" ON public.meeting_transcripts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view transcripts" ON public.meeting_transcripts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert transcripts for their meetings" ON public.meeting_transcripts FOR INSERT WITH CHECK ((EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_transcripts.meeting_id AND meetings.organizer_id = auth.uid())));
CREATE POLICY "Users can view transcripts for their meetings" ON public.meeting_transcripts FOR SELECT USING ((EXISTS (SELECT 1 FROM meetings WHERE meetings.id = meeting_transcripts.meeting_id AND meetings.organizer_id = auth.uid())));

-- Meetings
CREATE POLICY "Admins can manage all meetings" ON public.meetings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view meetings" ON public.meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Organizers can delete their meetings" ON public.meetings FOR DELETE TO authenticated USING ((auth.uid() = organizer_id));
CREATE POLICY "Organizers can update their meetings" ON public.meetings FOR UPDATE TO authenticated USING ((auth.uid() = organizer_id));
CREATE POLICY "Users can create meetings as organizer" ON public.meetings FOR INSERT TO authenticated WITH CHECK ((auth.uid() = organizer_id));

-- Notifications
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING ((auth.uid() = user_id));

-- OAuth
CREATE POLICY "Users can create their own oauth states" ON public.oauth_states FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own oauth states" ON public.oauth_states FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own oauth states" ON public.oauth_states FOR SELECT USING ((auth.uid() = user_id));

-- OKRs
CREATE POLICY "Authenticated users can create check-ins" ON public.okr_check_ins FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Authenticated users can view check-ins" ON public.okr_check_ins FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage key results" ON public.okr_key_results FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view key results" ON public.okr_key_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage OKRs" ON public.okrs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view OKRs" ON public.okrs FOR SELECT TO authenticated USING (true);

-- Organization integrations
CREATE POLICY "Admins can manage all integrations" ON public.organization_integrations FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create their own integrations" ON public.organization_integrations FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own integrations" ON public.organization_integrations FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "Users can update their own integrations" ON public.organization_integrations FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own integrations" ON public.organization_integrations FOR SELECT USING ((auth.uid() = user_id));

-- Pod employees
CREATE POLICY "Admins can manage pod_employees" ON public.pod_employees FOR ALL USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "Users can view own pod membership" ON public.pod_employees FOR SELECT USING (((user_id = auth.uid()) OR (user_id IS NULL)));

-- Pod members
CREATE POLICY "Authenticated users can manage pod members" ON public.pod_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view pod members" ON public.pod_members FOR SELECT TO authenticated USING (true);

-- Pod permissions
CREATE POLICY "Admins can manage pod_permissions" ON public.pod_permissions FOR ALL USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "Users can view pod_permissions" ON public.pod_permissions FOR SELECT USING (true);

-- Pods
CREATE POLICY "Admins can manage pods" ON public.pods FOR ALL USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "Authenticated users can manage pods" ON public.pods FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view pods" ON public.pods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view active pods" ON public.pods FOR SELECT USING ((is_active = true));

-- Process
CREATE POLICY "Authenticated users can manage categories" ON public.process_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view categories" ON public.process_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage documents" ON public.process_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view documents" ON public.process_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage processing_queue_history" ON public.processing_queue_history FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view processing_queue_history" ON public.processing_queue_history FOR SELECT TO authenticated USING (true);

-- Productivity
CREATE POLICY "Authenticated users can manage alerts" ON public.productivity_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view alerts" ON public.productivity_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage productivity" ON public.productivity_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view productivity" ON public.productivity_records FOR SELECT TO authenticated USING (true);

-- Profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));

-- Project at risk flags
CREATE POLICY "admins_manage_risk_flags" ON public.project_at_risk_flags FOR ALL TO authenticated USING ((EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = ANY (ARRAY['admin'::app_role, 'moderator'::app_role]))));
CREATE POLICY "project_owners_read_risk_flags" ON public.project_at_risk_flags FOR SELECT TO authenticated USING ((EXISTS (SELECT 1 FROM projects p WHERE p.id = project_at_risk_flags.project_id AND (p.owner_id = auth.uid() OR p.created_by = auth.uid()))));

-- Project tables (simplified policies)
CREATE POLICY "Authenticated users can manage project backups" ON public.project_backups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view project backups" ON public.project_backups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage billing" ON public.project_billing FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view billing" ON public.project_billing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert client access" ON public.project_client_access FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update client access" ON public.project_client_access FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can view client access" ON public.project_client_access FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage client comments" ON public.project_client_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage comments" ON public.project_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view comments" ON public.project_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own favorites" ON public.project_favorites FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own favorites" ON public.project_favorites FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Authenticated users can manage files" ON public.project_files FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view files" ON public.project_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage invoices" ON public.project_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view invoices" ON public.project_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage members" ON public.project_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view members" ON public.project_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage milestones" ON public.project_milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view milestones" ON public.project_milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage risks" ON public.project_risks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view risks" ON public.project_risks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage statuses" ON public.project_statuses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view statuses" ON public.project_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage projects" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view projects" ON public.projects FOR SELECT TO authenticated USING (true);

-- Prompt templates
CREATE POLICY "Authenticated users can delete prompt templates" ON public.prompt_templates FOR DELETE TO authenticated USING ((auth.role() = 'authenticated'));
CREATE POLICY "Authenticated users can insert prompt templates" ON public.prompt_templates FOR INSERT TO authenticated WITH CHECK ((auth.role() = 'authenticated'));
CREATE POLICY "Authenticated users can select prompt templates" ON public.prompt_templates FOR SELECT TO authenticated USING ((auth.role() = 'authenticated'));
CREATE POLICY "Authenticated users can update prompt templates" ON public.prompt_templates FOR UPDATE TO authenticated USING ((auth.role() = 'authenticated')) WITH CHECK ((auth.role() = 'authenticated'));

-- Roles
CREATE POLICY "Authenticated users can view roles" ON public.roles FOR SELECT TO authenticated USING (true);

-- Scheduled emails
CREATE POLICY "Authenticated users can manage emails" ON public.scheduled_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view emails" ON public.scheduled_emails FOR SELECT TO authenticated USING (true);

-- SendGrid config
CREATE POLICY "Authenticated users can view config" ON public.sendgrid_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage config" ON public.sendgrid_config FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Skills
CREATE POLICY "Authenticated users can manage skills" ON public.skills FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view skills" ON public.skills FOR SELECT TO authenticated USING (true);

-- System settings
CREATE POLICY "Admins can manage system_settings" ON public.system_settings FOR ALL USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "Anyone can read system_settings" ON public.system_settings FOR SELECT USING (true);

-- Task attachments
CREATE POLICY "Authenticated users can read task_attachments" ON public.task_attachments FOR SELECT USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users can upload task_attachments" ON public.task_attachments FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Uploaders and admins can delete task_attachments" ON public.task_attachments FOR DELETE USING (((uploaded_by = auth.uid()) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role))));

-- Task categories
CREATE POLICY "Admins can manage task_categories" ON public.task_categories FOR ALL USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "Anyone authenticated can read task_categories" ON public.task_categories FOR SELECT USING ((auth.uid() IS NOT NULL));

-- Task comments
CREATE POLICY "Authenticated users can create task_comments" ON public.task_comments FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users can read task_comments" ON public.task_comments FOR SELECT USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Comment authors and admins can delete comments" ON public.task_comments FOR DELETE USING (((user_id = auth.uid()) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role))));
CREATE POLICY "Comment authors can update their comments" ON public.task_comments FOR UPDATE USING ((user_id = auth.uid()));

-- Task contributors
CREATE POLICY "Authenticated users can read task_contributors" ON public.task_contributors FOR SELECT USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Task assignees and admins can manage task_contributors" ON public.task_contributors FOR ALL USING (((EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_contributors.task_id AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid()))) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role))));

-- Task stream members
CREATE POLICY "Members can read their stream memberships" ON public.task_stream_members FOR SELECT USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Stream owners and admins can manage members" ON public.task_stream_members FOR ALL USING (((EXISTS (SELECT 1 FROM task_stream_members sm WHERE sm.stream_id = task_stream_members.stream_id AND sm.user_id = auth.uid() AND sm.role = ANY (ARRAY['owner', 'admin']))) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role))));

-- Task streams
CREATE POLICY "Authenticated users can create task_streams" ON public.task_streams FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Authenticated users can read task_streams" ON public.task_streams FOR SELECT USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Stream creators and admins can update task_streams" ON public.task_streams FOR UPDATE USING (((created_by = auth.uid()) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role))));

-- Tasks
CREATE POLICY "Users can create tasks" ON public.tasks FOR INSERT WITH CHECK ((auth.uid() = created_by));
CREATE POLICY "Users can delete tasks they created" ON public.tasks FOR DELETE USING ((auth.uid() = created_by));
CREATE POLICY "Users can update their tasks" ON public.tasks FOR UPDATE TO authenticated USING (((assigned_to = auth.uid()) OR (created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))) WITH CHECK (((assigned_to = auth.uid()) OR (created_by = auth.uid()) OR (assigned_to = created_by) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Users can view all tasks" ON public.tasks FOR SELECT USING ((auth.uid() IS NOT NULL));

-- Unified documents
CREATE POLICY "Admins can manage all unified_documents" ON public.unified_documents FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can delete own user docs" ON public.unified_documents FOR DELETE TO authenticated USING (((owner_type = 'user') AND (owner_id = auth.uid())));
CREATE POLICY "Users can insert own user docs" ON public.unified_documents FOR INSERT TO authenticated WITH CHECK (((owner_type = 'user') AND (owner_id = auth.uid())));
CREATE POLICY "Users can update own user docs" ON public.unified_documents FOR UPDATE TO authenticated USING (((owner_type = 'user') AND (owner_id = auth.uid()))) WITH CHECK (((owner_type = 'user') AND (owner_id = auth.uid())));
CREATE POLICY "Users can view unified_documents" ON public.unified_documents FOR SELECT TO authenticated USING ((((owner_type = 'user') AND (owner_id = auth.uid())) OR (owner_type = ANY (ARRAY['common', 'project', 'client', 'deal'])) OR has_role(auth.uid(), 'admin'::app_role)));

-- User invites
CREATE POLICY "Admins can manage invites" ON public.user_invites FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- User knowledge files
CREATE POLICY "Users can manage own knowledge" ON public.user_knowledge_files FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own knowledge" ON public.user_knowledge_files FOR SELECT TO authenticated USING ((auth.uid() = user_id));

-- User Microsoft Teams
CREATE POLICY "Users can delete own teams" ON public.user_microsoft_teams FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own teams" ON public.user_microsoft_teams FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update own teams" ON public.user_microsoft_teams FOR UPDATE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own teams" ON public.user_microsoft_teams FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can delete own channels" ON public.user_microsoft_teams_channels FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own channels" ON public.user_microsoft_teams_channels FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update own channels" ON public.user_microsoft_teams_channels FOR UPDATE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own channels" ON public.user_microsoft_teams_channels FOR SELECT TO authenticated USING ((auth.uid() = user_id));

-- User module permissions
CREATE POLICY "Admins can delete module permissions" ON public.user_module_permissions FOR DELETE USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "Admins can insert module permissions" ON public.user_module_permissions FOR INSERT WITH CHECK ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "Admins can read all module permissions" ON public.user_module_permissions FOR SELECT USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "Users can read own module permissions" ON public.user_module_permissions FOR SELECT USING ((auth.uid() = user_id));

-- User OAuth tokens
CREATE POLICY "Users can create their own oauth tokens" ON public.user_oauth_tokens FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own oauth tokens" ON public.user_oauth_tokens FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "Users can update their own oauth tokens" ON public.user_oauth_tokens FOR UPDATE USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own oauth tokens" ON public.user_oauth_tokens FOR SELECT USING ((auth.uid() = user_id));

-- User preferences
CREATE POLICY "Admins can view all preferences" ON public.user_preferences FOR SELECT USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role)));
CREATE POLICY "System can manage preferences" ON public.user_preferences FOR ALL USING ((user_id = auth.uid()));
CREATE POLICY "Users can view their preferences" ON public.user_preferences FOR SELECT USING ((user_id = auth.uid()));

-- User role preferences
CREATE POLICY "admins_read_all_role_prefs" ON public.user_role_preferences FOR SELECT TO authenticated USING ((EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role)));
CREATE POLICY "users_manage_own_role_prefs" ON public.user_role_preferences FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

-- User roles
CREATE POLICY "Admins can manage user roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all user roles" ON public.user_roles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));

-- Vector search logs
CREATE POLICY "Authenticated users can view search logs" ON public.vector_search_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create search logs" ON public.vector_search_logs FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

-- Zoom files
CREATE POLICY "Admins can manage all zoom files" ON public.zoom_files FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view zoom files" ON public.zoom_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage zoom files for their meetings" ON public.zoom_files FOR ALL TO authenticated USING ((EXISTS (SELECT 1 FROM meetings WHERE meetings.id = zoom_files.meeting_id AND meetings.organizer_id = auth.uid())));

-- ============================================================
-- 8. DATABASE FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_user_microsoft_teams_timestamp()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.update_graph_webhook_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.agent_conversations
  SET message_count = message_count + 1, last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.refresh_conversation_stats(p_conversation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.agent_conversations
  SET message_count = (SELECT count(*)::integer FROM public.agent_messages WHERE conversation_id = p_conversation_id),
      last_message_at = (SELECT max(created_at) FROM public.agent_messages WHERE conversation_id = p_conversation_id),
      updated_at = now()
  WHERE id = p_conversation_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_user_modules()
RETURNS TABLE(slug text, name text, icon text, category text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE has_restrictions BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM user_module_permissions WHERE user_id = auth.uid()) INTO has_restrictions;
  IF has_restrictions THEN
    RETURN QUERY SELECT m.slug, m.name, m.icon, m.category FROM app_modules m
    INNER JOIN user_module_permissions p ON p.module_id = m.id
    WHERE p.user_id = auth.uid() AND m.is_active = true ORDER BY m.sort_order;
  ELSE
    RETURN QUERY SELECT m.slug, m.name, m.icon, m.category FROM app_modules m
    WHERE m.is_active = true ORDER BY m.sort_order;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.match_embeddings(
  query_embedding extensions.vector, match_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 10, filter_entity_type text DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL, p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, entity_type text, entity_id text, content text, metadata jsonb, user_id uuid, similarity double precision, unified_document_id uuid)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.entity_type, e.entity_id::text, e.content, e.metadata, e.user_id,
    (1 - (e.embedding <=> query_embedding))::float as similarity, e.unified_document_id
  FROM public.embeddings e
  WHERE (1 - (e.embedding <=> query_embedding)) > match_threshold
    AND (filter_entity_type IS NULL OR e.entity_type = filter_entity_type)
    AND (COALESCE(filter_user_id, p_user_id) IS NULL OR e.user_id = COALESCE(filter_user_id, p_user_id))
  ORDER BY e.embedding <=> query_embedding LIMIT match_count;
END; $$;

CREATE OR REPLACE FUNCTION public.update_plan_metrics_on_step_completion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE agent_execution_plans SET
      total_tokens_used = total_tokens_used + COALESCE(NEW.tokens_used, 0),
      total_cost = total_cost + COALESCE(NEW.cost, 0),
      current_step_number = GREATEST(current_step_number, NEW.step_number),
      updated_at = NOW()
    WHERE id = NEW.plan_id;
  END IF;
  IF NEW.status = 'completed' THEN
    PERFORM update_plan_status_if_all_steps_done(NEW.plan_id);
  END IF;
  IF NEW.status = 'failed' AND NEW.retry_count >= NEW.max_retries THEN
    UPDATE agent_execution_plans SET status = 'failed', completed_at = NOW(), updated_at = NOW()
    WHERE id = NEW.plan_id AND status = 'executing';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.update_plan_status_if_all_steps_done(p_plan_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE total_steps_count INTEGER; completed_steps_count INTEGER; failed_steps_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_steps_count FROM agent_execution_steps WHERE plan_id = p_plan_id;
  SELECT COUNT(*) INTO completed_steps_count FROM agent_execution_steps WHERE plan_id = p_plan_id AND status = 'completed';
  SELECT COUNT(*) INTO failed_steps_count FROM agent_execution_steps WHERE plan_id = p_plan_id AND status = 'failed' AND retry_count >= max_retries;
  IF completed_steps_count = total_steps_count THEN
    UPDATE agent_execution_plans SET status = 'completed', success = TRUE, completed_at = NOW(),
      execution_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000, updated_at = NOW()
    WHERE id = p_plan_id AND status = 'executing';
  END IF;
  IF failed_steps_count > 0 THEN
    UPDATE agent_execution_plans SET status = 'failed', success = FALSE, completed_at = NOW(),
      execution_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000, updated_at = NOW()
    WHERE id = p_plan_id AND status = 'executing';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.get_relevant_memories(
  p_agent_id uuid, p_user_id uuid, p_query_embedding extensions.vector,
  p_memory_types text[] DEFAULT ARRAY['short_term', 'long_term', 'episodic'],
  p_limit integer DEFAULT 10, p_similarity_threshold double precision DEFAULT 0.7
)
RETURNS TABLE(memory_id uuid, content text, memory_type text, similarity double precision, importance_score double precision, created_at timestamptz)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY SELECT m.id, m.content, m.memory_type,
    1 - (m.embedding <=> p_query_embedding) AS similarity, m.importance_score, m.created_at
  FROM agent_memories m
  WHERE m.agent_id = p_agent_id AND m.user_id = p_user_id AND m.is_active = TRUE
    AND m.memory_type = ANY(p_memory_types)
    AND (1 - (m.embedding <=> p_query_embedding)) >= p_similarity_threshold
  ORDER BY (1 - (m.embedding <=> p_query_embedding)) DESC, m.importance_score DESC
  LIMIT p_limit;
END; $$;

CREATE OR REPLACE FUNCTION public.consolidate_short_term_memories(p_agent_id uuid, p_user_id uuid, p_days_old integer DEFAULT 7)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE consolidated_count INTEGER := 0;
BEGIN
  UPDATE agent_memories SET memory_type = 'long_term', consolidated = TRUE, updated_at = NOW()
  WHERE agent_id = p_agent_id AND user_id = p_user_id AND memory_type = 'short_term'
    AND is_active = TRUE AND created_at < NOW() - (p_days_old || ' days')::INTERVAL
    AND importance_score >= 0.3 AND access_count > 0;
  GET DIAGNOSTICS consolidated_count = ROW_COUNT;
  RETURN consolidated_count;
END; $$;

CREATE OR REPLACE FUNCTION public.prune_short_term_memories(p_agent_id uuid, p_user_id uuid, p_days_old integer DEFAULT 30, p_importance_threshold double precision DEFAULT 0.2)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE pruned_count INTEGER := 0;
BEGIN
  UPDATE agent_memories SET is_active = FALSE, updated_at = NOW()
  WHERE agent_id = p_agent_id AND user_id = p_user_id AND memory_type = 'short_term'
    AND is_active = TRUE AND created_at < NOW() - (p_days_old || ' days')::INTERVAL
    AND importance_score < p_importance_threshold AND access_count < 2;
  GET DIAGNOSTICS pruned_count = ROW_COUNT;
  RETURN pruned_count;
END; $$;

CREATE OR REPLACE FUNCTION public.boost_memory_importance(p_memory_id uuid, p_boost_amount double precision DEFAULT 0.1)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE agent_memories SET importance_score = LEAST(1.0, importance_score + p_boost_amount),
    access_count = access_count + 1, last_accessed_at = NOW(), updated_at = NOW()
  WHERE id = p_memory_id;
END; $$;

CREATE OR REPLACE FUNCTION public.update_memory_access()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.access_count = OLD.access_count + 1;
  NEW.last_accessed_at = NOW();
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.update_mcp_tool_stats()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'success' THEN
    UPDATE mcp_tools SET total_executions = total_executions + 1, successful_executions = successful_executions + 1,
      avg_execution_time_ms = (COALESCE(avg_execution_time_ms * total_executions, 0) + NEW.execution_time_ms) / (total_executions + 1),
      last_executed_at = NEW.completed_at, updated_at = NOW()
    WHERE id = NEW.tool_id;
  ELSIF NEW.status = 'failed' THEN
    UPDATE mcp_tools SET total_executions = total_executions + 1, failed_executions = failed_executions + 1, updated_at = NOW()
    WHERE id = NEW.tool_id;
  END IF;
  UPDATE mcp_servers SET total_tool_calls = total_tool_calls + 1, last_used_at = NEW.completed_at, updated_at = NOW()
  WHERE id = NEW.server_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_exec_sql(sql_content text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth', 'extensions' AS $$
DECLARE err_detail TEXT; err_hint TEXT;
BEGIN
  EXECUTE sql_content;
  RETURN jsonb_build_object('success', true, 'message', 'SQL executed successfully');
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS err_detail = PG_EXCEPTION_DETAIL, err_hint = PG_EXCEPTION_HINT;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'state', SQLSTATE, 'detail', COALESCE(err_detail, ''), 'hint', COALESCE(err_hint, ''));
END; $$;

CREATE OR REPLACE FUNCTION public.sync_pod_employees_from_hr()
RETURNS TABLE(pod_id uuid, employees_synced integer, employees_with_login integer, employees_without_login integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_pod RECORD; v_employee RECORD; v_user_id UUID; v_synced_count INTEGER; v_with_login_count INTEGER; v_without_login_count INTEGER;
BEGIN
  FOR v_pod IN SELECT id FROM pods WHERE is_active = true LOOP
    v_synced_count := 0; v_with_login_count := 0; v_without_login_count := 0;
    FOR v_employee IN SELECT DISTINCT ep.employee_id, ep.pod_id FROM employee_pods ep WHERE ep.pod_id = v_pod.id AND ep.synced_from_hr = true LOOP
      SELECT user_id INTO v_user_id FROM employee_profiles WHERE id::text = v_employee.employee_id::text LIMIT 1;
      IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM profiles WHERE email = (SELECT email FROM employee_profiles WHERE id::text = v_employee.employee_id::text) LIMIT 1;
      END IF;
      INSERT INTO pod_employees (pod_id, employee_id, user_id, has_login, source, is_active)
      VALUES (v_employee.pod_id, v_employee.employee_id, v_user_id, v_user_id IS NOT NULL, 'synced', true)
      ON CONFLICT (pod_id, employee_id) DO UPDATE SET user_id = EXCLUDED.user_id, has_login = EXCLUDED.has_login, updated_at = now()
      WHERE pod_employees.source = 'synced';
      v_synced_count := v_synced_count + 1;
      IF v_user_id IS NOT NULL THEN v_with_login_count := v_with_login_count + 1;
      ELSE v_without_login_count := v_without_login_count + 1; END IF;
    END LOOP;
    RETURN QUERY SELECT v_pod.id, v_synced_count, v_with_login_count, v_without_login_count;
  END LOOP;
END; $$;

-- Contact scoring functions
CREATE OR REPLACE FUNCTION public.calculate_contact_lead_score(contact_id uuid)
RETURNS TABLE(total_score integer, temperature text, engagement_score integer, profile_score integer, deal_potential_score integer, recency_score integer)
LANGUAGE plpgsql STABLE AS $$
DECLARE v_profile_score INTEGER := 0; v_recency_score INTEGER := 0; v_engagement_score INTEGER; v_deal_potential_score INTEGER; v_total_score INTEGER; v_temperature TEXT; v_last_contact TIMESTAMPTZ; v_days_since NUMERIC;
BEGIN
  SELECT COALESCE(c.engagement_score, 0), COALESCE(c.deal_potential_score, 0), c.last_contact_date INTO v_engagement_score, v_deal_potential_score, v_last_contact FROM contacts c WHERE c.id = contact_id;
  IF (SELECT email IS NOT NULL FROM contacts WHERE id = contact_id) THEN v_profile_score := v_profile_score + 4; END IF;
  IF (SELECT phone IS NOT NULL FROM contacts WHERE id = contact_id) THEN v_profile_score := v_profile_score + 4; END IF;
  IF (SELECT linkedin_url IS NOT NULL FROM contacts WHERE id = contact_id) THEN v_profile_score := v_profile_score + 6; END IF;
  IF (SELECT title IS NOT NULL FROM contacts WHERE id = contact_id) THEN v_profile_score := v_profile_score + 3; END IF;
  IF (SELECT c.department IS NOT NULL FROM contacts c WHERE c.id = contact_id) THEN v_profile_score := v_profile_score + 3; END IF;
  IF v_last_contact IS NOT NULL THEN
    v_days_since := EXTRACT(DAY FROM NOW() - v_last_contact);
    IF v_days_since <= 7 THEN v_recency_score := 10; ELSIF v_days_since <= 14 THEN v_recency_score := 8;
    ELSIF v_days_since <= 30 THEN v_recency_score := 6; ELSIF v_days_since <= 60 THEN v_recency_score := 4;
    ELSIF v_days_since <= 90 THEN v_recency_score := 2; ELSE v_recency_score := 0; END IF;
  END IF;
  v_total_score := LEAST(100, v_profile_score + v_recency_score + v_engagement_score + v_deal_potential_score);
  IF v_total_score >= 67 THEN v_temperature := 'hot'; ELSIF v_total_score >= 34 THEN v_temperature := 'warm'; ELSE v_temperature := 'cold'; END IF;
  RETURN QUERY SELECT v_total_score, v_temperature, v_engagement_score, v_profile_score, v_deal_potential_score, v_recency_score;
END; $$;

CREATE OR REPLACE FUNCTION public.update_contact_lead_score()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE score_data RECORD;
BEGIN
  IF NEW.is_lead_follow_up THEN
    SELECT * INTO score_data FROM calculate_contact_lead_score(NEW.id);
    NEW.lead_score := score_data.total_score; NEW.lead_temperature := score_data.temperature;
    NEW.profile_score := score_data.profile_score; NEW.recency_score := score_data.recency_score;
    NEW.last_score_calculated_at := NOW();
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.calculate_next_followup_date()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_lead_follow_up AND NEW.last_contact_date IS NOT NULL THEN
    NEW.next_followup_date := NEW.last_contact_date + (COALESCE(NEW.followup_interval_days, 7) || ' days')::INTERVAL;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.update_contact_on_activity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE contacts SET last_contact_date = NOW(), updated_at = NOW() WHERE id = NEW.contact_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.refresh_contact_ai_summary(p_contact_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE contact_ai_summaries SET expires_at = NOW() + INTERVAL '24 hours', updated_at = NOW() WHERE contact_id = p_contact_id;
END; $$;

CREATE OR REPLACE FUNCTION public.is_contact_ai_summary_expired(p_contact_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE expired BOOLEAN;
BEGIN
  SELECT (expires_at < NOW()) INTO expired FROM contact_ai_summaries WHERE contact_id = p_contact_id LIMIT 1;
  RETURN COALESCE(expired, true);
END; $$;

CREATE OR REPLACE FUNCTION public.increment_template_usage(template_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE contact_email_templates SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = template_id;
END; $$;

CREATE OR REPLACE FUNCTION public.replace_template_variables(template_body text, variables_json jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE result TEXT := template_body; var_key TEXT; var_value TEXT;
BEGIN
  FOR var_key, var_value IN SELECT key, value FROM jsonb_each_text(variables_json) LOOP
    result := REPLACE(result, '{{' || var_key || '}}', var_value);
  END LOOP;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.update_knowledge_search_vector()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.summary, ''));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.update_contact_on_email_sent()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'sent' AND NEW.contact_id IS NOT NULL THEN
    UPDATE contacts SET last_contact_date = NOW(), updated_at = NOW() WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.process_sendgrid_event(
  p_event_type text, p_sendgrid_message_id text, p_contact_id uuid,
  p_clicked_url text DEFAULT NULL, p_user_agent text DEFAULT NULL,
  p_ip_address text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_event_id UUID; v_log_id UUID;
BEGIN
  SELECT id INTO v_log_id FROM email_logs WHERE provider_message_id = p_sendgrid_message_id LIMIT 1;
  INSERT INTO email_tracking_events (contact_id, event_type, clicked_url, user_agent, ip_address, sendgrid_message_id, metadata)
  VALUES (p_contact_id, p_event_type, p_clicked_url, p_user_agent, p_ip_address, p_sendgrid_message_id, p_metadata)
  RETURNING id INTO v_event_id;
  IF p_event_type = 'delivered' THEN UPDATE email_logs SET delivered_at = NOW() WHERE id = v_log_id;
  ELSIF p_event_type = 'opened' THEN UPDATE email_logs SET opened_at = NOW() WHERE id = v_log_id AND opened_at IS NULL;
  ELSIF p_event_type = 'clicked' THEN UPDATE email_logs SET clicked_at = NOW() WHERE id = v_log_id AND clicked_at IS NULL;
  ELSIF p_event_type IN ('bounced', 'spam_report') THEN
    UPDATE email_logs SET status = CASE WHEN p_event_type = 'bounced' THEN 'bounced' ELSE 'rejected' END WHERE id = v_log_id;
  END IF;
  RETURN v_event_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_latest_contact_intent_analysis(p_contact_id uuid)
RETURNS TABLE(id uuid, intent_status text, momentum_score integer, confidence text, momentum_signals jsonb, decay_signals jsonb, days_since_activity integer, reasoning text, suggested_action text, analyzed_at timestamptz)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY SELECT lia.id, lia.intent_status, lia.momentum_score, lia.confidence, lia.momentum_signals, lia.decay_signals,
    lia.days_since_activity, lia.reasoning, lia.suggested_action, lia.analyzed_at
  FROM lead_intent_analysis lia WHERE lia.contact_id = p_contact_id ORDER BY lia.analyzed_at DESC LIMIT 1;
END; $$;

CREATE OR REPLACE FUNCTION public.get_latest_contact_mood_analysis(p_contact_id uuid)
RETURNS TABLE(id uuid, mood_score integer, mood_label text, confidence text, key_signals jsonb, reasoning text, suggested_action text, analyzed_at timestamptz)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY SELECT lma.id, lma.mood_score, lma.mood_label, lma.confidence, lma.key_signals, lma.reasoning, lma.suggested_action, lma.analyzed_at
  FROM lead_mood_analysis lma WHERE lma.contact_id = p_contact_id ORDER BY lma.analyzed_at DESC LIMIT 1;
END; $$;

CREATE OR REPLACE FUNCTION public.get_or_create_sendgrid_config()
RETURNS sendgrid_config LANGUAGE plpgsql AS $$
DECLARE config sendgrid_config;
BEGIN
  SELECT * INTO config FROM sendgrid_config LIMIT 1;
  IF config IS NULL THEN
    INSERT INTO sendgrid_config (api_key_encrypted, from_email, from_name, is_enabled, webhook_url, webhook_secret, enable_open_tracking, enable_click_tracking)
    VALUES (NULL, 'noreply@sjinnovation.com', 'SJ Innovation', false, NULL, NULL, true, true)
    RETURNING * INTO config;
  END IF;
  RETURN config;
END; $$;

CREATE OR REPLACE FUNCTION public.match_embeddings_admin(
  query_embedding extensions.vector, match_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 10, filter_entity_type text DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL, filter_project_name text DEFAULT NULL,
  filter_project_manager text DEFAULT NULL, filter_client_name text DEFAULT NULL
)
RETURNS TABLE(id uuid, entity_type text, entity_id text, content text, metadata jsonb, user_id uuid, similarity double precision, unified_document_id uuid, project_name text, project_manager text, client_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT e.id, e.entity_type, e.entity_id::text, e.content, e.metadata, e.user_id,
      (1 - (e.embedding <=> query_embedding))::float AS sim, e.unified_document_id
    FROM public.embeddings e
    WHERE (1 - (e.embedding <=> query_embedding)) > match_threshold
      AND (filter_entity_type IS NULL OR e.entity_type = filter_entity_type)
      AND (filter_user_id IS NULL OR e.user_id = filter_user_id)
    ORDER BY e.embedding <=> query_embedding
    LIMIT CASE WHEN filter_project_name IS NOT NULL AND filter_project_name != ''
      OR filter_project_manager IS NOT NULL AND filter_project_manager != ''
      OR filter_client_name IS NOT NULL AND filter_client_name != ''
    THEN LEAST(500, match_count * 10) ELSE match_count END
  ),
  ctx AS (
    SELECT b.id, b.entity_type, b.entity_id, b.content, b.metadata, b.user_id, b.sim, b.unified_document_id,
      p.name AS proj_name, prof.full_name AS proj_manager, c.name AS cli_name
    FROM base b
    LEFT JOIN public.meeting_transcripts mt ON b.entity_type = 'meeting_transcript' AND b.entity_id::uuid = mt.id
    LEFT JOIN public.meetings m ON mt.meeting_id = m.id
    LEFT JOIN public.clients c ON m.client_id = c.id
    LEFT JOIN public.meeting_assignments ma ON ma.meeting_id = m.id AND ma.entity_type = 'project'
    LEFT JOIN public.projects p ON ma.entity_id = p.id
    LEFT JOIN public.profiles prof ON p.owner_id = prof.id
  )
  SELECT ctx.id, ctx.entity_type, ctx.entity_id, ctx.content, ctx.metadata, ctx.user_id, ctx.sim,
    ctx.unified_document_id, ctx.proj_name, ctx.proj_manager, ctx.cli_name
  FROM ctx
  WHERE (filter_project_name IS NULL OR filter_project_name = '' OR ctx.proj_name ILIKE '%' || filter_project_name || '%')
    AND (filter_project_manager IS NULL OR filter_project_manager = '' OR ctx.proj_manager ILIKE '%' || filter_project_manager || '%')
    AND (filter_client_name IS NULL OR filter_client_name = '' OR ctx.cli_name ILIKE '%' || filter_client_name || '%')
  ORDER BY ctx.sim DESC LIMIT match_count;
END; $$;

-- ============================================================
-- 9. VIEWS
-- ============================================================

CREATE OR REPLACE VIEW public.agent_learning_summary AS
SELECT agent_id, count(*) AS total_events,
  count(*) FILTER (WHERE event_type = 'user_feedback') AS feedback_count,
  count(*) FILTER (WHERE event_type = 'correction') AS correction_count,
  count(*) FILTER (WHERE event_type = 'reinforcement') AS reinforcement_count,
  count(*) FILTER (WHERE feedback_type = 'positive') AS positive_feedback,
  count(*) FILTER (WHERE feedback_type = 'negative') AS negative_feedback
FROM agent_learning_events GROUP BY agent_id;

CREATE OR REPLACE VIEW public.agent_memory_stats AS
SELECT agent_id, count(*) AS total_memories,
  count(*) FILTER (WHERE memory_type = 'short_term') AS short_term_count,
  count(*) FILTER (WHERE memory_type = 'long_term') AS long_term_count,
  count(*) FILTER (WHERE memory_type = 'episodic') AS episodic_count,
  count(*) FILTER (WHERE memory_type = 'semantic') AS semantic_count,
  avg(importance_score) AS avg_importance, sum(access_count) AS total_accesses,
  max(last_accessed_at) AS last_memory_access
FROM agent_memories WHERE is_active = true GROUP BY agent_id;

CREATE OR REPLACE VIEW public.agent_plan_performance AS
SELECT agent_id, count(*) AS total_plans,
  sum(CASE WHEN success = true THEN 1 ELSE 0 END) AS successful_plans,
  sum(CASE WHEN success = false THEN 1 ELSE 0 END) AS failed_plans,
  avg(total_steps) AS avg_steps_per_plan, avg(execution_time_ms) AS avg_execution_time_ms,
  avg(total_tokens_used) AS avg_tokens_per_plan, avg(total_cost) AS avg_cost_per_plan,
  sum(total_cost) AS total_cost
FROM agent_execution_plans WHERE status = ANY (ARRAY['completed', 'failed']) GROUP BY agent_id;

CREATE OR REPLACE VIEW public.agent_step_performance AS
SELECT action_type, count(*) AS total_steps,
  sum(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS successful_steps,
  sum(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_steps,
  avg(execution_time_ms) AS avg_execution_time_ms, avg(retry_count) AS avg_retry_count
FROM agent_execution_steps WHERE status = ANY (ARRAY['completed', 'failed']) GROUP BY action_type;

CREATE OR REPLACE VIEW public.contact_email_engagement AS
SELECT contact_id, count(*) AS total_emails,
  count(CASE WHEN status = 'sent' THEN 1 END) AS emails_sent,
  count(CASE WHEN opened_at IS NOT NULL THEN 1 END) AS emails_opened,
  count(CASE WHEN clicked_at IS NOT NULL THEN 1 END) AS emails_clicked,
  round(CASE WHEN count(CASE WHEN status = 'sent' THEN 1 END) = 0 THEN 0
    ELSE (count(CASE WHEN opened_at IS NOT NULL THEN 1 END)::numeric / count(CASE WHEN status = 'sent' THEN 1 END)::numeric) * 100 END, 2) AS open_rate,
  round(CASE WHEN count(CASE WHEN status = 'sent' THEN 1 END) = 0 THEN 0
    ELSE (count(CASE WHEN clicked_at IS NOT NULL THEN 1 END)::numeric / count(CASE WHEN status = 'sent' THEN 1 END)::numeric) * 100 END, 2) AS click_rate,
  max(sent_at) AS last_email_sent, max(opened_at) AS last_email_opened, max(clicked_at) AS last_email_clicked
FROM email_logs el WHERE contact_id IS NOT NULL GROUP BY contact_id;

CREATE OR REPLACE VIEW public.owner_dashboard_metrics AS
SELECT
  (SELECT COALESCE(sum(deals.value), 0) FROM deals WHERE deals.closed_at >= (now() - '7 days'::interval)) AS revenue_this_week,
  (SELECT COALESCE(round(avg(productivity_records.utilization_pct), 1), 0) FROM productivity_records WHERE productivity_records.week_start = (date_trunc('week', now()))::date) AS team_utilization,
  (SELECT count(*) FROM projects p JOIN project_statuses ps ON ps.id = p.status_id WHERE p.is_archived = false AND ps.slug = 'in_progress') AS projects_in_progress,
  (SELECT count(*) FROM projects WHERE is_at_risk = true AND is_archived = false) AS projects_at_risk,
  (SELECT count(*) FROM clients WHERE status = 'active') AS active_clients,
  (SELECT count(*) FROM profiles WHERE is_active = true) AS active_team_members,
  now() AS generated_at;

CREATE OR REPLACE VIEW public.pm_team_capacity AS
SELECT pm.pod_id, count(DISTINCT pr.employee_email) AS total_team_members,
  sum(CASE WHEN pr.utilization_pct >= 90 THEN 1 ELSE 0 END) AS at_capacity,
  sum(CASE WHEN pr.utilization_pct < 50 THEN 1 ELSE 0 END) AS available,
  round(avg(pr.utilization_pct), 1) AS avg_utilization,
  (date_trunc('week', now()))::date AS week_start
FROM productivity_records pr
JOIN profiles prof ON prof.email = pr.employee_email
JOIN pod_members pm ON pm.user_id = prof.id
WHERE pr.week_start = (date_trunc('week', now()))::date
GROUP BY pm.pod_id;

CREATE OR REPLACE VIEW public.pods_with_stats AS
SELECT p.id, p.name, p.description, p.color, p.is_active, p.show_in_resource_projection,
  p.created_by, p.created_at, p.updated_at,
  count(DISTINCT ep.employee_id) FILTER (WHERE ep.synced_from_hr = true) AS hr_synced_count,
  count(DISTINCT pe.employee_id) FILTER (WHERE pe.is_active = true) AS rp_members_count,
  count(DISTINCT pe.user_id) FILTER (WHERE pe.has_login = true AND pe.is_active = true) AS has_login_count,
  count(DISTINCT pe.employee_id) FILTER (WHERE pe.has_login = false AND pe.is_active = true) AS no_login_count
FROM pods p LEFT JOIN employee_pods ep ON ep.pod_id = p.id LEFT JOIN pod_employees pe ON pe.pod_id = p.id
GROUP BY p.id, p.name, p.description, p.color, p.is_active, p.show_in_resource_projection, p.created_by, p.created_at, p.updated_at;

CREATE OR REPLACE VIEW public.project_risk_summary AS
SELECT p.id, p.name, p.slug, c.name AS client_name, p.end_date, p.expected_completion_date, p.is_at_risk,
  string_agg(DISTINCT prf.flag_type, ', ') AS risk_flags,
  (SELECT count(*) FROM tasks t WHERE t.client_id = p.client_id AND t.status <> ALL (ARRAY['done', 'cancelled'])) AS open_tasks,
  (SELECT max(m.scheduled_at) FROM meetings m WHERE m.client_id = p.client_id) AS last_client_meeting,
  (SELECT max(t.updated_at) FROM tasks t WHERE t.client_id = p.client_id) AS last_activity
FROM projects p LEFT JOIN clients c ON c.id = p.client_id
LEFT JOIN project_at_risk_flags prf ON prf.project_id = p.id AND prf.resolved_at IS NULL
WHERE p.is_archived = false
GROUP BY p.id, p.name, p.slug, c.name, p.end_date, p.expected_completion_date, p.is_at_risk;

CREATE OR REPLACE VIEW public.user_preference_coverage AS
SELECT user_id, count(*) AS total_preferences,
  count(*) FILTER (WHERE learned_from = 'explicit') AS explicit_count,
  count(*) FILTER (WHERE learned_from = 'observed') AS observed_count,
  count(*) FILTER (WHERE learned_from = 'inferred') AS inferred_count,
  avg(confidence_score) AS avg_confidence, sum(times_used) AS total_usage
FROM user_preferences WHERE is_active = true GROUP BY user_id;

-- ============================================================
-- 10. TRIGGERS (create after functions and tables)
-- ============================================================

-- Auto-create profile on new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update conversation stats on new message
CREATE TRIGGER update_conversation_stats
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_on_new_message();

-- Update knowledge search vector
CREATE TRIGGER knowledge_entries_search_vector_trigger
  BEFORE INSERT OR UPDATE ON public.knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_knowledge_search_vector();

-- Contact lead scoring triggers
CREATE TRIGGER trigger_update_contact_lead_score
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_contact_lead_score();

CREATE TRIGGER trigger_calculate_next_followup_date
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.calculate_next_followup_date();

CREATE TRIGGER trigger_update_contact_on_activity
  AFTER INSERT ON public.contact_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_contact_on_activity();

-- MCP tool stats
CREATE TRIGGER trigger_update_mcp_tool_stats
  AFTER UPDATE OF status ON public.mcp_tool_executions
  FOR EACH ROW WHEN (NEW.status IN ('success', 'failed'))
  EXECUTE FUNCTION public.update_mcp_tool_stats();

-- Agent execution step completion
CREATE TRIGGER trigger_update_plan_metrics
  AFTER UPDATE OF status ON public.agent_execution_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_plan_metrics_on_step_completion();

-- ============================================================
-- DONE! Schema export complete.
-- ============================================================
