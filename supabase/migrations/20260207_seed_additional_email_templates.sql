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
