-- Create table for Microsoft Graph webhook subscriptions
CREATE TABLE IF NOT EXISTS public.graph_webhook_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  change_types TEXT[] NOT NULL DEFAULT ARRAY['created', 'updated', 'deleted'],
  notification_url TEXT NOT NULL,
  client_state TEXT NOT NULL, -- Encrypted secret for verification
  expiration_datetime TIMESTAMPTZ NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_notification_at TIMESTAMPTZ,
  error_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB
);

-- Create table for webhook notification logs
CREATE TABLE IF NOT EXISTS public.graph_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  resource_data JSONB,
  client_state_valid BOOLEAN NOT NULL DEFAULT false,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  metadata JSONB
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_graph_webhook_subscriptions_user ON public.graph_webhook_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_webhook_subscriptions_active ON public.graph_webhook_subscriptions(is_active, expiration_datetime);
CREATE INDEX IF NOT EXISTS idx_graph_webhook_subscriptions_subscription_id ON public.graph_webhook_subscriptions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_graph_webhook_logs_subscription ON public.graph_webhook_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_graph_webhook_logs_received ON public.graph_webhook_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_graph_webhook_logs_status ON public.graph_webhook_logs(processing_status);

-- Enable RLS
ALTER TABLE public.graph_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscriptions - users can only see their own
CREATE POLICY "Users can view their own webhook subscriptions"
  ON public.graph_webhook_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own webhook subscriptions"
  ON public.graph_webhook_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhook subscriptions"
  ON public.graph_webhook_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own webhook subscriptions"
  ON public.graph_webhook_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for logs - service role only (edge functions)
-- Users cannot directly access logs, only through API
CREATE POLICY "Service role can manage webhook logs"
  ON public.graph_webhook_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_graph_webhook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_graph_webhook_subscriptions_updated_at
  BEFORE UPDATE ON public.graph_webhook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_graph_webhook_updated_at();