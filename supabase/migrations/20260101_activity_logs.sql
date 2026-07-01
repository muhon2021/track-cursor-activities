-- Activity logs table for tracking user actions
-- This table records all significant user actions for auditing and monitoring
-- Admins can view all logs, users can view their own

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_resource ON public.activity_logs(resource_type, resource_id);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all activity logs
CREATE POLICY "Admins can view all activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own activity logs
CREATE POLICY "Users can view own activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only system/backend can insert logs (users can't manually create logs)
-- This will be done through edge functions or triggers
CREATE POLICY "Service role can insert activity logs"
  ON public.activity_logs
  FOR INSERT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Helper function to log activity
CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id uuid,
  p_action text,
  p_resource_type text DEFAULT NULL,
  p_resource_id text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.activity_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert some example activity logs for testing (optional - remove in production)
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get first user ID for demo data
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.activity_logs (user_id, action, resource_type, resource_id, details, created_at) VALUES
      (v_user_id, 'user.login', NULL, NULL, '{"method": "email"}'::jsonb, now() - interval '1 hour'),
      (v_user_id, 'client.created', 'client', '123', '{"name": "Acme Corp"}'::jsonb, now() - interval '2 hours'),
      (v_user_id, 'meeting.scheduled', 'meeting', '456', '{"title": "Kickoff Meeting"}'::jsonb, now() - interval '3 hours'),
      (v_user_id, 'agent.created', 'agent', '789', '{"name": "Sales Assistant"}'::jsonb, now() - interval '5 hours'),
      (v_user_id, 'settings.updated', NULL, NULL, '{"section": "profile"}'::jsonb, now() - interval '1 day');
  END IF;
END $$;
