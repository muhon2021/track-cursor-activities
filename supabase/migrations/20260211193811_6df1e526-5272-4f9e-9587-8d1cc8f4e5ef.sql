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