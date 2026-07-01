-- ============================================================================
-- Create Prompt Templates Table (AI Hub - Admin)
-- ============================================================================
-- Reusable AI prompt templates with placeholders (e.g. {{recipient_name}}).
-- Used for email generation, deal coaching, and other AI agent prompts.
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'General Purpose',
  template_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_slug ON prompt_templates(slug);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_active ON prompt_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_usage ON prompt_templates(usage_count DESC);

ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

-- Admin / authenticated users can manage (restrict to admin in app or add role check)
CREATE POLICY "Authenticated users can view prompt templates"
  ON prompt_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert prompt templates"
  ON prompt_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update prompt templates"
  ON prompt_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete prompt templates"
  ON prompt_templates FOR DELETE TO authenticated USING (true);

-- Seed example templates
INSERT INTO prompt_templates (name, slug, description, category, template_content, is_active) VALUES
  (
    'Professional Email',
    'professional-email',
    'Standard professional email template.',
    'Email Generation',
    'Write a professional email to {{recipient_name}} about {{topic}}. Keep the tone {{tone}} and length {{length}}.',
    true
  ),
  (
    'Follow-up Email',
    'follow-up-email',
    'Follow-up after initial contact.',
    'Email Generation',
    'Draft a brief follow-up email to {{recipient_name}} regarding {{subject}}. Be polite and include a clear next step.',
    true
  ),
  (
    'Meeting Summary',
    'meeting-summary',
    'Summarize meeting notes into bullet points.',
    'General Purpose',
    'Summarize the following meeting notes into clear bullet points. Include: attendees, decisions, and action items.',
    true
  ),
  (
    'Deal Update',
    'deal-update',
    'Structured update for deal progress.',
    'General Purpose',
    'Write a concise deal update for {{deal_name}}. Include: current stage, next steps, and any blockers.',
    true
  )
ON CONFLICT (slug) DO NOTHING;
