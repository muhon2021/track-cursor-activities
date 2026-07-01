-- ============================================================================
-- Create Contact Activities Table
-- ============================================================================
-- Tracks all interactions with a contact across multiple channels. Designed
-- to replace contact_communications for more comprehensive activity logging.
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL
    CHECK (activity_type IN (
      'email_sent', 'email_received', 'phone_call', 'meeting',
      'note_added', 'status_changed', 'linkedin_message',
      'linkedin_view', 'linkedin_research', 'whatsapp_message',
      'upwork_message', 'follow_up_logged'
    )),
  subject TEXT,
  description TEXT,
  channel TEXT NOT NULL
    CHECK (channel IN ('email', 'phone', 'linkedin', 'whatsapp', 'upwork', 'in_person', 'other')),
  direction TEXT NOT NULL
    CHECK (direction IN ('outbound', 'inbound', 'internal')),
  email_to TEXT[] DEFAULT '{}',
  email_cc TEXT[] DEFAULT '{}',
  email_bcc TEXT[] DEFAULT '{}',
  email_body TEXT,
  email_sent_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contact_activities_contact_id ON contact_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_activities_type ON contact_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_contact_activities_created ON contact_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_activities_channel ON contact_activities(channel);
CREATE INDEX IF NOT EXISTS idx_contact_activities_not_deleted ON contact_activities(deleted_at) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE contact_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view activities" ON contact_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage activities" ON contact_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create trigger to update contact's last_contact_date when activity is created
CREATE OR REPLACE FUNCTION update_contact_on_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contacts
  SET last_contact_date = NOW(),
      updated_at = NOW()
  WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contact_on_activity_trigger ON contact_activities;
CREATE TRIGGER update_contact_on_activity_trigger
AFTER INSERT ON contact_activities
FOR EACH ROW
EXECUTE FUNCTION update_contact_on_activity();
