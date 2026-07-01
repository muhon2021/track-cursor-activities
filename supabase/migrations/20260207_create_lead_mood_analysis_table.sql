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
