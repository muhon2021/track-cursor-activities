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


-- 20260207_create_sendgrid_config_table.sql
-- ============================================================================
-- Create SendGrid Configuration Table
-- ============================================================================
-- Singleton table for SendGrid integration configuration. Stores API keys,
-- webhook settings, and tracking preferences.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sendgrid_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_encrypted TEXT,
  from_email TEXT DEFAULT 'noreply@sjinnovation.com',
  from_name TEXT DEFAULT 'SJ Innovation',
  is_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT,
  webhook_secret TEXT,
  enable_open_tracking BOOLEAN DEFAULT true,
  enable_click_tracking BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index (should only be one row)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sendgrid_config_single ON sendgrid_config ((1));

-- Enable RLS
ALTER TABLE sendgrid_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view config" ON sendgrid_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage config" ON sendgrid_config FOR ALL TO authenticated
  USING (has_role('admin'::app_role)) WITH CHECK (has_role('admin'::app_role));

-- Create function to get or create default config
CREATE OR REPLACE FUNCTION get_or_create_sendgrid_config()
RETURNS sendgrid_config AS $$
DECLARE
  config sendgrid_config;
BEGIN
  SELECT * INTO config FROM sendgrid_config LIMIT 1;

  IF config IS NULL THEN
    INSERT INTO sendgrid_config (
      api_key_encrypted,
      from_email,
      from_name,
      is_enabled,
      webhook_url,
      webhook_secret,
      enable_open_tracking,
      enable_click_tracking
    ) VALUES (
      NULL,
      'noreply@sjinnovation.com',
      'SJ Innovation',
      false,
      NULL,
      NULL,
      true,
      true
    )
    RETURNING * INTO config;
  END IF;

  RETURN config;
END;
$$ LANGUAGE plpgsql;

-- Ensure default config exists
DO $$
BEGIN
  PERFORM get_or_create_sendgrid_config();
END $$;


-- 20260207_migrate_scheduled_emails_to_email_logs.sql
-- ============================================================================
-- Migrate Scheduled Emails to Email Logs
-- ============================================================================
-- Migrates data from scheduled_emails table to the new email_logs table.
-- Keeps scheduled_emails for backward compatibility but directs new emails
-- to email_logs.
-- ============================================================================

-- Insert existing scheduled emails into email_logs
INSERT INTO email_logs (
  user_id,
  contact_id,
  client_id,
  recipient,
  subject,
  body_text,
  status,
  scheduled_for,
  sent_at,
  provider,
  metadata,
  created_at,
  updated_at
)
SELECT
  COALESCE(se.created_by, (SELECT id FROM auth.users LIMIT 1)),
  se.contact_id,
  se.deal_id,
  se.to_email,
  se.subject,
  se.body,
  CASE
    WHEN se.status = 'pending' THEN 'scheduled'
    WHEN se.status = 'sent' THEN 'sent'
    WHEN se.status = 'failed' THEN 'failed'
    WHEN se.status = 'cancelled' THEN 'cancelled'
    ELSE 'queued'
  END,
  se.scheduled_for,
  se.sent_at,
  'sendgrid',
  jsonb_build_object(
    'source', 'scheduled_emails_migration',
    'original_id', se.id::text,
    'original_status', se.status
  ),
  se.created_at,
  COALESCE(se.sent_at, NOW())
FROM scheduled_emails se
WHERE NOT EXISTS (
  SELECT 1 FROM email_logs el
  WHERE el.metadata->>'original_id' = se.id::text
)
ON CONFLICT DO NOTHING;

-- Log migration completion
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM email_logs
  WHERE metadata->>'source' = 'scheduled_emails_migration';

  RAISE NOTICE 'Migrated % scheduled emails to email_logs', migrated_count;
END $$;


-- 20260207_register_lead_followup_module.sql
-- ============================================================================
-- Register Lead Follow-Up Module
-- ============================================================================
-- Registers the Lead Follow-Up module in app_modules table for access control
-- and navigation.
-- ============================================================================

