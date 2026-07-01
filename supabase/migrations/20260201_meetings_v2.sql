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
