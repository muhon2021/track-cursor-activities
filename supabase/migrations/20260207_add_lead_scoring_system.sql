-- ============================================================================
-- Add Lead Scoring System Migration
-- ============================================================================
-- Extends contacts table with a 100-point lead scoring system including
-- engagement, deal potential, profile completeness, and recency scores.
-- ============================================================================

-- Add lead scoring columns to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_temperature TEXT DEFAULT 'cold'
  CHECK (lead_temperature IN ('hot', 'warm', 'cold'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS profile_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deal_potential_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS recency_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_score_calculated_at TIMESTAMPTZ;

-- Create indexes for lead scoring
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON contacts(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_temperature ON contacts(lead_temperature);
CREATE INDEX IF NOT EXISTS idx_contacts_score_temp ON contacts(lead_score DESC, lead_temperature);

-- Create helper function to calculate lead score
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
  -- Get current engagement and deal potential scores
  SELECT
    COALESCE(engagement_score, 0),
    COALESCE(deal_potential_score, 0),
    last_contact_date
  INTO v_engagement_score, v_deal_potential_score, v_last_contact
  FROM contacts WHERE id = contact_id;

  -- Calculate profile score (0-20)
  -- Email: 4 points, Phone: 4 points, LinkedIn: 6 points, Title: 3 points, Dept: 3 points
  IF (SELECT email IS NOT NULL FROM contacts WHERE id = contact_id) THEN
    v_profile_score := v_profile_score + 4;
  END IF;
  IF (SELECT phone IS NOT NULL FROM contacts WHERE id = contact_id) THEN
    v_profile_score := v_profile_score + 4;
  END IF;
  IF (SELECT linkedin_url IS NOT NULL FROM contacts WHERE id = contact_id) THEN
    v_profile_score := v_profile_score + 6;
  END IF;
  IF (SELECT title IS NOT NULL FROM contacts WHERE id = contact_id) THEN
    v_profile_score := v_profile_score + 3;
  END IF;
  IF (SELECT department IS NOT NULL FROM contacts WHERE id = contact_id) THEN
    v_profile_score := v_profile_score + 3;
  END IF;

  -- Calculate recency score (0-10)
  IF v_last_contact IS NOT NULL THEN
    v_days_since := EXTRACT(DAY FROM NOW() - v_last_contact);
    IF v_days_since <= 7 THEN
      v_recency_score := 10;
    ELSIF v_days_since <= 14 THEN
      v_recency_score := 8;
    ELSIF v_days_since <= 30 THEN
      v_recency_score := 6;
    ELSIF v_days_since <= 60 THEN
      v_recency_score := 4;
    ELSIF v_days_since <= 90 THEN
      v_recency_score := 2;
    ELSE
      v_recency_score := 0;
    END IF;
  ELSE
    v_recency_score := 0;
  END IF;

  -- Calculate total score (0-100)
  v_total_score := v_profile_score + v_recency_score + v_engagement_score + v_deal_potential_score;
  IF v_total_score > 100 THEN
    v_total_score := 100;
  END IF;

  -- Determine temperature
  IF v_total_score >= 67 THEN
    v_temperature := 'hot';
  ELSIF v_total_score >= 34 THEN
    v_temperature := 'warm';
  ELSE
    v_temperature := 'cold';
  END IF;

  RETURN QUERY SELECT v_total_score, v_temperature, v_engagement_score, v_profile_score, v_deal_potential_score, v_recency_score;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function to update lead score automatically
CREATE OR REPLACE FUNCTION update_contact_lead_score()
RETURNS TRIGGER AS $$
DECLARE
  score_data RECORD;
BEGIN
  -- Only calculate for lead follow-up contacts
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

-- Create trigger for lead score calculation
DROP TRIGGER IF EXISTS update_contact_lead_score_trigger ON contacts;
CREATE TRIGGER update_contact_lead_score_trigger
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION update_contact_lead_score();

-- Create function to calculate next followup date
CREATE OR REPLACE FUNCTION calculate_next_followup_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate if is_lead_follow_up is true and last_contact_date exists
  IF NEW.is_lead_follow_up AND NEW.last_contact_date IS NOT NULL THEN
    NEW.next_followup_date := NEW.last_contact_date + (COALESCE(NEW.followup_interval_days, 7) || ' days')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for next followup date calculation
DROP TRIGGER IF EXISTS update_contact_followup_date_trigger ON contacts;
CREATE TRIGGER update_contact_followup_date_trigger
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION calculate_next_followup_date();
