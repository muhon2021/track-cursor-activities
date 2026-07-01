-- ============================================================================
-- Business Development Module Migration
-- ============================================================================
-- Adds deals pipeline, contacts, lead follow-up, and communication tracking.
-- Note: clients table already exists.
-- ============================================================================

-- ========================
-- Deals
-- ========================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  stage TEXT NOT NULL DEFAULT 'lead'
    CHECK (stage IN ('lead', 'discovery', 'estimation', 'proposal', 'won', 'lost')),
  value NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  client_id UUID,
  contact_id UUID,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expected_close_date DATE,
  closed_at TIMESTAMPTZ,
  lost_reason TEXT,
  source TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Deal Activities
-- ========================
CREATE TABLE IF NOT EXISTS deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('note', 'call', 'email', 'meeting', 'stage_change', 'task')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Deal Comments
-- ========================
CREATE TABLE IF NOT EXISTS deal_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Contacts
-- ========================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,
  linkedin_url TEXT,
  client_id UUID,
  source TEXT DEFAULT 'manual',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Lead Follow-Up
-- ========================
CREATE TABLE IF NOT EXISTS lead_followup_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'not_interested', 'converted', 'dormant')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  next_follow_up DATE,
  follow_up_notes TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (contact_id)
);

-- ========================
-- Contact Communications
-- ========================
CREATE TABLE IF NOT EXISTS contact_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'phone', 'linkedin', 'meeting', 'other')),
  direction TEXT DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  content TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Scheduled Emails
-- ========================
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FK for deals.contact_id now that contacts table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deals_contact_id_fkey') THEN
    ALTER TABLE deals ADD CONSTRAINT deals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_client ON deals(client_id);
CREATE INDEX IF NOT EXISTS idx_deals_slug ON deals(slug);
CREATE INDEX IF NOT EXISTS idx_deal_activities_deal ON deal_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_comments_deal ON deal_comments(deal_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_client ON contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_lead_followup_status ON lead_followup_contacts(status);
CREATE INDEX IF NOT EXISTS idx_lead_followup_assigned ON lead_followup_contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contact_comms_contact ON contact_communications(contact_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON scheduled_emails(status);

-- ========================
-- RLS Policies
-- ========================
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view deals" ON deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage deals" ON deals FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view activities" ON deal_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage activities" ON deal_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE deal_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view deal comments" ON deal_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage deal comments" ON deal_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view contacts" ON contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage contacts" ON contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE lead_followup_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view followups" ON lead_followup_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage followups" ON lead_followup_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE contact_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view communications" ON contact_communications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage communications" ON contact_communications FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view emails" ON scheduled_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage emails" ON scheduled_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);
