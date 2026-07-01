-- Fix RLS for graph_webhook_logs to be service-role only (no public access)
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage webhook logs" ON public.graph_webhook_logs;

-- Create a policy that only allows authenticated users to read their own subscription logs
-- Edge functions with service_role key bypass RLS entirely
CREATE POLICY "Users can view logs for their subscriptions"
  ON public.graph_webhook_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.graph_webhook_subscriptions s
      WHERE s.subscription_id = graph_webhook_logs.subscription_id
      AND s.user_id = auth.uid()
    )
  );

-- Fix function search path for update_graph_webhook_updated_at
CREATE OR REPLACE FUNCTION update_graph_webhook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;