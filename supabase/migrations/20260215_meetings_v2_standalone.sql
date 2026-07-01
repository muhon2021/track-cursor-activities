-- ============================================================================
-- Meetings Module V2 Standalone Implementation
-- ============================================================================
-- Creates meetings_v2 table and supporting tables as specified in the
-- standalone implementation plan. This is a complete, self-contained schema.
-- ============================================================================

-- ========================
-- Enums
-- ========================
CREATE TYPE meeting_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE meeting_type AS ENUM ('internal', 'client', 'project', 'l10', 'one_on_one');

-- ========================
-- Table: meetings_v2
-- ========================
CREATE TABLE IF NOT EXISTS meetings_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type meeting_type NOT NULL DEFAULT 'internal',
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  location TEXT,
  timezone TEXT DEFAULT 'UTC',
  status meeting_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  notify_participants BOOLEAN DEFAULT false,
  -- Recurrence
  recurrence_pattern TEXT,          -- 'daily', 'weekly', 'biweekly', 'monthly', 'none'
  recurrence_interval INTEGER DEFAULT 1,
  recurrence_days_of_week INTEGER[],
  recurrence_day_of_month INTEGER,
  recurrence_end_date DATE,
  parent_meeting_id UUID REFERENCES meetings_v2(id),
  -- Relationships
  client_id UUID,                   -- FK to clients
  project_id UUID,                  -- FK to projects
  deal_id UUID,                     -- FK to deals
  -- Content
  recording_url TEXT,
  transcript_content JSONB,
  transcript_text TEXT,
  ai_summary JSONB,
  categorization_confidence NUMERIC,
  is_categorized BOOLEAN DEFAULT false,
  -- Metadata
  slug TEXT UNIQUE,
  created_by UUID,                  -- FK to auth.users
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- Table: meeting_participants_v2
-- ========================
CREATE TABLE IF NOT EXISTS meeting_participants_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings_v2(id) ON DELETE CASCADE,
  user_id UUID,                     -- FK to profiles (NULL for external)
  external_email TEXT,              -- For non-system participants
  external_name TEXT,
  role TEXT NOT NULL DEFAULT 'required',  -- 'organizer', 'required', 'optional'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'tentative'
  attended BOOLEAN DEFAULT false,
  notes TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Table: meeting_agenda_items
