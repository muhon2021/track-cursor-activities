-- 20260211173000_okr_parity_foundation.sql
-- OKR parity foundation (additive, non-breaking)
-- Adds compatibility table + helper functions used by OKR workflows.

CREATE TABLE IF NOT EXISTS key_result_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_result_id UUID NOT NULL REFERENCES okr_key_results(id) ON DELETE CASCADE,
  previous_value NUMERIC,
  new_value NUMERIC NOT NULL,
  notes TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_key_result_history_kr_id ON key_result_history(key_result_id);
CREATE INDEX IF NOT EXISTS idx_key_result_history_updated_at ON key_result_history(updated_at DESC);

ALTER TABLE key_result_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view key result history" ON key_result_history;
CREATE POLICY "Authenticated users can view key result history"
  ON key_result_history FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert key result history" ON key_result_history;
CREATE POLICY "Authenticated users can insert key result history"
  ON key_result_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION calculate_next_update_due(
  last_update TIMESTAMPTZ,
  update_freq TEXT
)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN update_freq = 'daily' THEN COALESCE(last_update, now()) + INTERVAL '1 day'
    WHEN update_freq = 'biweekly' THEN COALESCE(last_update, now()) + INTERVAL '14 day'
    WHEN update_freq = 'monthly' THEN COALESCE(last_update, now()) + INTERVAL '30 day'
    ELSE COALESCE(last_update, now()) + INTERVAL '7 day'
  END;
$$;

CREATE OR REPLACE FUNCTION calculate_key_result_progress(
  start_val NUMERIC,
  current_val NUMERIC,
  target_val NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  progress NUMERIC;
BEGIN
  IF target_val IS NULL OR start_val IS NULL OR current_val IS NULL THEN
    RETURN 0;
  END IF;

  IF target_val = start_val THEN
    IF current_val >= target_val THEN
      RETURN 100;
    END IF;
    RETURN 0;
  END IF;

  progress := ((current_val - start_val) / (target_val - start_val)) * 100;
  RETURN GREATEST(0, LEAST(100, ROUND(progress, 2)));
END;
$$;


-- 20260211193714_5d88f294-de27-421f-b4cc-1e6a99d9583d.sql
-- Deals Module Fixes Migration (from 20260211_deals_module_fixes.sql)

-- FK Constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deals_client_id_fkey') THEN
    ALTER TABLE deals ADD CONSTRAINT deals_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deals_owner_id_profiles_fkey') THEN
    ALTER TABLE deals ADD CONSTRAINT deals_owner_id_profiles_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deals_created_by_profiles_fkey') THEN
    ALTER TABLE deals ADD CONSTRAINT deals_created_by_profiles_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deal_activities_user_id_profiles_fkey') THEN
    ALTER TABLE deal_activities ADD CONSTRAINT deal_activities_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deal_comments_user_id_profiles_fkey') THEN
    ALTER TABLE deal_comments ADD CONSTRAINT deal_comments_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Contacts: add missing columns
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_status TEXT DEFAULT 'new';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_lead_follow_up BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_followup_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_followup_status ON contacts(followup_status) WHERE is_lead_follow_up = true;

-- Tighten RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage deals" ON deals;
CREATE POLICY "Deal owners and creators can manage deals" ON deals
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (owner_id = auth.uid() OR created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can manage activities" ON deal_activities;
CREATE POLICY "Deal activity authors and deal owners can manage activities" ON deal_activities
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_activities.deal_id AND (deals.owner_id = auth.uid() OR deals.created_by = auth.uid()))
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_activities.deal_id AND (deals.owner_id = auth.uid() OR deals.created_by = auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated users can manage deal comments" ON deal_comments;
CREATE POLICY "Deal comment authors and deal owners can manage comments" ON deal_comments
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_comments.deal_id AND (deals.owner_id = auth.uid() OR deals.created_by = auth.uid()))
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_comments.deal_id AND (deals.owner_id = auth.uid() OR deals.created_by = auth.uid()))
  );

-- 20260211193811_6df1e526-5272-4f9e-9587-8d1cc8f4e5ef.sql
-- Meetings Replication Alignment Migration

-- 1. meeting_external_participants
CREATE TABLE IF NOT EXISTS meeting_external_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  external_email TEXT NOT NULL,
  external_name TEXT,
  role TEXT NOT NULL DEFAULT 'optional' CHECK (role IN ('organizer', 'required', 'optional')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'tentative')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meeting_external_participants_meeting_id ON meeting_external_participants(meeting_id);
