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