-- ========================
CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings_v2(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Table: meeting_takeaways
-- ========================
CREATE TABLE IF NOT EXISTS meeting_takeaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings_v2(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  assigned_to UUID,
  due_date DATE,
  status TEXT DEFAULT 'open',      -- 'open', 'in_progress', 'completed'
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Table: meeting_categorizations
-- ========================
CREATE TABLE IF NOT EXISTS meeting_categorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_file_id UUID REFERENCES meeting_files(id),
  category TEXT,
  confidence NUMERIC,
  is_verified BOOLEAN DEFAULT false,
  verified_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_meetings_v2_slug ON meetings_v2(slug);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_scheduled ON meetings_v2(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_status ON meetings_v2(status);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_type ON meetings_v2(type);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_client ON meetings_v2(client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_project ON meetings_v2(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_created_by ON meetings_v2(created_by);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_parent ON meetings_v2(parent_meeting_id);

CREATE INDEX IF NOT EXISTS idx_participants_v2_meeting ON meeting_participants_v2(meeting_id);
CREATE INDEX IF NOT EXISTS idx_participants_v2_user ON meeting_participants_v2(user_id);

-- Add attended column if it doesn't exist (for existing installations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meeting_participants_v2' AND column_name = 'attended'
  ) THEN
    ALTER TABLE meeting_participants_v2 ADD COLUMN attended BOOLEAN DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agenda_items_meeting ON meeting_agenda_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_agenda_items_order ON meeting_agenda_items(meeting_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_takeaways_meeting ON meeting_takeaways(meeting_id);
CREATE INDEX IF NOT EXISTS idx_takeaways_assigned ON meeting_takeaways(assigned_to);

CREATE INDEX IF NOT EXISTS idx_categorizations_file ON meeting_categorizations(meeting_file_id);

-- ========================
-- RLS Policies
-- ========================
ALTER TABLE meetings_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all meetings" ON meetings_v2
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create meetings" ON meetings_v2
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own meetings" ON meetings_v2
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own meetings" ON meetings_v2
  FOR DELETE USING (auth.uid() = created_by);

ALTER TABLE meeting_participants_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all participants" ON meeting_participants_v2
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage participants" ON meeting_participants_v2
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE meeting_agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all agenda items" ON meeting_agenda_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage agenda items" ON meeting_agenda_items
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE meeting_takeaways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all takeaways" ON meeting_takeaways
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage takeaways" ON meeting_takeaways
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE meeting_categorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all categorizations" ON meeting_categorizations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage categorizations" ON meeting_categorizations
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ========================
-- Update meeting_files table (add missing columns if needed)
-- ========================
DO $$
BEGIN
  -- Add columns to meeting_files if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'slug') THEN
    ALTER TABLE meeting_files ADD COLUMN slug TEXT UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'zoom_meeting_id') THEN
    ALTER TABLE meeting_files ADD COLUMN zoom_meeting_id BIGINT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'zoom_meeting_uuid') THEN
    ALTER TABLE meeting_files ADD COLUMN zoom_meeting_uuid TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'meeting_topic') THEN
    ALTER TABLE meeting_files ADD COLUMN meeting_topic TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'meeting_start_time') THEN
    ALTER TABLE meeting_files ADD COLUMN meeting_start_time TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'host_email') THEN
    ALTER TABLE meeting_files ADD COLUMN host_email TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'host_name') THEN
    ALTER TABLE meeting_files ADD COLUMN host_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'participants_count') THEN
    ALTER TABLE meeting_files ADD COLUMN participants_count INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'duration_minutes') THEN
    ALTER TABLE meeting_files ADD COLUMN duration_minutes INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'meeting_category') THEN
    ALTER TABLE meeting_files ADD COLUMN meeting_category TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'categorization_status') THEN
    ALTER TABLE meeting_files ADD COLUMN categorization_status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'categorization_confidence') THEN
    ALTER TABLE meeting_files ADD COLUMN categorization_confidence NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'categorized_at') THEN
    ALTER TABLE meeting_files ADD COLUMN categorized_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'transcript_summary') THEN
    ALTER TABLE meeting_files ADD COLUMN transcript_summary TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'summary_overview') THEN
    ALTER TABLE meeting_files ADD COLUMN summary_overview TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'next_steps') THEN
    ALTER TABLE meeting_files ADD COLUMN next_steps TEXT[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'ai_processing_status') THEN
    ALTER TABLE meeting_files ADD COLUMN ai_processing_status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'ai_suggestions') THEN
    ALTER TABLE meeting_files ADD COLUMN ai_suggestions JSONB;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'processing_error') THEN
    ALTER TABLE meeting_files ADD COLUMN processing_error TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'last_processed_at') THEN
    ALTER TABLE meeting_files ADD COLUMN last_processed_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'project_id') THEN
    ALTER TABLE meeting_files ADD COLUMN project_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'project_name') THEN
    ALTER TABLE meeting_files ADD COLUMN project_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'project_manager') THEN
    ALTER TABLE meeting_files ADD COLUMN project_manager TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'client_name') THEN
    ALTER TABLE meeting_files ADD COLUMN client_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'client_id') THEN
    ALTER TABLE meeting_files ADD COLUMN client_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'project_match_confidence') THEN
    ALTER TABLE meeting_files ADD COLUMN project_match_confidence NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'assignment_status') THEN
    ALTER TABLE meeting_files ADD COLUMN assignment_status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'assignment_confidence') THEN
    ALTER TABLE meeting_files ADD COLUMN assignment_confidence NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'suggested_client_id') THEN
    ALTER TABLE meeting_files ADD COLUMN suggested_client_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'suggested_project_id') THEN
    ALTER TABLE meeting_files ADD COLUMN suggested_project_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'assignment_reasoning') THEN
    ALTER TABLE meeting_files ADD COLUMN assignment_reasoning TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'reviewed_by') THEN
    ALTER TABLE meeting_files ADD COLUMN reviewed_by UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'reviewed_at') THEN
    ALTER TABLE meeting_files ADD COLUMN reviewed_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'embedding_status') THEN
    ALTER TABLE meeting_files ADD COLUMN embedding_status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'embedding_generated_at') THEN
    ALTER TABLE meeting_files ADD COLUMN embedding_generated_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'embedding_chunks_count') THEN
    ALTER TABLE meeting_files ADD COLUMN embedding_chunks_count INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'meeting_id_v2') THEN
    ALTER TABLE meeting_files ADD COLUMN meeting_id_v2 UUID REFERENCES meetings_v2(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'meeting_type') THEN
    ALTER TABLE meeting_files ADD COLUMN meeting_type TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'zoom_account_name') THEN
    ALTER TABLE meeting_files ADD COLUMN zoom_account_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'zoom_account_id') THEN
    ALTER TABLE meeting_files ADD COLUMN zoom_account_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'deleted_at') THEN
    ALTER TABLE meeting_files ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add indexes for meeting_files new columns
CREATE INDEX IF NOT EXISTS idx_meeting_files_slug ON meeting_files(slug);
CREATE INDEX IF NOT EXISTS idx_meeting_files_zoom_meeting_id ON meeting_files(zoom_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_files_meeting_id_v2 ON meeting_files(meeting_id_v2);
CREATE INDEX IF NOT EXISTS idx_meeting_files_category ON meeting_files(meeting_category);
CREATE INDEX IF NOT EXISTS idx_meeting_files_categorization_status ON meeting_files(categorization_status);
CREATE INDEX IF NOT EXISTS idx_meeting_files_assignment_status ON meeting_files(assignment_status);
CREATE INDEX IF NOT EXISTS idx_meeting_files_embedding_status ON meeting_files(embedding_status);

-- Ensure meeting_files RLS allows authenticated users to read all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'meeting_files' 
    AND policyname = 'Users can read all transcripts'
  ) THEN
    ALTER TABLE meeting_files ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can read all transcripts" ON meeting_files
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