ALTER TABLE meeting_external_participants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view external participants' AND tablename = 'meeting_external_participants') THEN
    CREATE POLICY "Authenticated users can view external participants" ON meeting_external_participants FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can manage external participants' AND tablename = 'meeting_external_participants') THEN
    CREATE POLICY "Authenticated users can manage external participants" ON meeting_external_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DROP TRIGGER IF EXISTS update_meeting_external_participants_updated_at ON meeting_external_participants;
CREATE TRIGGER update_meeting_external_participants_updated_at BEFORE UPDATE ON meeting_external_participants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. meeting_action_items
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_email TEXT,
  due_date DATE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  extracted_from_transcript BOOLEAN DEFAULT false,
  extraction_confidence NUMERIC(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting_id ON meeting_action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_task_id ON meeting_action_items(task_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_assignee_id ON meeting_action_items(assignee_id);
ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view action items' AND tablename = 'meeting_action_items') THEN
    CREATE POLICY "Authenticated users can view action items" ON meeting_action_items FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can manage action items' AND tablename = 'meeting_action_items') THEN
    CREATE POLICY "Authenticated users can manage action items" ON meeting_action_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DROP TRIGGER IF EXISTS update_meeting_action_items_updated_at ON meeting_action_items;
CREATE TRIGGER update_meeting_action_items_updated_at BEFORE UPDATE ON meeting_action_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. meeting_assignment_suggestions
CREATE TABLE IF NOT EXISTS meeting_assignment_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  suggested_type TEXT NOT NULL CHECK (suggested_type IN ('client', 'project', 'pod')),
  suggested_id UUID NOT NULL,
  confidence NUMERIC(3,2),
  reasoning TEXT,
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meeting_assignment_suggestions_meeting_id ON meeting_assignment_suggestions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_assignment_suggestions_review_status ON meeting_assignment_suggestions(review_status);
ALTER TABLE meeting_assignment_suggestions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view assignment suggestions' AND tablename = 'meeting_assignment_suggestions') THEN
    CREATE POLICY "Authenticated users can view assignment suggestions" ON meeting_assignment_suggestions FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can manage assignment suggestions' AND tablename = 'meeting_assignment_suggestions') THEN
    CREATE POLICY "Authenticated users can manage assignment suggestions" ON meeting_assignment_suggestions FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DROP TRIGGER IF EXISTS update_meeting_assignment_suggestions_updated_at ON meeting_assignment_suggestions;
CREATE TRIGGER update_meeting_assignment_suggestions_updated_at BEFORE UPDATE ON meeting_assignment_suggestions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. client_meetings
CREATE TABLE IF NOT EXISTS client_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, meeting_id)
);
CREATE INDEX IF NOT EXISTS idx_client_meetings_client_id ON client_meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_client_meetings_meeting_id ON client_meetings(meeting_id);
ALTER TABLE client_meetings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view client meetings' AND tablename = 'client_meetings') THEN
    CREATE POLICY "Authenticated users can view client meetings" ON client_meetings FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can manage client meetings' AND tablename = 'client_meetings') THEN
    CREATE POLICY "Authenticated users can manage client meetings" ON client_meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. contact_meeting_links
