-- ============================================
-- Webhook Logs Table
-- Stores incoming webhook events for debugging and audit
-- Sprint 5: Edge Functions Deployment
-- ============================================

-- Create the webhook_logs table
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,              -- 'zoom', 'google', 'microsoft', etc.
  event_type TEXT NOT NULL,            -- Event type from provider
  payload JSONB NOT NULL DEFAULT '{}', -- Full webhook payload
  processed BOOLEAN DEFAULT false,     -- Whether event has been processed
  processed_at TIMESTAMPTZ,           -- When event was processed
  error_message TEXT,                  -- Error if processing failed
  received_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider
  ON public.webhook_logs(provider);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type
  ON public.webhook_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_received_at
  ON public.webhook_logs(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed
  ON public.webhook_logs(processed)
  WHERE processed = false;

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook logs (for debugging)
CREATE POLICY "Admins can view webhook logs"
  ON public.webhook_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role can insert logs (edge functions)
CREATE POLICY "Service role can insert webhook logs"
  ON public.webhook_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can update logs
CREATE POLICY "Service role can update webhook logs"
  ON public.webhook_logs
  FOR UPDATE
  TO service_role
  USING (true);

-- Comments
COMMENT ON TABLE public.webhook_logs IS 'Stores incoming webhook events from external providers for debugging and audit purposes';
COMMENT ON COLUMN public.webhook_logs.provider IS 'Provider identifier (zoom, google, microsoft)';
COMMENT ON COLUMN public.webhook_logs.event_type IS 'Event type from the provider (e.g., recording.completed)';
COMMENT ON COLUMN public.webhook_logs.payload IS 'Full JSON payload received from the webhook';
COMMENT ON COLUMN public.webhook_logs.processed IS 'Whether the event has been successfully processed';

-- Cleanup old logs (keep 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.webhook_logs
  WHERE received_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'webhook_logs table created successfully for Sprint 5!';
END $$;