-- Insert Lead Follow-Up module into app_modules
INSERT INTO app_modules (
  name,
  slug,
  description,
  icon,
  category,
  is_core,
  is_active,
  sort_order,
  dependencies,
  created_at,
  updated_at
) VALUES (
  'Lead Follow-Up',
  'lead-followup',
  'Contact management and engagement tracking for sales teams with AI-powered sentiment analysis, email automation, and HubSpot integration',
  'Target',
  'business',
  false,
  true,
  10,
  ARRAY['business-dev'],
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();


-- 20260207_seed_additional_email_templates.sql
-- ============================================================================
-- Seed Additional Email Templates
-- ============================================================================
-- Seeds intent-based email templates for different follow-up scenarios.
-- ============================================================================

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
    'Sales Pitch',
    'How {{company_name}} Helps Companies Like {{contact_company}}',
    'Hi {{first_name}},

Many {{industry}} companies like {{contact_company}} struggle with {{pain_point}}.

{{company_name}} helps by {{solution}}, typically resulting in {{result}}.

I''d love to show you how we''ve helped similar companies. Would you have 20 minutes this week?

Best regards,
{{sender_name}}',
    'sales',
    true,
    true,
    '["first_name", "company_name", "contact_company", "industry", "pain_point", "solution", "result", "sender_name"]'::jsonb
  ),
  (
    'Upsell Opportunity',
    'New Opportunity for {{contact_company}} - {{opportunity_name}}',
    'Hi {{first_name}},

Given our success with {{existing_project}}, I wanted to share something new that could benefit {{contact_company}}.

We recently launched {{new_offering}}, which complements your current {{existing_solution}}. It could help with {{benefit}}.

Would you be interested in exploring this? I can send over a quick overview.

Best regards,
{{sender_name}}',
    'upsell',
    true,
    true,
    '["first_name", "contact_company", "opportunity_name", "existing_project", "new_offering", "existing_solution", "benefit", "sender_name"]'::jsonb
  ),
  (
    'Re-Engagement',
    'Let''s Connect Again - {{contact_name}}',
    'Hi {{first_name}},

It''s been a while since we last spoke! I wanted to check in and see how {{contact_company}} is doing.

Things have evolved significantly on our side with {{recent_update}}. I think there might be some relevant opportunities for your team now.

Could we grab a quick 15-minute call to catch up?

Best regards,
{{sender_name}}',
    'reengage',
    true,
    true,
    '["first_name", "contact_name", "contact_company", "recent_update", "sender_name"]'::jsonb
  ),
  (
    'Meeting Follow-Up',
    'Summary & Next Steps from Our Meeting',
    'Hi {{first_name}},

Thank you for taking the time to meet yesterday. Here''s a summary of what we discussed:

{{meeting_summary}}

As agreed, I''ll {{action_item_1}} by {{date_1}}, and you''ll {{action_item_2}}.

Let''s schedule our next check-in for {{next_meeting_date}}.

Best regards,
{{sender_name}}',
    'follow_up',
    true,
    true,
    '["first_name", "meeting_summary", "action_item_1", "date_1", "action_item_2", "next_meeting_date", "sender_name"]'::jsonb
  ),
  (
    'Value Proposition',
    'Why {{company_name}} is Different',
    'Hi {{first_name}},

I understand {{contact_company}} is evaluating solutions for {{business_need}}. Here''s what makes {{company_name}} stand out:

{{point_1}}
{{point_2}}
{{point_3}}

Rather than me tell you more, would it make sense to see a quick demo? I can show you exactly how this would work for {{contact_company}}.

Available {{available_times}}.

Best regards,
{{sender_name}}',
    'sales',
    true,
    true,
    '["first_name", "company_name", "contact_company", "business_need", "point_1", "point_2", "point_3", "available_times", "sender_name"]'::jsonb
  ),
  (
    'Partnership Inquiry',
    'Strategic Partnership Opportunity with {{contact_company}}',
    'Hi {{first_name}},

I believe {{company_name}} and {{contact_company}} could create tremendous value by working together on {{opportunity}}.

Based on {{reason_for_partnership}}, I think a partnership would be mutually beneficial. We could {{collaboration_benefit}}.

Would you be open to exploring this further? I''d love to schedule a brief conversation.

Best regards,
{{sender_name}}',
    'custom',
    true,
    true,
    '["first_name", "company_name", "contact_company", "opportunity", "reason_for_partnership", "collaboration_benefit", "sender_name"]'::jsonb
  ),
  (
    'Resource Sharing',
    'Resource You Might Find Useful',
    'Hi {{first_name}},

I came across this {{resource_type}} on {{topic}}, and I immediately thought of {{contact_company}} because {{reason}}.

I wanted to share it with you directly: {{resource_link}}

Curious to hear your thoughts. Feel free to reach out if you''d like to discuss further.

Best regards,
{{sender_name}}',
    'check_in',
    true,
    true,
    '["first_name", "resource_type", "topic", "contact_company", "reason", "resource_link", "sender_name"]'::jsonb
  ),
  (
    'Closing Follow-Up',
    'Finalizing Details - {{contact_name}}',
    'Hi {{first_name}},

I wanted to follow up on {{deal_name}}, which we''ve been excited to move forward on.

To help us close this out, we need {{missing_info}} from your side by {{deadline}}.

Once we have that, we can {{next_step}} and get things rolling.

Do you have any questions?

Best regards,
{{sender_name}}',
    'follow_up',
    true,
    true,
    '["first_name", "contact_name", "deal_name", "missing_info", "deadline", "next_step", "sender_name"]'::jsonb
  )
ON CONFLICT (name) DO NOTHING;


-- 20260207_seed_lead_followup_ai_agents.sql
-- ============================================================================
-- Seed Lead Follow-Up AI Agents
-- ============================================================================
-- Creates AI agent configurations for mood analysis, intent analysis,
-- email drafting, research, and conversation opener generation.
-- ============================================================================

