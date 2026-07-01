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
