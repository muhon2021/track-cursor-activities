-- ============================================================================
-- Migrate Scheduled Emails to Email Logs
-- ============================================================================
-- Migrates data from scheduled_emails table to the new email_logs table.
-- Keeps scheduled_emails for backward compatibility but directs new emails
-- to email_logs.
-- ============================================================================

-- Insert existing scheduled emails into email_logs
INSERT INTO email_logs (
  user_id,
  contact_id,
  client_id,
  recipient,
  subject,
  body_text,
  status,
  scheduled_for,
  sent_at,
  provider,
  metadata,
  created_at,
  updated_at
)
SELECT
  COALESCE(se.created_by, (SELECT id FROM auth.users LIMIT 1)),
  se.contact_id,
  se.deal_id,
  se.to_email,
  se.subject,
  se.body,
  CASE
    WHEN se.status = 'pending' THEN 'scheduled'
    WHEN se.status = 'sent' THEN 'sent'
    WHEN se.status = 'failed' THEN 'failed'
    WHEN se.status = 'cancelled' THEN 'cancelled'
    ELSE 'queued'
  END,
  se.scheduled_for,
  se.sent_at,
  'sendgrid',
  jsonb_build_object(
    'source', 'scheduled_emails_migration',
    'original_id', se.id::text,
    'original_status', se.status
  ),
  se.created_at,
  COALESCE(se.sent_at, NOW())
FROM scheduled_emails se
WHERE NOT EXISTS (
  SELECT 1 FROM email_logs el
  WHERE el.metadata->>'original_id' = se.id::text
)
ON CONFLICT DO NOTHING;

-- Log migration completion
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM email_logs
  WHERE metadata->>'source' = 'scheduled_emails_migration';

  RAISE NOTICE 'Migrated % scheduled emails to email_logs', migrated_count;
END $$;