-- Insert AI Agents (if ai_agents table exists)
INSERT INTO ai_agents (
  name,
  slug,
  category,
  description,
  system_prompt,
  provider_config,
  required_role,
  is_enabled,
  memory_enabled,
  created_at,
  updated_at
) VALUES
  (
    'Client Mood Analyzer',
    'client-mood-analyzer',
    'sales',
    'Analyzes contact sentiment and emotional state based on communication history',
    'You are an expert sales psychologist analyzing client emotional state and sentiment. Based on the provided communication history, meetings, and interactions, determine the client''s mood (warm, neutral, or cold) with a confidence level. Provide key signals that indicate this mood, reasoning for your assessment, and a suggested action.',
    '{"provider": "gemini", "model": "gemini-2.5-flash", "fallback_provider": "openai", "fallback_model": "gpt-4o-mini", "temperature": 0.3, "max_tokens": 1000}'::jsonb,
    'user',
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'Client Intent & Momentum Analyzer',
    'client-intent-analyzer',
    'sales',
    'Analyzes deal momentum and client purchase intent (active, stalled, or dormant)',
    'You are an expert sales analyst assessing deal momentum and purchase intent. Based on recent activities, meeting frequency, task completion, and communication patterns, determine if this opportunity is active, stalled, or dormant. Identify positive momentum signals and decay signals. Provide a momentum score (0-100), reasoning, and suggested next action.',
    '{"provider": "openai", "model": "gpt-4o", "fallback_provider": "gemini", "fallback_model": "gemini-2.5-pro", "temperature": 0.3, "max_tokens": 1200}'::jsonb,
    'user',
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'Email Draft Generator',
    'email-draft-generator',
    'sales',
    'Generates professional, personalized email drafts for follow-ups',
    'You are an expert email copywriter specializing in sales outreach. Generate a professional, personalized email draft based on the provided context including contact information, communication history, meetings, and the specified intent (regular, sales, upsell, reengage, or thank you). The email should be concise (150-250 words), personalized, and include a clear call-to-action.',
    '{"provider": "openai", "model": "gpt-4o", "fallback_provider": "anthropic", "fallback_model": "claude-opus-4-6", "temperature": 0.7, "max_tokens": 800}'::jsonb,
    'user',
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'LinkedIn Research Agent',
    'linkedin-research-agent',
    'sales',
    'Researches contact and company information via LinkedIn and web sources',
    'You are an expert researcher conducting LinkedIn and web research. Research the provided contact information and provide insights on recent activity, job changes, company news, and relevant business context.',
    '{"provider": "perplexity", "model": "sonar", "temperature": 0.2, "max_tokens": 1500}'::jsonb,
    'user',
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'Conversation Opener Generator',
    'conversation-opener-generator',
    'sales',
    'Generates contextual conversation starters based on contact intelligence',
    'You are an expert sales conversation strategist. Based on all available contact intelligence including profile, recent activities, meetings, deals, and industry context, generate 3-5 compelling conversation openers. Each opener should be personalized, context-aware, and include a brief explanation of why it works.',
    '{"provider": "gemini", "model": "gemini-2.5-flash", "fallback_provider": "openai", "fallback_model": "gpt-4o-mini", "temperature": 0.8, "max_tokens": 1000}'::jsonb,
    'user',
    true,
    true,
    NOW(),
    NOW()
  )
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  system_prompt = EXCLUDED.system_prompt,
  provider_config = EXCLUDED.provider_config,
  updated_at = NOW();


-- 20260207_setup_lead_followup_settings.sql
-- ============================================================================
-- Setup Lead Follow-Up System Settings
-- ============================================================================
-- Initializes system_settings for lead follow-up module configuration.
-- ============================================================================

-- Insert or update lead_followup settings (if system_settings table exists)
INSERT INTO system_settings (
  category,
  key,
  value,
  description,
  data_type,
  created_at,
  updated_at
) VALUES
  (
    'lead_followup',
    'min_interval_days',
    '3',
    'Minimum allowed follow-up interval in days',
    'integer',
    NOW(),
    NOW()
  ),
  (
    'lead_followup',
    'max_interval_days',
    '90',
    'Maximum allowed follow-up interval in days',
    'integer',
    NOW(),
    NOW()
  ),
  (
    'lead_followup',
    'default_interval_days',
    '7',
    'Default follow-up interval in days',
    'integer',
    NOW(),
    NOW()
  ),
  (
    'email_tracking',
    'enable_open_tracking',
    'true',
    'Enable email open tracking via pixels',
    'boolean',
    NOW(),
    NOW()
  ),
  (
    'email_tracking',
    'enable_click_tracking',
    'true',
    'Enable email click tracking via link rewriting',
    'boolean',
    NOW(),
    NOW()
  ),
  (
    'lead_followup',
    'auto_status_enabled',
    'true',
    'Enable automatic status rule application',
    'boolean',
    NOW(),
    NOW()
  )
