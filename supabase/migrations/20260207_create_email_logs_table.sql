-- ============================================================================
-- Create Email Logs Table
-- ============================================================================
-- Comprehensive email logging system extending scheduled_emails. Tracks all
-- sent/received emails with SendGrid integration, templates, and engagement.
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES contact_email_templates(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  recipient_name TEXT,
  cc TEXT,
  bcc TEXT,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  status TEXT DEFAULT 'queued'
    CHECK (status IN ('queued', 'sending', 'sent', 'scheduled', 'failed', 'bounced', 'rejected', 'cancelled')),
  priority TEXT DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  provider TEXT DEFAULT 'sendgrid'
    CHECK (provider IN ('sendgrid', 'ses', 'smtp')),
  provider_message_id TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_contact_id ON email_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_client_id ON email_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_scheduled_for ON email_logs(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_email_logs_provider_message_id ON email_logs(provider_message_id);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view email logs" ON email_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage email logs" ON email_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create trigger to update contact's last_contact_date on sent email
CREATE OR REPLACE FUNCTION update_contact_on_email_sent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND NEW.contact_id IS NOT NULL THEN
    UPDATE contacts
    SET last_contact_date = NOW(),
        updated_at = NOW()
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contact_on_email_sent_trigger ON email_logs;
CREATE TRIGGER update_contact_on_email_sent_trigger
AFTER INSERT OR UPDATE ON email_logs
FOR EACH ROW
EXECUTE FUNCTION update_contact_on_email_sent();

-- Create view for email engagement metrics per contact
CREATE OR REPLACE VIEW contact_email_engagement AS
SELECT
  el.contact_id,
  COUNT(*) as total_emails,
  COUNT(CASE WHEN el.status = 'sent' THEN 1 END) as emails_sent,
  COUNT(CASE WHEN el.opened_at IS NOT NULL THEN 1 END) as emails_opened,
  COUNT(CASE WHEN el.clicked_at IS NOT NULL THEN 1 END) as emails_clicked,
  ROUND(
    CASE
      WHEN COUNT(CASE WHEN el.status = 'sent' THEN 1 END) = 0 THEN 0
      ELSE (COUNT(CASE WHEN el.opened_at IS NOT NULL THEN 1 END)::NUMERIC / COUNT(CASE WHEN el.status = 'sent' THEN 1 END) * 100)
    END,
    2
  ) as open_rate,
  ROUND(
    CASE
      WHEN COUNT(CASE WHEN el.status = 'sent' THEN 1 END) = 0 THEN 0
      ELSE (COUNT(CASE WHEN el.clicked_at IS NOT NULL THEN 1 END)::NUMERIC / COUNT(CASE WHEN el.status = 'sent' THEN 1 END) * 100)
    END,
    2
  ) as click_rate,
  MAX(el.sent_at) as last_email_sent,
  MAX(el.opened_at) as last_email_opened,
  MAX(el.clicked_at) as last_email_clicked
FROM email_logs el
WHERE el.contact_id IS NOT NULL
GROUP BY el.contact_id;

-- Create helper function to get email engagement metrics
CREATE OR REPLACE FUNCTION get_contact_email_engagement_metrics(contact_id UUID)
RETURNS TABLE (
  total_emails INTEGER,
  emails_sent INTEGER,
  emails_opened INTEGER,
  emails_clicked INTEGER,
  open_rate NUMERIC,
  click_rate NUMERIC,
  last_email_sent TIMESTAMPTZ,
  last_email_opened TIMESTAMPTZ,
  last_email_clicked TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cee.total_emails,
    cee.emails_sent,
    cee.emails_opened,
    cee.emails_clicked,
    cee.open_rate,
    cee.click_rate,
    cee.last_email_sent,
    cee.last_email_opened,
    cee.last_email_clicked
  FROM contact_email_engagement cee
  WHERE cee.contact_id = $1;
END;
$$ LANGUAGE plpgsql STABLE;
