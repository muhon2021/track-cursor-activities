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
