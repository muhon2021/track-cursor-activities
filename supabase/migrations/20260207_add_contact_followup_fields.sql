-- ============================================================================
-- Add Contact Follow-Up Fields Migration
-- ============================================================================
-- Extends contacts table with comprehensive follow-up tracking, AI analysis
-- cache, and lead scoring fields.
-- ============================================================================

-- Add follow-up tracking columns to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_lead_follow_up BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_status TEXT DEFAULT 'pending'
  CHECK (followup_status IN ('pending', 'contacted', 'scheduled', 'on_hold', 'completed', 'inactive', 'new', 'awaiting_response', 'follow_up_needed', 'engaged', 'nurturing'));

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_interval_days INTEGER DEFAULT 7;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_followup_date TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_notes TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_attempt_count INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_contact_channel TEXT DEFAULT 'email'
  CHECK (preferred_contact_channel IN ('email', 'phone', 'linkedin', 'whatsapp', 'upwork'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_upwork_lead BOOLEAN DEFAULT false;

-- Add AI analysis cache columns
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS current_mood_label TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS current_mood_score INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS current_intent_status TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_mood_analysis_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_intent_analysis_at TIMESTAMPTZ;

-- Add additional contact fields
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS hubspot_id TEXT;

-- Create indexes for follow-up tracking
CREATE INDEX IF NOT EXISTS idx_contacts_is_lead_follow_up ON contacts(is_lead_follow_up);
CREATE INDEX IF NOT EXISTS idx_contacts_next_followup_date ON contacts(next_followup_date)
  WHERE is_lead_follow_up = true;
CREATE INDEX IF NOT EXISTS idx_contacts_followup_status ON contacts(followup_status);
CREATE INDEX IF NOT EXISTS idx_contacts_followup_assigned ON contacts(followup_assigned_to, next_followup_date);
CREATE INDEX IF NOT EXISTS idx_contacts_last_contact_date ON contacts(last_contact_date DESC);

-- Update RLS policies if needed
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can manage contacts" ON contacts;
CREATE POLICY "Authenticated users can view contacts" ON contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage contacts" ON contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
