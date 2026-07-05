-- 20260207_add_lead_scoring_system.sql
-- ============================================================================
-- Add Lead Scoring System Migration
-- ============================================================================
-- Extends contacts table with a 100-point lead scoring system including
-- engagement, deal potential, profile completeness, and recency scores.
-- ============================================================================

-- Add lead scoring columns to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_temperature TEXT DEFAULT 'cold'
  CHECK (lead_temperature IN ('hot', 'warm', 'cold'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS profile_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deal_potential_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS recency_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_score_calculated_at TIMESTAMPTZ;

-- Create indexes for lead scoring
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON contacts(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_temperature ON contacts(lead_temperature);
CREATE INDEX IF NOT EXISTS idx_contacts_score_temp ON contacts(lead_score DESC, lead_temperature);

-- Create helper function to calculate lead score
CREATE OR REPLACE FUNCTION calculate_contact_lead_score(contact_id UUID)
RETURNS TABLE (
  total_score INTEGER,
  temperature TEXT,
  engagement_score INTEGER,
  profile_score INTEGER,
  deal_potential_score INTEGER,
  recency_score INTEGER
) AS $$
DECLARE
  v_profile_score INTEGER := 0;
  v_recency_score INTEGER := 0;
  v_engagement_score INTEGER;
  v_deal_potential_score INTEGER;
  v_total_score INTEGER;
  v_temperature TEXT;
  v_last_contact TIMESTAMPTZ;
  v_days_since NUMERIC;
BEGIN
  -- Get current engagement and deal potential scores
  SELECT
    COALESCE(engagement_score, 0),
    COALESCE(deal_potential_score, 0),
    last_contact_date
  INTO v_engagement_score, v_deal_potential_score, v_last_contact
  FROM contacts WHERE id = contact_id;

  -- Calculate profile score (0-20)
  -- Email: 4 points, Phone: 4 points, LinkedIn: 6 points, Title: 3 points, Dept: 3 points
  IF (SELECT email IS NOT NULL FROM contacts WHERE id = contact_id) THEN
    v_profile_score := v_profile_score + 4;
  END IF;
  IF (SELECT phone IS NOT NULL FROM contacts WHERE id = contact_id) THEN
    v_profile_score := v_profile_score + 4;
  END IF;
  IF (SELECT linkedin_url IS NOT NULL FROM contacts WHERE id = contact_id) THEN
    v_profile_score := v_profile_score + 6;
  END IF;
  IF (SELECT title IS NOT NULL FROM contacts WHERE id = contact_id) THEN
    v_profile_score := v_profile_score + 3;
  END IF;
  IF (SELECT department IS NOT NULL FROM contacts WHERE id = contact_id) THEN
    v_profile_score := v_profile_score + 3;
  END IF;

  -- Calculate recency score (0-10)
  IF v_last_contact IS NOT NULL THEN
    v_days_since := EXTRACT(DAY FROM NOW() - v_last_contact);
    IF v_days_since <= 7 THEN
      v_recency_score := 10;
    ELSIF v_days_since <= 14 THEN
      v_recency_score := 8;
    ELSIF v_days_since <= 30 THEN
      v_recency_score := 6;
    ELSIF v_days_since <= 60 THEN
      v_recency_score := 4;
    ELSIF v_days_since <= 90 THEN
      v_recency_score := 2;
    ELSE
      v_recency_score := 0;
    END IF;
  ELSE
    v_recency_score := 0;
  END IF;

  -- Calculate total score (0-100)
  v_total_score := v_profile_score + v_recency_score + v_engagement_score + v_deal_potential_score;
  IF v_total_score > 100 THEN
    v_total_score := 100;
  END IF;

  -- Determine temperature
  IF v_total_score >= 67 THEN
    v_temperature := 'hot';
  ELSIF v_total_score >= 34 THEN
    v_temperature := 'warm';
  ELSE
    v_temperature := 'cold';
  END IF;

  RETURN QUERY SELECT v_total_score, v_temperature, v_engagement_score, v_profile_score, v_deal_potential_score, v_recency_score;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function to update lead score automatically
CREATE OR REPLACE FUNCTION update_contact_lead_score()
RETURNS TRIGGER AS $$
DECLARE
  score_data RECORD;
BEGIN
  -- Only calculate for lead follow-up contacts
  IF NEW.is_lead_follow_up THEN
    SELECT * INTO score_data FROM calculate_contact_lead_score(NEW.id);
    NEW.lead_score := score_data.total_score;
    NEW.lead_temperature := score_data.temperature;
    NEW.profile_score := score_data.profile_score;
    NEW.recency_score := score_data.recency_score;
    NEW.last_score_calculated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lead score calculation
DROP TRIGGER IF EXISTS update_contact_lead_score_trigger ON contacts;
CREATE TRIGGER update_contact_lead_score_trigger
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION update_contact_lead_score();

-- Create function to calculate next followup date
CREATE OR REPLACE FUNCTION calculate_next_followup_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate if is_lead_follow_up is true and last_contact_date exists
  IF NEW.is_lead_follow_up AND NEW.last_contact_date IS NOT NULL THEN
    NEW.next_followup_date := NEW.last_contact_date + (COALESCE(NEW.followup_interval_days, 7) || ' days')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for next followup date calculation
DROP TRIGGER IF EXISTS update_contact_followup_date_trigger ON contacts;
CREATE TRIGGER update_contact_followup_date_trigger
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION calculate_next_followup_date();


-- 20260207_create_contact_activities_table.sql
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


-- 20260207_create_contact_ai_summaries_table.sql
-- ============================================================================
-- Create Contact AI Summaries Table
-- ============================================================================
-- Caches AI-generated executive summaries for contacts. Used for performance
-- optimization, with auto-refresh after 24 hours.
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  summary_text TEXT,
  talking_points JSONB DEFAULT '[]',
  recommended_approach TEXT,
  data_snapshot JSONB DEFAULT '{}',
  engagement_level TEXT
    CHECK (engagement_level IN ('limited', 'moderate', 'strong')),
  lead_score INTEGER,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contact_ai_summaries_contact ON contact_ai_summaries(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_ai_summaries_expires_at ON contact_ai_summaries(expires_at);

-- Enable RLS
ALTER TABLE contact_ai_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view summaries" ON contact_ai_summaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage summaries" ON contact_ai_summaries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create function to refresh summary expiration
CREATE OR REPLACE FUNCTION refresh_contact_ai_summary(contact_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE contact_ai_summaries
  SET expires_at = NOW() + INTERVAL '24 hours',
      updated_at = NOW()
  WHERE contact_id = $1;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if summary is expired
CREATE OR REPLACE FUNCTION is_contact_ai_summary_expired(contact_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  expired BOOLEAN;
BEGIN
  SELECT (expires_at < NOW())
  INTO expired
  FROM contact_ai_summaries
  WHERE contact_id = $1
  LIMIT 1;

  RETURN COALESCE(expired, true);
END;
$$ LANGUAGE plpgsql STABLE;


-- 20260207_create_contact_email_templates_table.sql
-- ============================================================================
-- Create Contact Email Templates Table
-- ============================================================================
-- Pre-written email templates for follow-ups with variable substitution.
-- Includes both system templates and custom user templates.
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'custom'
    CHECK (category IN (
      'initial_outreach', 'follow_up', 'check_in',
      'proposal', 'thank_you', 'custom', 'sales',
      'upsell', 'reengage'
    )),
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  variables JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON contact_email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON contact_email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_usage ON contact_email_templates(usage_count DESC);

-- Enable RLS
ALTER TABLE contact_email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view templates" ON contact_email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage templates" ON contact_email_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create function to increment template usage
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE contact_email_templates
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to replace template variables
CREATE OR REPLACE FUNCTION replace_template_variables(
  template_body TEXT,
  variables_json JSONB
)
RETURNS TEXT AS $$
DECLARE
  result TEXT := template_body;
  var_key TEXT;
  var_value TEXT;
BEGIN
  FOR var_key, var_value IN
    SELECT key, value
    FROM jsonb_each_text(variables_json)
  LOOP
    result := REPLACE(result, '{{' || var_key || '}}', var_value);
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Seed system templates
INSERT INTO contact_email_templates (
  name,
  subject,
  body,
  category,
  is_system,
  is_active,
  variables
) VALUES
  (
    'Initial Outreach',
    'Introducing {{company_name}} - {{contact_name}}',
    'Hi {{first_name}},

I hope this message finds you well. I wanted to reach out to you personally about how {{company_name}} can help {{contact_company}}.

{{company_name}} specializes in {{service_area}}, and I think we could create significant value for your team.

Would you be open to a brief 15-minute call next week to explore this further?

Best regards,
{{sender_name}}',
    'initial_outreach',
    true,
    true,
    '["first_name", "contact_name", "company_name", "contact_company", "service_area", "sender_name"]'::jsonb
  ),
  (
    'Follow-Up Check-In',
    'Quick Check-In - {{contact_name}}',
    'Hi {{first_name}},

I wanted to follow up on my previous message. I believe {{company_name}} could really make a difference for {{contact_company}}, especially in {{area_of_interest}}.

Would you have 15 minutes this week to chat?

Looking forward to connecting,
{{sender_name}}',
    'follow_up',
    true,
    true,
    '["first_name", "contact_name", "company_name", "contact_company", "area_of_interest", "sender_name"]'::jsonb
  ),
  (
    'Thank You Note',
    'Thank you for your time, {{contact_name}}',
    'Hi {{first_name}},

Thank you so much for taking the time to meet with me today. I really appreciated learning about {{discussion_topic}}.

As we discussed, {{next_step}}. I''ll follow up with the details by {{follow_up_date}}.

Best regards,
{{sender_name}}',
    'thank_you',
    true,
    true,
    '["first_name", "contact_name", "discussion_topic", "next_step", "follow_up_date", "sender_name"]'::jsonb
  ),
  (
    'Project Proposal',
    'Proposal for {{contact_company}} - {{project_name}}',
    'Hi {{first_name}},

Attached is the proposal we discussed for {{project_name}} at {{contact_company}}.

The proposal outlines {{key_points}} and we estimate a timeline of {{timeline}} with an investment of {{investment}}.

Please review at your convenience, and let''s schedule a time to discuss any questions you may have.

Best regards,
{{sender_name}}',
    'proposal',
    true,
    true,
    '["first_name", "contact_company", "project_name", "key_points", "timeline", "investment", "sender_name"]'::jsonb
  )
ON CONFLICT (name) DO NOTHING;


-- 20260207_create_email_logs_table.sql
-- ============================================================================
-- Create Email Logs Table
-- ============================================================================
-- Comprehensive email logging system extending scheduled_emails. Tracks all
-- sent/received emails with SendGrid integration, templates, and engagement.
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES contact_email_templates(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  recipient_name TEXT,
  cc TEXT,
  bcc TEXT,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  status TEXT DEFAULT 'queued'
    CHECK (status IN ('queued', 'sending', 'sent', 'scheduled', 'failed', 'bounced', 'rejected', 'cancelled')),
  priority TEXT DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  provider TEXT DEFAULT 'sendgrid'
    CHECK (provider IN ('sendgrid', 'ses', 'smtp')),
  provider_message_id TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_contact_id ON email_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_client_id ON email_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_scheduled_for ON email_logs(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_email_logs_provider_message_id ON email_logs(provider_message_id);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view email logs" ON email_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage email logs" ON email_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create trigger to update contact's last_contact_date on sent email
CREATE OR REPLACE FUNCTION update_contact_on_email_sent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND NEW.contact_id IS NOT NULL THEN
    UPDATE contacts
    SET last_contact_date = NOW(),
        updated_at = NOW()
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contact_on_email_sent_trigger ON email_logs;
CREATE TRIGGER update_contact_on_email_sent_trigger
AFTER INSERT OR UPDATE ON email_logs
FOR EACH ROW
EXECUTE FUNCTION update_contact_on_email_sent();

-- Create view for email engagement metrics per contact
CREATE OR REPLACE VIEW contact_email_engagement AS
SELECT
  el.contact_id,
  COUNT(*) as total_emails,
  COUNT(CASE WHEN el.status = 'sent' THEN 1 END) as emails_sent,
  COUNT(CASE WHEN el.opened_at IS NOT NULL THEN 1 END) as emails_opened,
  COUNT(CASE WHEN el.clicked_at IS NOT NULL THEN 1 END) as emails_clicked,
  ROUND(
    CASE
      WHEN COUNT(CASE WHEN el.status = 'sent' THEN 1 END) = 0 THEN 0
      ELSE (COUNT(CASE WHEN el.opened_at IS NOT NULL THEN 1 END)::NUMERIC / COUNT(CASE WHEN el.status = 'sent' THEN 1 END) * 100)
    END,
    2
  ) as open_rate,
  ROUND(
    CASE
      WHEN COUNT(CASE WHEN el.status = 'sent' THEN 1 END) = 0 THEN 0
      ELSE (COUNT(CASE WHEN el.clicked_at IS NOT NULL THEN 1 END)::NUMERIC / COUNT(CASE WHEN el.status = 'sent' THEN 1 END) * 100)
    END,
    2
  ) as click_rate,
  MAX(el.sent_at) as last_email_sent,
  MAX(el.opened_at) as last_email_opened,
  MAX(el.clicked_at) as last_email_clicked
FROM email_logs el
WHERE el.contact_id IS NOT NULL
GROUP BY el.contact_id;

-- Create helper function to get email engagement metrics
CREATE OR REPLACE FUNCTION get_contact_email_engagement_metrics(contact_id UUID)
RETURNS TABLE (
  total_emails INTEGER,
  emails_sent INTEGER,
  emails_opened INTEGER,
  emails_clicked INTEGER,
  open_rate NUMERIC,
  click_rate NUMERIC,
  last_email_sent TIMESTAMPTZ,
  last_email_opened TIMESTAMPTZ,
  last_email_clicked TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cee.total_emails,
    cee.emails_sent,
    cee.emails_opened,
    cee.emails_clicked,
    cee.open_rate,
    cee.click_rate,
    cee.last_email_sent,
    cee.last_email_opened,
    cee.last_email_clicked
  FROM contact_email_engagement cee
  WHERE cee.contact_id = $1;
END;
$$ LANGUAGE plpgsql STABLE;


-- 20260207_create_email_tracking_events_table.sql
-- ============================================================================
-- Create Email Tracking Events Table
-- ============================================================================
-- Tracks email engagement events: opens, clicks, bounces, spam reports.
-- Integrates with SendGrid webhook data for engagement tracking.
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES contact_activities(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'spam_report')),
  clicked_url TEXT,
  user_agent TEXT,
  ip_address TEXT,
  sendgrid_event_id TEXT,
  sendgrid_message_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_tracking_contact_id ON email_tracking_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_activity_id ON email_tracking_events(activity_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_event_type ON email_tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_tracking_sendgrid_id ON email_tracking_events(sendgrid_message_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_created_at ON email_tracking_events(created_at DESC);

-- Enable RLS
ALTER TABLE email_tracking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view tracking events" ON email_tracking_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tracking events" ON email_tracking_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create function to process SendGrid events
CREATE OR REPLACE FUNCTION process_sendgrid_event(
  p_event_type TEXT,
  p_sendgrid_message_id TEXT,
  p_contact_id UUID,
  p_clicked_url TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_log_id UUID;
BEGIN
  -- Find the email log for this message
  SELECT id INTO v_log_id
  FROM email_logs
  WHERE provider_message_id = p_sendgrid_message_id
  LIMIT 1;

  -- Create tracking event
  INSERT INTO email_tracking_events (
    contact_id,
    event_type,
    clicked_url,
    user_agent,
    ip_address,
    sendgrid_message_id,
    metadata
  ) VALUES (
    p_contact_id,
    p_event_type,
    p_clicked_url,
    p_user_agent,
    p_ip_address,
    p_sendgrid_message_id,
    p_metadata
  )
  RETURNING id INTO v_event_id;

  -- Update email_logs status based on event type
  IF p_event_type = 'delivered' THEN
    UPDATE email_logs SET delivered_at = NOW() WHERE id = v_log_id;
  ELSIF p_event_type = 'opened' THEN
    UPDATE email_logs SET opened_at = NOW() WHERE id = v_log_id AND opened_at IS NULL;
  ELSIF p_event_type = 'clicked' THEN
    UPDATE email_logs SET clicked_at = NOW() WHERE id = v_log_id AND clicked_at IS NULL;
  ELSIF p_event_type IN ('bounced', 'spam_report') THEN
    UPDATE email_logs SET status = CASE WHEN p_event_type = 'bounced' THEN 'bounced' ELSE 'rejected' END WHERE id = v_log_id;
  END IF;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;


-- 20260207_create_lead_intent_analysis_table.sql
-- ============================================================================
-- Create Lead Intent Analysis Table
-- ============================================================================
-- Stores AI-generated deal momentum and intent analysis. Tracks active/stalled/dormant
-- status with momentum signals and decay signals.
-- ============================================================================

CREATE TABLE IF NOT EXISTS lead_intent_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  intent_status TEXT NOT NULL
    CHECK (intent_status IN ('active', 'stalled', 'dormant')),
  momentum_score INTEGER NOT NULL CHECK (momentum_score >= 0 AND momentum_score <= 100),
  confidence TEXT DEFAULT 'medium'
    CHECK (confidence IN ('high', 'medium', 'low')),
  momentum_signals JSONB DEFAULT '[]',
  decay_signals JSONB DEFAULT '[]',
  days_since_activity INTEGER,
  reasoning TEXT,
  suggested_action TEXT DEFAULT 'hold_for_now'
    CHECK (suggested_action IN ('respond_soon', 'hold_for_now', 'archive')),
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  agent_run_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lead_intent_analysis_contact ON lead_intent_analysis(contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_intent_analysis_lead ON lead_intent_analysis(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_intent_analysis_analyzed_at ON lead_intent_analysis(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_intent_analysis_intent_status ON lead_intent_analysis(intent_status);

-- Enable RLS
ALTER TABLE lead_intent_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view intent analysis" ON lead_intent_analysis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage intent analysis" ON lead_intent_analysis FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create helper function to get latest intent analysis
CREATE OR REPLACE FUNCTION get_latest_contact_intent_analysis(contact_id UUID)
RETURNS TABLE (
  id UUID,
  intent_status TEXT,
  momentum_score INTEGER,
  confidence TEXT,
  momentum_signals JSONB,
  decay_signals JSONB,
  days_since_activity INTEGER,
  reasoning TEXT,
  suggested_action TEXT,
  analyzed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lia.id,
    lia.intent_status,
    lia.momentum_score,
    lia.confidence,
    lia.momentum_signals,
    lia.decay_signals,
    lia.days_since_activity,
    lia.reasoning,
    lia.suggested_action,
    lia.analyzed_at
  FROM lead_intent_analysis lia
  WHERE lia.contact_id = $1
  ORDER BY lia.analyzed_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;


-- 20260207_create_lead_mood_analysis_table.sql
-- ============================================================================
-- Create Lead Mood Analysis Table
-- ============================================================================
-- Stores AI-generated sentiment analysis for contacts. Tracks warm/neutral/cold
-- mood with confidence levels and suggested actions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS lead_mood_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  mood_score INTEGER NOT NULL CHECK (mood_score >= 0 AND mood_score <= 100),
  mood_label TEXT NOT NULL
    CHECK (mood_label IN ('warm', 'neutral', 'cold')),
  confidence TEXT DEFAULT 'medium'
    CHECK (confidence IN ('high', 'medium', 'low')),
  key_signals JSONB DEFAULT '[]',
  reasoning TEXT,
  suggested_action TEXT DEFAULT 'hold_for_now'
    CHECK (suggested_action IN ('respond_soon', 'hold_for_now', 'archive')),
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  agent_run_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lead_mood_analysis_contact ON lead_mood_analysis(contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_mood_analysis_lead ON lead_mood_analysis(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_mood_analysis_analyzed_at ON lead_mood_analysis(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_mood_analysis_mood_label ON lead_mood_analysis(mood_label);

-- Enable RLS
ALTER TABLE lead_mood_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view mood analysis" ON lead_mood_analysis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage mood analysis" ON lead_mood_analysis FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create helper function to get latest mood analysis
CREATE OR REPLACE FUNCTION get_latest_contact_mood_analysis(contact_id UUID)
RETURNS TABLE (
  id UUID,
  mood_score INTEGER,
  mood_label TEXT,
  confidence TEXT,
  key_signals JSONB,
  reasoning TEXT,
  suggested_action TEXT,
  analyzed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lma.id,
    lma.mood_score,
    lma.mood_label,
    lma.confidence,
    lma.key_signals,
    lma.reasoning,
    lma.suggested_action,
    lma.analyzed_at
  FROM lead_mood_analysis lma
  WHERE lma.contact_id = $1
  ORDER BY lma.analyzed_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;