CREATE TABLE IF NOT EXISTS contact_meeting_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contact_id, meeting_id)
);
CREATE INDEX IF NOT EXISTS idx_contact_meeting_links_contact_id ON contact_meeting_links(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_meeting_links_meeting_id ON contact_meeting_links(meeting_id);
ALTER TABLE contact_meeting_links ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view contact meeting links' AND tablename = 'contact_meeting_links') THEN
    CREATE POLICY "Authenticated users can view contact meeting links" ON contact_meeting_links FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can manage contact meeting links' AND tablename = 'contact_meeting_links') THEN
    CREATE POLICY "Authenticated users can manage contact meeting links" ON contact_meeting_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Alter existing tables
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS response_at TIMESTAMPTZ;
ALTER TABLE meeting_agenda_items ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- meeting_takeaways: add columns without CHECK (use trigger validation instead to avoid immutability issues)
ALTER TABLE meeting_takeaways ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE meeting_takeaways ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';

-- meeting_files: add assignment workflow columns
ALTER TABLE meeting_files ADD COLUMN IF NOT EXISTS assignment_status TEXT DEFAULT 'unreviewed';
ALTER TABLE meeting_files ADD COLUMN IF NOT EXISTS assignment_confidence NUMERIC(3,2);
ALTER TABLE meeting_files ADD COLUMN IF NOT EXISTS suggested_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE meeting_files ADD COLUMN IF NOT EXISTS suggested_project_id UUID;
ALTER TABLE meeting_files ADD COLUMN IF NOT EXISTS suggested_pod_id UUID REFERENCES pods(id) ON DELETE SET NULL;
ALTER TABLE meeting_files ADD COLUMN IF NOT EXISTS assignment_reasoning TEXT;
ALTER TABLE meeting_files ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE meeting_files ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_meeting_files_assignment_status ON meeting_files(assignment_status);

-- meeting_categorizations: add columns
ALTER TABLE meeting_categorizations ADD COLUMN IF NOT EXISTS meeting_type TEXT;
ALTER TABLE meeting_categorizations ADD COLUMN IF NOT EXISTS related_clients JSONB;
ALTER TABLE meeting_categorizations ADD COLUMN IF NOT EXISTS related_projects JSONB;
ALTER TABLE meeting_categorizations ADD COLUMN IF NOT EXISTS related_pods JSONB;
ALTER TABLE meeting_categorizations ADD COLUMN IF NOT EXISTS tags JSONB;

-- meetings: add new columns
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES pods(id) ON DELETE SET NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS transcript_content TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS transcript_text TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS is_external BOOLEAN DEFAULT false;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT DEFAULT 'none';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMPTZ;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS parent_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS categorization_data JSONB;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS ai_summary TEXT;

CREATE INDEX IF NOT EXISTS idx_meetings_deal_id ON meetings(deal_id);
CREATE INDEX IF NOT EXISTS idx_meetings_pod_id ON meetings(pod_id);
CREATE INDEX IF NOT EXISTS idx_meetings_parent_meeting_id ON meetings(parent_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_client_id ON meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(organizer_id);

-- 20260211222318_e942bf14-2e71-4186-9b76-a9b47004bc75.sql
-- Add missing columns to ai_agents for meetings AI agent seed data
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS welcome_message TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS conversation_starters JSONB;

-- 20260211222507_a8e4a5c5-5f9e-4dc2-b339-e82f5c0c382c.sql
-- Seed 8 AI agents for meetings module
INSERT INTO ai_agents (name, slug, category, description, system_prompt, provider_config, required_role, is_enabled, memory_enabled, avatar, welcome_message, conversation_starters, created_at, updated_at) VALUES
('Meeting Summarizer', 'meeting-summarizer', 'meetings', 'Generates concise, structured summaries from meeting transcripts or notes including key decisions, action items, and open questions.', 'You are an expert meeting summarizer for a professional services company. Given a meeting transcript, notes, or context, produce a structured summary with sections for Summary, Key Decisions, Action Items, Discussion Highlights, Open Questions, and Next Steps. Be factual, use names when speakers are identified, flag unclear items with [UNCLEAR], and note client sentiment for client-facing meetings.', '{"provider": "openai", "model": "gpt-4o", "fallback_provider": "anthropic", "fallback_model": "claude-sonnet-4-20250514", "temperature": 0.2, "max_tokens": 2000}'::jsonb, 'user', true, true, '📝', 'I can help you create structured summaries from your meeting transcripts and notes.', '["Summarize my last meeting", "What were the key decisions?", "Extract action items", "Create a shareable summary"]'::jsonb, NOW(), NOW()),
('Action Item Extractor', 'meeting-action-extractor', 'meetings', 'Extracts actionable tasks from meeting transcripts with assignees, due dates, and priority levels.', 'You are an AI assistant specialized in extracting actionable tasks from meeting transcripts and notes. For each action item provide: task, assignee, assignee_email, due_date, priority (high/medium/low), and confidence (0.0-1.0). Return a JSON array. Only extract genuine commitments, prefer specific descriptions, calculate relative dates from meeting date.', '{"provider": "openai", "model": "gpt-4o", "fallback_provider": "gemini", "fallback_model": "gemini-2.5-pro", "temperature": 0.1, "max_tokens": 1500}'::jsonb, 'user', true, false, '✅', 'I extract action items from meeting transcripts with assignees and due dates.', '["Extract action items", "Who committed to what?", "High-priority follow-ups?", "Find tasks with deadlines"]'::jsonb, NOW(), NOW()),
('Meeting Categorizer', 'meeting-categorizer', 'meetings', 'Automatically categorizes meetings by type, topic, and related entities.', 'You are an AI meeting categorizer for a business management platform. Given meeting details, classify by primary_category (client_engagement, internal, sales, strategic, operational, training), meeting_type, confidence, tags, suggested entity matches, sentiment, and key_topics. Return JSON.', '{"provider": "gemini", "model": "gemini-2.5-flash", "fallback_provider": "openai", "fallback_model": "gpt-4o-mini", "temperature": 0.2, "max_tokens": 1000}'::jsonb, 'user', true, true, '🏷️', 'I categorize meetings by type, topic, and related entities.', '["Categorize this meeting", "What type of meeting is this?", "Which client does this relate to?", "Classify uncategorized meetings"]'::jsonb, NOW(), NOW()),
('Meeting Prep Assistant', 'meeting-prep-assistant', 'meetings', 'Prepares comprehensive briefing documents before meetings.', 'You are a meeting preparation assistant for a professional services company. Before a meeting, compile relevant context to help the attendee be fully prepared. Create a prep document with Meeting Briefing, Background, Previous Meeting Recap, Key Topics to Address, Talking Points, Things to Watch For, and Preparation Checklist.', '{"provider": "openai", "model": "gpt-4o", "fallback_provider": "anthropic", "fallback_model": "claude-sonnet-4-20250514", "temperature": 0.3, "max_tokens": 2000}'::jsonb, 'user', true, true, '📋', 'I help you prepare for meetings by compiling relevant context and talking points.', '["Prep me for my next meeting", "What should I know before this meeting?", "Create a briefing", "Pending action items from last meeting?"]'::jsonb, NOW(), NOW()),
('Transcript Analyzer', 'meeting-transcript-analyzer', 'meetings', 'Performs deep analysis of meeting transcripts: speaker patterns, sentiment, engagement metrics.', 'You are an expert meeting transcript analyst. Analyze transcripts for Speaker Analysis (talk time, contribution type, engagement, sentiment), Conversation Flow, Sentiment Timeline, Risk Signals, Engagement Metrics, and Recommendations. Base all analysis on transcript content, use quantitative measures.', '{"provider": "anthropic", "model": "claude-sonnet-4-20250514", "fallback_provider": "openai", "fallback_model": "gpt-4o", "temperature": 0.3, "max_tokens": 2500}'::jsonb, 'user', true, true, '🔍', 'I perform deep analysis on meeting transcripts — speaker patterns, sentiment, risk signals.', '["Analyze engagement patterns", "What are the risk signals?", "How balanced was participation?", "Track sentiment changes"]'::jsonb, NOW(), NOW()),
('Meeting Follow-Up Generator', 'meeting-followup-generator', 'meetings', 'Drafts professional follow-up emails after meetings.', 'You are a professional email writer specializing in meeting follow-ups. Generate emails with subject line (under 60 chars), opening, summary bullets, decisions, action items table, next steps, and closing. Keep under 300 words, match formality to meeting type.', '{"provider": "openai", "model": "gpt-4o", "fallback_provider": "anthropic", "fallback_model": "claude-sonnet-4-20250514", "temperature": 0.6, "max_tokens": 1000}'::jsonb, 'user', true, true, '✉️', 'I draft professional follow-up emails after your meetings.', '["Draft a follow-up email", "Write a meeting recap", "Create a follow-up for proposal review", "Send a thank-you email"]'::jsonb, NOW(), NOW()),
('Meeting Efficiency Coach', 'meeting-efficiency-coach', 'meetings', 'Analyzes meeting patterns and provides recommendations to improve effectiveness.', 'You are a meeting efficiency consultant. Analyze meeting data and provide Meeting Health Score (0-100), Pattern Analysis, Improvement Recommendations, Meeting Cost Analysis, and Quick Wins. Base recommendations on data, consider team dynamics, distinguish improvement vs elimination.', '{"provider": "openai", "model": "gpt-4o", "fallback_provider": "gemini", "fallback_model": "gemini-2.5-pro", "temperature": 0.4, "max_tokens": 2000}'::jsonb, 'user', true, true, '📊', 'I analyze your meeting patterns and provide data-driven recommendations.', '["How efficient are my meetings?", "Which meetings to eliminate?", "Optimize my schedule?", "ROI of recurring meetings?"]'::jsonb, NOW(), NOW()),
('Client-Meeting Matcher', 'meeting-client-matcher', 'meetings', 'Intelligently matches unassigned meetings to clients, deals, and projects.', 'You are an AI system that matches meetings to business entities (clients, deals, projects). For each match provide entity_type, entity_id, entity_name, confidence (0.0-1.0), reasoning, and evidence. Auto-assign at >=0.80, suggest for review at 0.50-0.79, skip below 0.50.', '{"provider": "gemini", "model": "gemini-2.5-flash", "fallback_provider": "openai", "fallback_model": "gpt-4o-mini", "temperature": 0.1, "max_tokens": 1200}'::jsonb, 'user', true, true, '🔗', 'I match unassigned meetings to the right clients, deals, and projects.', '["Match this meeting to a client", "Which client does this belong to?", "Process unassigned meetings", "Review pending assignments"]'::jsonb, NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, system_prompt = EXCLUDED.system_prompt, provider_config = EXCLUDED.provider_config, avatar = EXCLUDED.avatar, welcome_message = EXCLUDED.welcome_message, conversation_starters = EXCLUDED.conversation_starters, updated_at = NOW();

