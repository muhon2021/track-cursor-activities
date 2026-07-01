-- ============================================================================
-- Create Email Tracking Events Table
-- ============================================================================
-- Tracks email engagement events: opens, clicks, bounces, spam reports.
-- Integrates with SendGrid webhook data for engagement tracking.
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES contact_activities(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'spam_report')),
  clicked_url TEXT,
  user_agent TEXT,
  ip_address TEXT,
  sendgrid_event_id TEXT,
  sendgrid_message_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_tracking_contact_id ON email_tracking_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_activity_id ON email_tracking_events(activity_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_event_type ON email_tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_tracking_sendgrid_id ON email_tracking_events(sendgrid_message_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_created_at ON email_tracking_events(created_at DESC);

-- Enable RLS
ALTER TABLE email_tracking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view tracking events" ON email_tracking_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tracking events" ON email_tracking_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create function to process SendGrid events
CREATE OR REPLACE FUNCTION process_sendgrid_event(
  p_event_type TEXT,
  p_sendgrid_message_id TEXT,
  p_contact_id UUID,
  p_clicked_url TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_log_id UUID;
BEGIN
  -- Find the email log for this message
  SELECT id INTO v_log_id
  FROM email_logs
  WHERE provider_message_id = p_sendgrid_message_id
  LIMIT 1;

  -- Create tracking event
  INSERT INTO email_tracking_events (
    contact_id,
    event_type,
    clicked_url,
    user_agent,
    ip_address,
    sendgrid_message_id,
    metadata
  ) VALUES (
    p_contact_id,
    p_event_type,
    p_clicked_url,
    p_user_agent,
    p_ip_address,
    p_sendgrid_message_id,
    p_metadata
  )
  RETURNING id INTO v_event_id;

  -- Update email_logs status based on event type
  IF p_event_type = 'delivered' THEN
    UPDATE email_logs SET delivered_at = NOW() WHERE id = v_log_id;
  ELSIF p_event_type = 'opened' THEN
    UPDATE email_logs SET opened_at = NOW() WHERE id = v_log_id AND opened_at IS NULL;
  ELSIF p_event_type = 'clicked' THEN
    UPDATE email_logs SET clicked_at = NOW() WHERE id = v_log_id AND clicked_at IS NULL;
  ELSIF p_event_type IN ('bounced', 'spam_report') THEN
    UPDATE email_logs SET status = CASE WHEN p_event_type = 'bounced' THEN 'bounced' ELSE 'rejected' END WHERE id = v_log_id;
  END IF;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;
