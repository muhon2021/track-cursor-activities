-- Add notes column to eos_scorecard_metrics for pod/role/commentary (JSON string)
ALTER TABLE eos_scorecard_metrics
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN eos_scorecard_metrics.notes IS 'JSON string: { podId?, role?, commentary? }';
