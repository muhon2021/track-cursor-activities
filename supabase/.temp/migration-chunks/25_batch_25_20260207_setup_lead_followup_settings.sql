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


