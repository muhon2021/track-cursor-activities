-- ============================================================================
-- Meetings Module Replication Alignment Migration
-- ============================================================================
-- Aligns existing meetings schema with V2 replication guide by:
-- 1. Adding missing tables (external participants, action items,
--    assignment suggestions, client_meetings, contact_meeting_links)
-- 2. Adding missing columns to existing tables
-- 3. Adding indexes and RLS policies
-- ============================================================================

-- ========================
-- 1. meeting_external_participants
-- External (non-system) participant records
-- ========================
CREATE TABLE IF NOT EXISTS meeting_external_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,

  external_email TEXT NOT NULL,
  external_name TEXT,

  role TEXT NOT NULL DEFAULT 'optional'
    CHECK (role IN ('organizer', 'required', 'optional')),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'tentative')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_external_participants_meeting_id
  ON meeting_external_participants(meeting_id);

ALTER TABLE meeting_external_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view external participants"
  ON meeting_external_participants FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage external participants"
  ON meeting_external_participants FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_meeting_external_participants_updated_at
  BEFORE UPDATE ON meeting_external_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================
-- 2. meeting_action_items
-- Action items extracted from transcripts, linked to tasks
-- ========================
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,

  text TEXT NOT NULL,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_email TEXT,
  due_date DATE,
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),

  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed')),

  extracted_from_transcript BOOLEAN DEFAULT false,
  extraction_confidence NUMERIC(3,2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting_id
  ON meeting_action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_task_id
  ON meeting_action_items(task_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_assignee_id
  ON meeting_action_items(assignee_id);

ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view action items"
  ON meeting_action_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage action items"
  ON meeting_action_items FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_meeting_action_items_updated_at
  BEFORE UPDATE ON meeting_action_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================
-- 3. meeting_assignment_suggestions
-- AI suggestions for meeting→entity relationship assignment
-- ========================
CREATE TABLE IF NOT EXISTS meeting_assignment_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,

  suggested_type TEXT NOT NULL
    CHECK (suggested_type IN ('client', 'project', 'pod')),
  suggested_id UUID NOT NULL,
  confidence NUMERIC(3,2),
  reasoning TEXT,

  review_status TEXT DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_assignment_suggestions_meeting_id
  ON meeting_assignment_suggestions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_assignment_suggestions_review_status
  ON meeting_assignment_suggestions(review_status);

ALTER TABLE meeting_assignment_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assignment suggestions"
  ON meeting_assignment_suggestions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage assignment suggestions"
  ON meeting_assignment_suggestions FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_meeting_assignment_suggestions_updated_at
  BEFORE UPDATE ON meeting_assignment_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================
-- 4. client_meetings
-- Client ↔ Meeting many-to-many association table
-- ========================
CREATE TABLE IF NOT EXISTS client_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(client_id, meeting_id)
);

CREATE INDEX IF NOT EXISTS idx_client_meetings_client_id
  ON client_meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_client_meetings_meeting_id
  ON client_meetings(meeting_id);

ALTER TABLE client_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view client meetings"
  ON client_meetings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage client meetings"
  ON client_meetings FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ========================
-- 5. contact_meeting_links
-- Contact ↔ Meeting relationship
-- ========================
CREATE TABLE IF NOT EXISTS contact_meeting_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(contact_id, meeting_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_meeting_links_contact_id
  ON contact_meeting_links(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_meeting_links_meeting_id
  ON contact_meeting_links(meeting_id);

ALTER TABLE contact_meeting_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contact meeting links"
  ON contact_meeting_links FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage contact meeting links"
  ON contact_meeting_links FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ========================
-- 6. Alter meeting_participants — add response_at
-- ========================
ALTER TABLE meeting_participants
  ADD COLUMN IF NOT EXISTS response_at TIMESTAMPTZ;

-- ========================
-- 7. Alter meeting_agenda_items — add assigned_to
-- ========================
ALTER TABLE meeting_agenda_items
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ========================
-- 8. Alter meeting_takeaways — add priority and status columns
-- ========================
ALTER TABLE meeting_takeaways
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled'));

-- ========================
-- 9. Alter meeting_files — add assignment workflow columns
-- ========================
ALTER TABLE meeting_files
  ADD COLUMN IF NOT EXISTS assignment_status TEXT DEFAULT 'unreviewed'
    CHECK (assignment_status IN ('unreviewed', 'pending_review', 'assigned', 'rejected')),
  ADD COLUMN IF NOT EXISTS assignment_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS suggested_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suggested_project_id UUID,
  ADD COLUMN IF NOT EXISTS suggested_pod_id UUID REFERENCES pods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignment_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_meeting_files_assignment_status
  ON meeting_files(assignment_status);

-- ========================
-- 10. Alter meeting_categorizations — add replication guide columns
-- ========================
ALTER TABLE meeting_categorizations
  ADD COLUMN IF NOT EXISTS meeting_type TEXT,
  ADD COLUMN IF NOT EXISTS related_clients JSONB,
  ADD COLUMN IF NOT EXISTS related_projects JSONB,
  ADD COLUMN IF NOT EXISTS related_pods JSONB,
  ADD COLUMN IF NOT EXISTS tags JSONB;

-- ========================
-- 11. Alter meetings — add deal_id, pod_id, recording_url,
--     transcript_content, transcript_text, embedding_status, is_external
-- ========================
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES pods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS transcript_content TEXT,
  ADD COLUMN IF NOT EXISTS transcript_text TEXT,
  ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_external BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categorization_data JSONB,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT;

CREATE INDEX IF NOT EXISTS idx_meetings_deal_id ON meetings(deal_id);
CREATE INDEX IF NOT EXISTS idx_meetings_pod_id ON meetings(pod_id);
CREATE INDEX IF NOT EXISTS idx_meetings_parent_meeting_id ON meetings(parent_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_client_id ON meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(organizer_id);

-- ========================
-- Done
-- ========================