ON CONFLICT (category, key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();


-- 20260209001542_da65eae2-d263-4123-bbb1-fa0a44f213fc.sql
-- ============================================================================
-- LEAD FOLLOW-UP MODULE MIGRATIONS (20260207_*.sql) - Combined
-- ============================================================================

-- ============================================================================
-- 1. Add Contact Follow-Up Fields
-- ============================================================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_lead_follow_up BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_status TEXT DEFAULT 'pending';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_interval_days INTEGER DEFAULT 7;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_followup_date TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_notes TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_attempt_count INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_contact_channel TEXT DEFAULT 'email';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_upwork_lead BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS current_mood_label TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS current_mood_score INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS current_intent_status TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_mood_analysis_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_intent_analysis_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS hubspot_id TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_is_lead_follow_up ON contacts(is_lead_follow_up);
CREATE INDEX IF NOT EXISTS idx_contacts_next_followup_date ON contacts(next_followup_date) WHERE is_lead_follow_up = true;
CREATE INDEX IF NOT EXISTS idx_contacts_followup_status ON contacts(followup_status);
CREATE INDEX IF NOT EXISTS idx_contacts_followup_assigned ON contacts(followup_assigned_to, next_followup_date);
CREATE INDEX IF NOT EXISTS idx_contacts_last_contact_date ON contacts(last_contact_date DESC);

-- ============================================================================
-- 2. Add Lead Scoring System
-- ============================================================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_temperature TEXT DEFAULT 'cold';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS profile_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deal_potential_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS recency_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_score_calculated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON contacts(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_temperature ON contacts(lead_temperature);
CREATE INDEX IF NOT EXISTS idx_contacts_score_temp ON contacts(lead_score DESC, lead_temperature);

-- Lead score calculation function
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
  SELECT COALESCE(c.engagement_score, 0), COALESCE(c.deal_potential_score, 0), c.last_contact_date
  INTO v_engagement_score, v_deal_potential_score, v_last_contact
  FROM contacts c WHERE c.id = contact_id;

  IF (SELECT email IS NOT NULL FROM contacts WHERE id = contact_id) THEN v_profile_score := v_profile_score + 4; END IF;
  IF (SELECT phone IS NOT NULL FROM contacts WHERE id = contact_id) THEN v_profile_score := v_profile_score + 4; END IF;
  IF (SELECT linkedin_url IS NOT NULL FROM contacts WHERE id = contact_id) THEN v_profile_score := v_profile_score + 6; END IF;
  IF (SELECT title IS NOT NULL FROM contacts WHERE id = contact_id) THEN v_profile_score := v_profile_score + 3; END IF;
  IF (SELECT c.department IS NOT NULL FROM contacts c WHERE c.id = contact_id) THEN v_profile_score := v_profile_score + 3; END IF;

  IF v_last_contact IS NOT NULL THEN
    v_days_since := EXTRACT(DAY FROM NOW() - v_last_contact);
    IF v_days_since <= 7 THEN v_recency_score := 10;
    ELSIF v_days_since <= 14 THEN v_recency_score := 8;
    ELSIF v_days_since <= 30 THEN v_recency_score := 6;
    ELSIF v_days_since <= 60 THEN v_recency_score := 4;
    ELSIF v_days_since <= 90 THEN v_recency_score := 2;
    ELSE v_recency_score := 0;
    END IF;
  END IF;

  v_total_score := LEAST(100, v_profile_score + v_recency_score + v_engagement_score + v_deal_potential_score);
  IF v_total_score >= 67 THEN v_temperature := 'hot';
  ELSIF v_total_score >= 34 THEN v_temperature := 'warm';
  ELSE v_temperature := 'cold';
  END IF;

  RETURN QUERY SELECT v_total_score, v_temperature, v_engagement_score, v_profile_score, v_deal_potential_score, v_recency_score;
END;
$$ LANGUAGE plpgsql STABLE;

-- Auto-update lead score trigger
CREATE OR REPLACE FUNCTION update_contact_lead_score()
RETURNS TRIGGER AS $$
DECLARE score_data RECORD;
BEGIN
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

DROP TRIGGER IF EXISTS update_contact_lead_score_trigger ON contacts;
CREATE TRIGGER update_contact_lead_score_trigger BEFORE INSERT OR UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_contact_lead_score();

-- Next followup date function
CREATE OR REPLACE FUNCTION calculate_next_followup_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_lead_follow_up AND NEW.last_contact_date IS NOT NULL THEN
    NEW.next_followup_date := NEW.last_contact_date + (COALESCE(NEW.followup_interval_days, 7) || ' days')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contact_followup_date_trigger ON contacts;
CREATE TRIGGER update_contact_followup_date_trigger BEFORE INSERT OR UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION calculate_next_followup_date();

-- ============================================================================
-- 3. Create Contact Activities Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  subject TEXT,
  description TEXT,
  channel TEXT NOT NULL,
  direction TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_contact_activities_contact_id ON contact_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_activities_type ON contact_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_contact_activities_created ON contact_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_activities_channel ON contact_activities(channel);
CREATE INDEX IF NOT EXISTS idx_contact_activities_not_deleted ON contact_activities(deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE contact_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view activities" ON contact_activities;
DROP POLICY IF EXISTS "Authenticated users can manage activities" ON contact_activities;
CREATE POLICY "Authenticated users can view activities" ON contact_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage activities" ON contact_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_contact_on_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contacts SET last_contact_date = NOW(), updated_at = NOW() WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contact_on_activity_trigger ON contact_activities;
CREATE TRIGGER update_contact_on_activity_trigger AFTER INSERT ON contact_activities FOR EACH ROW EXECUTE FUNCTION update_contact_on_activity();

-- ============================================================================
-- 4. Create Contact AI Summaries Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS contact_ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  summary_text TEXT,
  talking_points JSONB DEFAULT '[]',
  recommended_approach TEXT,
  data_snapshot JSONB DEFAULT '{}',
  engagement_level TEXT,
  lead_score INTEGER,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_ai_summaries_contact ON contact_ai_summaries(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_ai_summaries_expires_at ON contact_ai_summaries(expires_at);

ALTER TABLE contact_ai_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view summaries" ON contact_ai_summaries;
DROP POLICY IF EXISTS "Authenticated users can manage summaries" ON contact_ai_summaries;
CREATE POLICY "Authenticated users can view summaries" ON contact_ai_summaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage summaries" ON contact_ai_summaries FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION refresh_contact_ai_summary(p_contact_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE contact_ai_summaries SET expires_at = NOW() + INTERVAL '24 hours', updated_at = NOW() WHERE contact_id = p_contact_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_contact_ai_summary_expired(p_contact_id UUID)
RETURNS BOOLEAN AS $$
DECLARE expired BOOLEAN;
BEGIN
  SELECT (expires_at < NOW()) INTO expired FROM contact_ai_summaries WHERE contact_id = p_contact_id LIMIT 1;
  RETURN COALESCE(expired, true);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 5. Create Contact Email Templates Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS contact_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'custom',
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  variables JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_active ON contact_email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON contact_email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_usage ON contact_email_templates(usage_count DESC);

ALTER TABLE contact_email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view templates" ON contact_email_templates;
DROP POLICY IF EXISTS "Authenticated users can manage templates" ON contact_email_templates;
CREATE POLICY "Authenticated users can view templates" ON contact_email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage templates" ON contact_email_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE contact_email_templates SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION replace_template_variables(template_body TEXT, variables_json JSONB)
RETURNS TEXT AS $$
DECLARE result TEXT := template_body; var_key TEXT; var_value TEXT;
BEGIN
  FOR var_key, var_value IN SELECT key, value FROM jsonb_each_text(variables_json) LOOP
    result := REPLACE(result, '{{' || var_key || '}}', var_value);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Seed system templates
INSERT INTO contact_email_templates (name, subject, body, category, is_system, is_active, variables) VALUES
  ('Initial Outreach', 'Introducing {{company_name}} - {{contact_name}}', E'Hi {{first_name}},\n\nI hope this message finds you well. I wanted to reach out to you personally about how {{company_name}} can help {{contact_company}}.\n\n{{company_name}} specializes in {{service_area}}, and I think we could create significant value for your team.\n\nWould you be open to a brief 15-minute call next week to explore this further?\n\nBest regards,\n{{sender_name}}', 'initial_outreach', true, true, '["first_name", "contact_name", "company_name", "contact_company", "service_area", "sender_name"]'::jsonb),
  ('Follow-Up Check-In', 'Quick Check-In - {{contact_name}}', E'Hi {{first_name}},\n\nI wanted to follow up on my previous message. I believe {{company_name}} could really make a difference for {{contact_company}}, especially in {{area_of_interest}}.\n\nWould you have 15 minutes this week to chat?\n\nLooking forward to connecting,\n{{sender_name}}', 'follow_up', true, true, '["first_name", "contact_name", "company_name", "contact_company", "area_of_interest", "sender_name"]'::jsonb),
  ('Thank You Note', 'Thank you for your time, {{contact_name}}', E'Hi {{first_name}},\n\nThank you so much for taking the time to meet with me today. I really appreciated learning about {{discussion_topic}}.\n\nAs we discussed, {{next_step}}. I''ll follow up with the details by {{follow_up_date}}.\n\nBest regards,\n{{sender_name}}', 'thank_you', true, true, '["first_name", "contact_name", "discussion_topic", "next_step", "follow_up_date", "sender_name"]'::jsonb),
  ('Project Proposal', 'Proposal for {{contact_company}} - {{project_name}}', E'Hi {{first_name}},\n\nAttached is the proposal we discussed for {{project_name}} at {{contact_company}}.\n\nThe proposal outlines {{key_points}} and we estimate a timeline of {{timeline}} with an investment of {{investment}}.\n\nPlease review at your convenience, and let''s schedule a time to discuss any questions you may have.\n\nBest regards,\n{{sender_name}}', 'proposal', true, true, '["first_name", "contact_company", "project_name", "key_points", "timeline", "investment", "sender_name"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 6. Create Email Logs Table
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
  status TEXT DEFAULT 'queued',
  priority TEXT DEFAULT 'normal',
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  provider TEXT DEFAULT 'sendgrid',
  provider_message_id TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_contact_id ON email_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_client_id ON email_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_scheduled_for ON email_logs(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_email_logs_provider_message_id ON email_logs(provider_message_id);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view email logs" ON email_logs;
DROP POLICY IF EXISTS "Authenticated users can manage email logs" ON email_logs;
CREATE POLICY "Authenticated users can view email logs" ON email_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage email logs" ON email_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_contact_on_email_sent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND NEW.contact_id IS NOT NULL THEN
    UPDATE contacts SET last_contact_date = NOW(), updated_at = NOW() WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contact_on_email_sent_trigger ON email_logs;
CREATE TRIGGER update_contact_on_email_sent_trigger AFTER INSERT OR UPDATE ON email_logs FOR EACH ROW EXECUTE FUNCTION update_contact_on_email_sent();

CREATE OR REPLACE VIEW contact_email_engagement AS
SELECT
  el.contact_id,
  COUNT(*) as total_emails,
  COUNT(CASE WHEN el.status = 'sent' THEN 1 END) as emails_sent,
  COUNT(CASE WHEN el.opened_at IS NOT NULL THEN 1 END) as emails_opened,
  COUNT(CASE WHEN el.clicked_at IS NOT NULL THEN 1 END) as emails_clicked,
  ROUND(CASE WHEN COUNT(CASE WHEN el.status = 'sent' THEN 1 END) = 0 THEN 0 ELSE (COUNT(CASE WHEN el.opened_at IS NOT NULL THEN 1 END)::NUMERIC / COUNT(CASE WHEN el.status = 'sent' THEN 1 END) * 100) END, 2) as open_rate,
  ROUND(CASE WHEN COUNT(CASE WHEN el.status = 'sent' THEN 1 END) = 0 THEN 0 ELSE (COUNT(CASE WHEN el.clicked_at IS NOT NULL THEN 1 END)::NUMERIC / COUNT(CASE WHEN el.status = 'sent' THEN 1 END) * 100) END, 2) as click_rate,
  MAX(el.sent_at) as last_email_sent,
  MAX(el.opened_at) as last_email_opened,
  MAX(el.clicked_at) as last_email_clicked
FROM email_logs el WHERE el.contact_id IS NOT NULL GROUP BY el.contact_id;

-- ============================================================================
-- 7. Create Email Tracking Events Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES contact_activities(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  clicked_url TEXT,
  user_agent TEXT,
  ip_address TEXT,
  sendgrid_event_id TEXT,
  sendgrid_message_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_tracking_contact_id ON email_tracking_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_activity_id ON email_tracking_events(activity_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_event_type ON email_tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_tracking_sendgrid_id ON email_tracking_events(sendgrid_message_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_created_at ON email_tracking_events(created_at DESC);

ALTER TABLE email_tracking_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view tracking events" ON email_tracking_events;
DROP POLICY IF EXISTS "Authenticated users can manage tracking events" ON email_tracking_events;
CREATE POLICY "Authenticated users can view tracking events" ON email_tracking_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tracking events" ON email_tracking_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION process_sendgrid_event(
  p_event_type TEXT, p_sendgrid_message_id TEXT, p_contact_id UUID,
  p_clicked_url TEXT DEFAULT NULL, p_user_agent TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE v_event_id UUID; v_log_id UUID;
BEGIN
  SELECT id INTO v_log_id FROM email_logs WHERE provider_message_id = p_sendgrid_message_id LIMIT 1;
  INSERT INTO email_tracking_events (contact_id, event_type, clicked_url, user_agent, ip_address, sendgrid_message_id, metadata)
  VALUES (p_contact_id, p_event_type, p_clicked_url, p_user_agent, p_ip_address, p_sendgrid_message_id, p_metadata)
  RETURNING id INTO v_event_id;
  IF p_event_type = 'delivered' THEN UPDATE email_logs SET delivered_at = NOW() WHERE id = v_log_id;
  ELSIF p_event_type = 'opened' THEN UPDATE email_logs SET opened_at = NOW() WHERE id = v_log_id AND opened_at IS NULL;
  ELSIF p_event_type = 'clicked' THEN UPDATE email_logs SET clicked_at = NOW() WHERE id = v_log_id AND clicked_at IS NULL;
  ELSIF p_event_type IN ('bounced', 'spam_report') THEN UPDATE email_logs SET status = CASE WHEN p_event_type = 'bounced' THEN 'bounced' ELSE 'rejected' END WHERE id = v_log_id;
  END IF;
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Create Lead Intent Analysis Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_intent_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  intent_status TEXT NOT NULL,
  momentum_score INTEGER NOT NULL CHECK (momentum_score >= 0 AND momentum_score <= 100),
  confidence TEXT DEFAULT 'medium',
  momentum_signals JSONB DEFAULT '[]',
  decay_signals JSONB DEFAULT '[]',
  days_since_activity INTEGER,
  reasoning TEXT,
  suggested_action TEXT DEFAULT 'hold_for_now',
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  agent_run_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_intent_analysis_contact ON lead_intent_analysis(contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_intent_analysis_lead ON lead_intent_analysis(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_intent_analysis_analyzed_at ON lead_intent_analysis(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_intent_analysis_intent_status ON lead_intent_analysis(intent_status);

ALTER TABLE lead_intent_analysis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view intent analysis" ON lead_intent_analysis;
DROP POLICY IF EXISTS "Authenticated users can manage intent analysis" ON lead_intent_analysis;
CREATE POLICY "Authenticated users can view intent analysis" ON lead_intent_analysis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage intent analysis" ON lead_intent_analysis FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION get_latest_contact_intent_analysis(p_contact_id UUID)
RETURNS TABLE (id UUID, intent_status TEXT, momentum_score INTEGER, confidence TEXT, momentum_signals JSONB, decay_signals JSONB, days_since_activity INTEGER, reasoning TEXT, suggested_action TEXT, analyzed_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY SELECT lia.id, lia.intent_status, lia.momentum_score, lia.confidence, lia.momentum_signals, lia.decay_signals, lia.days_since_activity, lia.reasoning, lia.suggested_action, lia.analyzed_at
  FROM lead_intent_analysis lia WHERE lia.contact_id = p_contact_id ORDER BY lia.analyzed_at DESC LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 9. Create Lead Mood Analysis Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_mood_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  mood_score INTEGER NOT NULL CHECK (mood_score >= 0 AND mood_score <= 100),
  mood_label TEXT NOT NULL,
  confidence TEXT DEFAULT 'medium',
  key_signals JSONB DEFAULT '[]',
  reasoning TEXT,
  suggested_action TEXT DEFAULT 'hold_for_now',
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  agent_run_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_mood_analysis_contact ON lead_mood_analysis(contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_mood_analysis_lead ON lead_mood_analysis(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_mood_analysis_analyzed_at ON lead_mood_analysis(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_mood_analysis_mood_label ON lead_mood_analysis(mood_label);

ALTER TABLE lead_mood_analysis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view mood analysis" ON lead_mood_analysis;
DROP POLICY IF EXISTS "Authenticated users can manage mood analysis" ON lead_mood_analysis;
CREATE POLICY "Authenticated users can view mood analysis" ON lead_mood_analysis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage mood analysis" ON lead_mood_analysis FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION get_latest_contact_mood_analysis(p_contact_id UUID)
RETURNS TABLE (id UUID, mood_score INTEGER, mood_label TEXT, confidence TEXT, key_signals JSONB, reasoning TEXT, suggested_action TEXT, analyzed_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY SELECT lma.id, lma.mood_score, lma.mood_label, lma.confidence, lma.key_signals, lma.reasoning, lma.suggested_action, lma.analyzed_at
  FROM lead_mood_analysis lma WHERE lma.contact_id = p_contact_id ORDER BY lma.analyzed_at DESC LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 10. Create SendGrid Config Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS sendgrid_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_encrypted TEXT,
  from_email TEXT DEFAULT 'noreply@sjinnovation.com',
  from_name TEXT DEFAULT 'SJ Innovation',
  is_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT,
  webhook_secret TEXT,
  enable_open_tracking BOOLEAN DEFAULT true,
  enable_click_tracking BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sendgrid_config_single ON sendgrid_config ((1));

ALTER TABLE sendgrid_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view config" ON sendgrid_config;
DROP POLICY IF EXISTS "Only admins can manage config" ON sendgrid_config;
CREATE POLICY "Authenticated users can view config" ON sendgrid_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage config" ON sendgrid_config FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION get_or_create_sendgrid_config()
RETURNS sendgrid_config AS $$
DECLARE config sendgrid_config;
BEGIN
  SELECT * INTO config FROM sendgrid_config LIMIT 1;
  IF config IS NULL THEN
    INSERT INTO sendgrid_config (api_key_encrypted, from_email, from_name, is_enabled, webhook_url, webhook_secret, enable_open_tracking, enable_click_tracking)
    VALUES (NULL, 'noreply@sjinnovation.com', 'SJ Innovation', false, NULL, NULL, true, true)
    RETURNING * INTO config;
  END IF;
  RETURN config;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN PERFORM get_or_create_sendgrid_config(); END $$;

-- ============================================================================
-- 11. Register Lead Follow-Up Module
-- ============================================================================
INSERT INTO app_modules (name, slug, description, icon, category, is_core, is_active, sort_order, dependencies, created_at, updated_at)
VALUES ('Lead Follow-Up', 'lead-followup', 'Contact management and engagement tracking for sales teams with AI-powered sentiment analysis, email automation, and HubSpot integration', 'Target', 'business', false, true, 10, ARRAY['business-dev'], NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon, category = EXCLUDED.category, is_active = EXCLUDED.is_active, updated_at = NOW();

-- ============================================================================
-- 12. Seed Additional Email Templates
-- ============================================================================
INSERT INTO contact_email_templates (name, subject, body, category, is_system, is_active, variables) VALUES
  ('Sales Pitch', 'How {{company_name}} Helps Companies Like {{contact_company}}', E'Hi {{first_name}},\n\nMany {{industry}} companies like {{contact_company}} struggle with {{pain_point}}.\n\n{{company_name}} helps by {{solution}}, typically resulting in {{result}}.\n\nI''d love to show you how we''ve helped similar companies. Would you have 20 minutes this week?\n\nBest regards,\n{{sender_name}}', 'sales', true, true, '["first_name", "company_name", "contact_company", "industry", "pain_point", "solution", "result", "sender_name"]'::jsonb),
  ('Upsell Opportunity', 'New Opportunity for {{contact_company}} - {{opportunity_name}}', E'Hi {{first_name}},\n\nGiven our success with {{existing_project}}, I wanted to share something new that could benefit {{contact_company}}.\n\nWe recently launched {{new_offering}}, which complements your current {{existing_solution}}. It could help with {{benefit}}.\n\nWould you be interested in exploring this? I can send over a quick overview.\n\nBest regards,\n{{sender_name}}', 'upsell', true, true, '["first_name", "contact_company", "opportunity_name", "existing_project", "new_offering", "existing_solution", "benefit", "sender_name"]'::jsonb),
  ('Re-Engagement', 'Let''s Connect Again - {{contact_name}}', E'Hi {{first_name}},\n\nIt''s been a while since we last spoke! I wanted to check in and see how {{contact_company}} is doing.\n\nThings have evolved significantly on our side with {{recent_update}}. I think there might be some relevant opportunities for your team now.\n\nCould we grab a quick 15-minute call to catch up?\n\nBest regards,\n{{sender_name}}', 'reengage', true, true, '["first_name", "contact_name", "contact_company", "recent_update", "sender_name"]'::jsonb),
  ('Meeting Follow-Up', 'Summary & Next Steps from Our Meeting', E'Hi {{first_name}},\n\nThank you for taking the time to meet yesterday. Here''s a summary of what we discussed:\n\n{{meeting_summary}}\n\nAs agreed, I''ll {{action_item_1}} by {{date_1}}, and you''ll {{action_item_2}}.\n\nLet''s schedule our next check-in for {{next_meeting_date}}.\n\nBest regards,\n{{sender_name}}', 'follow_up', true, true, '["first_name", "meeting_summary", "action_item_1", "date_1", "action_item_2", "next_meeting_date", "sender_name"]'::jsonb),
  ('Value Proposition', 'Why {{company_name}} is Different', E'Hi {{first_name}},\n\nI understand {{contact_company}} is evaluating solutions for {{business_need}}. Here''s what makes {{company_name}} stand out:\n\n{{point_1}}\n{{point_2}}\n{{point_3}}\n\nRather than me tell you more, would it make sense to see a quick demo? I can show you exactly how this would work for {{contact_company}}.\n\nAvailable {{available_times}}.\n\nBest regards,\n{{sender_name}}', 'sales', true, true, '["first_name", "company_name", "contact_company", "business_need", "point_1", "point_2", "point_3", "available_times", "sender_name"]'::jsonb),
  ('Partnership Inquiry', 'Strategic Partnership Opportunity with {{contact_company}}', E'Hi {{first_name}},\n\nI believe {{company_name}} and {{contact_company}} could create tremendous value by working together on {{opportunity}}.\n\nBased on {{reason_for_partnership}}, I think a partnership would be mutually beneficial. We could {{collaboration_benefit}}.\n\nWould you be open to exploring this further? I''d love to schedule a brief conversation.\n\nBest regards,\n{{sender_name}}', 'custom', true, true, '["first_name", "company_name", "contact_company", "opportunity", "reason_for_partnership", "collaboration_benefit", "sender_name"]'::jsonb),
  ('Resource Sharing', 'Resource You Might Find Useful', E'Hi {{first_name}},\n\nI came across this {{resource_type}} on {{topic}}, and I immediately thought of {{contact_company}} because {{reason}}.\n\nI wanted to share it with you directly: {{resource_link}}\n\nCurious to hear your thoughts. Feel free to reach out if you''d like to discuss further.\n\nBest regards,\n{{sender_name}}', 'check_in', true, true, '["first_name", "resource_type", "topic", "contact_company", "reason", "resource_link", "sender_name"]'::jsonb),
  ('Closing Follow-Up', 'Finalizing Details - {{contact_name}}', E'Hi {{first_name}},\n\nI wanted to follow up on {{deal_name}}, which we''ve been excited to move forward on.\n\nTo help us close this out, we need {{missing_info}} from your side by {{deadline}}.\n\nOnce we have that, we can {{next_step}} and get things rolling.\n\nDo you have any questions?\n\nBest regards,\n{{sender_name}}', 'follow_up', true, true, '["first_name", "contact_name", "deal_name", "missing_info", "deadline", "next_step", "sender_name"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 13. Seed Lead Follow-Up AI Agents
-- ============================================================================
INSERT INTO ai_agents (name, slug, category, description, system_prompt, provider_config, required_role, is_enabled, memory_enabled, created_at, updated_at) VALUES
  ('Client Mood Analyzer', 'client-mood-analyzer', 'sales', 'Analyzes contact sentiment and emotional state based on communication history', 'You are an expert sales psychologist analyzing client emotional state and sentiment. Based on the provided communication history, meetings, and interactions, determine the client''s mood (warm, neutral, or cold) with a confidence level. Provide key signals that indicate this mood, reasoning for your assessment, and a suggested action.', '{"provider": "gemini", "model": "gemini-2.5-flash", "fallback_provider": "openai", "fallback_model": "gpt-4o-mini", "temperature": 0.3, "max_tokens": 1000}'::jsonb, 'user', true, true, NOW(), NOW()),
  ('Client Intent & Momentum Analyzer', 'client-intent-analyzer', 'sales', 'Analyzes deal momentum and client purchase intent (active, stalled, or dormant)', 'You are an expert sales analyst assessing deal momentum and purchase intent. Based on recent activities, meeting frequency, task completion, and communication patterns, determine if this opportunity is active, stalled, or dormant. Identify positive momentum signals and decay signals. Provide a momentum score (0-100), reasoning, and suggested next action.', '{"provider": "openai", "model": "gpt-4o", "fallback_provider": "gemini", "fallback_model": "gemini-2.5-pro", "temperature": 0.3, "max_tokens": 1200}'::jsonb, 'user', true, true, NOW(), NOW()),
  ('Email Draft Generator', 'email-draft-generator', 'sales', 'Generates professional, personalized email drafts for follow-ups', 'You are an expert email copywriter specializing in sales outreach. Generate a professional, personalized email draft based on the provided context including contact information, communication history, meetings, and the specified intent (regular, sales, upsell, reengage, or thank you). The email should be concise (150-250 words), personalized, and include a clear call-to-action.', '{"provider": "openai", "model": "gpt-4o", "fallback_provider": "anthropic", "fallback_model": "claude-opus-4-6", "temperature": 0.7, "max_tokens": 800}'::jsonb, 'user', true, true, NOW(), NOW()),
  ('LinkedIn Research Agent', 'linkedin-research-agent', 'sales', 'Researches contact and company information via LinkedIn and web sources', 'You are an expert researcher conducting LinkedIn and web research. Research the provided contact information and provide insights on recent activity, job changes, company news, and relevant business context.', '{"provider": "perplexity", "model": "sonar", "temperature": 0.2, "max_tokens": 1500}'::jsonb, 'user', true, true, NOW(), NOW()),
  ('Conversation Opener Generator', 'conversation-opener-generator', 'sales', 'Generates contextual conversation starters based on contact intelligence', 'You are an expert sales conversation strategist. Based on all available contact intelligence including profile, recent activities, meetings, deals, and industry context, generate 3-5 compelling conversation openers. Each opener should be personalized, context-aware, and include a brief explanation of why it works.', '{"provider": "gemini", "model": "gemini-2.5-flash", "fallback_provider": "openai", "fallback_model": "gpt-4o-mini", "temperature": 0.8, "max_tokens": 1000}'::jsonb, 'user', true, true, NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET description = EXCLUDED.description, system_prompt = EXCLUDED.system_prompt, provider_config = EXCLUDED.provider_config, updated_at = NOW();

-- ============================================================================
-- 14. Setup Lead Follow-Up System Settings (corrected - no data_type column)
-- ============================================================================
INSERT INTO system_settings (category, key, value, description, created_at, updated_at) VALUES
  ('lead_followup', 'min_interval_days', '3', 'Minimum allowed follow-up interval in days', NOW(), NOW()),
  ('lead_followup', 'max_interval_days', '90', 'Maximum allowed follow-up interval in days', NOW(), NOW()),
  ('lead_followup', 'default_interval_days', '7', 'Default follow-up interval in days', NOW(), NOW()),
  ('email_tracking', 'enable_open_tracking', 'true', 'Enable email open tracking via pixels', NOW(), NOW()),
  ('email_tracking', 'enable_click_tracking', 'true', 'Enable email click tracking via link rewriting', NOW(), NOW()),
  ('lead_followup', 'auto_status_enabled', 'true', 'Enable automatic status rule application', NOW(), NOW())
ON CONFLICT (category, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

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

-- 20260211_deals_module_fixes.sql
-- ============================================================================
-- Deals Module Fixes Migration
-- ============================================================================
-- 1. Add missing FK constraint: deals.client_id → clients(id)
-- 2. Add FK constraints to profiles for PostgREST relationship joins
-- 3. Add missing columns to contacts for follow-up automation
-- 4. Tighten RLS policies on deal tables (owner-based write access)
-- ============================================================================

-- ========================
-- FK Constraints
-- ========================

-- deals.client_id → clients(id) (was missing)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deals_client_id_fkey') THEN
    ALTER TABLE deals ADD CONSTRAINT deals_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- FK to profiles for PostgREST relationship embedding (owner/creator joins)
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

-- ========================
-- Contacts: add missing columns for follow-up automation
-- ========================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_status TEXT DEFAULT 'new';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_lead_follow_up BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_followup_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_followup_status ON contacts(followup_status) WHERE is_lead_follow_up = true;

-- ========================
-- Tighten RLS policies
-- ========================
-- Keep SELECT policies (all authenticated users can view) but restrict
-- INSERT/UPDATE/DELETE to deal owners, creators, or the acting user.

-- Deals: drop the overly-permissive "manage" policy, add owner/creator restriction
DROP POLICY IF EXISTS "Authenticated users can manage deals" ON deals;
CREATE POLICY "Deal owners and creators can manage deals" ON deals
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (owner_id = auth.uid() OR created_by = auth.uid());

-- Deal activities: restrict to activity author or deal owner/creator
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

-- Deal comments: restrict to comment author or deal owner/creator
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


-- 20260211_meetings_replication_alignment.sql
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


