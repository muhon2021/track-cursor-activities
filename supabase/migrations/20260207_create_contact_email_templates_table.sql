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
