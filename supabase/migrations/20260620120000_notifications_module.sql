-- Enterprise Notifications Module
-- Extends existing notifications table; adds event catalog, preferences, rules, logs, digest queue.

-- ========================
-- Event catalog
-- ========================
CREATE TABLE IF NOT EXISTS public.notification_events (
  event_key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN (
    'tasks', 'meetings', 'eos', 'system', 'integrations', 'ai', 'mentions', 'users', 'departments'
  )),
  description TEXT NOT NULL DEFAULT '',
  default_severity TEXT NOT NULL DEFAULT 'info'
    CHECK (default_severity IN ('info', 'success', 'warning', 'error', 'critical')),
  default_priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (default_priority IN ('low', 'medium', 'high', 'urgent')),
  default_channels TEXT[] NOT NULL DEFAULT ARRAY['in_app']::TEXT[],
  is_subscribable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- Extend notifications (backward compatible)
-- ========================
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)
    DEFAULT '00000000-0000-0000-0000-000000000001',
  ADD COLUMN IF NOT EXISTS event_key TEXT REFERENCES public.notification_events(event_key),
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info'
    CHECK (severity IN ('info', 'success', 'warning', 'error', 'critical')),
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Sync severity from legacy type column
UPDATE public.notifications
SET severity = type
WHERE severity IS NULL OR severity = 'info' AND type IS DISTINCT FROM 'info';

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_category
  ON public.notifications(user_id, category);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_event
  ON public.notifications(tenant_id, event_key);
CREATE INDEX IF NOT EXISTS idx_notifications_active
  ON public.notifications(user_id) WHERE archived_at IS NULL;

-- ========================
-- User global preferences
-- ========================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  digest_mode TEXT NOT NULL DEFAULT 'instant'
    CHECK (digest_mode IN ('instant', 'hourly', 'daily', 'weekly')),
  mute_until TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  language TEXT NOT NULL DEFAULT 'en',
  working_hours JSONB NOT NULL DEFAULT '{"start":"09:00","end":"17:00","days":[1,2,3,4,5]}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ========================
-- Per-event subscriptions
-- ========================
CREATE TABLE IF NOT EXISTS public.notification_event_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL REFERENCES public.notification_events(event_key) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  in_app BOOLEAN NOT NULL DEFAULT true,
  email BOOLEAN NOT NULL DEFAULT false,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_key, department_id)
);

-- ========================
-- Role-based defaults
-- ========================
CREATE TABLE IF NOT EXISTS public.notification_role_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  role_slug TEXT NOT NULL,
  event_key TEXT NOT NULL REFERENCES public.notification_events(event_key) ON DELETE CASCADE,
  in_app BOOLEAN NOT NULL DEFAULT true,
  email BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, role_slug, event_key)
);

-- ========================
-- Admin routing rules
-- ========================
CREATE TABLE IF NOT EXISTS public.notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  channels TEXT[] NOT NULL DEFAULT ARRAY['in_app']::TEXT[],
  target_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  target_departments UUID[] DEFAULT ARRAY[]::UUID[],
  escalation JSONB DEFAULT '{}'::jsonb,
  priority_override TEXT CHECK (priority_override IN ('low', 'medium', 'high', 'urgent')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_rules_tenant_active
  ON public.notification_rules(tenant_id, is_active, sort_order);

-- ========================
-- Templates
-- ========================
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  event_key TEXT NOT NULL REFERENCES public.notification_events(event_key) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'slack', 'teams', 'sms', 'webhook', 'push')),
  subject TEXT,
  body TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_lookup
  ON public.notification_templates(tenant_id, event_key, channel, locale, is_active);

-- ========================
-- Delivery logs
-- ========================
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  event_key TEXT REFERENCES public.notification_events(event_key),
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'slack', 'teams', 'sms', 'webhook', 'push')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'delivered', 'read', 'failed', 'expired')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user
  ON public.notification_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status
  ON public.notification_logs(tenant_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_logs_idempotency
  ON public.notification_logs(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ========================
-- Digest queue
-- ========================
CREATE TABLE IF NOT EXISTS public.notification_digest_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id),
  event_key TEXT REFERENCES public.notification_events(event_key),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  digest_mode TEXT NOT NULL CHECK (digest_mode IN ('hourly', 'daily', 'weekly')),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digest_queue_pending
  ON public.notification_digest_queue(user_id, digest_mode, scheduled_for)
  WHERE processed_at IS NULL;

-- ========================
-- Seed event catalog
-- ========================
INSERT INTO public.notification_events (event_key, category, description, default_severity, default_priority, default_channels, is_subscribable)
VALUES
  ('user.invited', 'users', 'User invited to workspace', 'info', 'medium', ARRAY['in_app','email'], true),
  ('task.assigned', 'tasks', 'Task assigned to user', 'info', 'high', ARRAY['in_app','email'], true),
  ('task.completed', 'tasks', 'Task marked complete', 'success', 'low', ARRAY['in_app'], true),
  ('meeting.scheduled', 'meetings', 'Meeting scheduled', 'info', 'medium', ARRAY['in_app','email'], true),
  ('meeting.reminder', 'meetings', 'Meeting reminder', 'info', 'high', ARRAY['in_app','email'], true),
  ('rock.overdue', 'eos', 'Rock past due date', 'warning', 'high', ARRAY['in_app','email'], true),
  ('issue.escalated', 'eos', 'Issue escalated', 'error', 'urgent', ARRAY['in_app','email'], true),
  ('comment.added', 'mentions', 'Comment added on entity', 'info', 'medium', ARRAY['in_app'], true),
  ('mention.added', 'mentions', 'User mentioned', 'info', 'high', ARRAY['in_app','email'], true),
  ('document.synced', 'integrations', 'Document synced successfully', 'success', 'low', ARRAY['in_app'], true),
  ('sync.failed', 'integrations', 'Sync operation failed', 'error', 'high', ARRAY['in_app','email'], true),
  ('ai.agent.completed', 'ai', 'AI agent run completed', 'info', 'medium', ARRAY['in_app'], true),
  ('memory.updated', 'ai', 'Agent memory updated', 'info', 'low', ARRAY['in_app'], false),
  ('integration.error', 'integrations', 'Integration error', 'error', 'urgent', ARRAY['in_app','email'], true),
  ('permission.changed', 'system', 'User permission changed', 'warning', 'high', ARRAY['in_app','email'], true),
  ('role.updated', 'system', 'User role updated', 'warning', 'high', ARRAY['in_app','email'], true),
  ('department.created', 'departments', 'Department created', 'info', 'low', ARRAY['in_app'], true),
  ('system.alert', 'system', 'System alert', 'warning', 'medium', ARRAY['in_app'], true),
  ('scorecard.missed', 'eos', 'Scorecard metric off track', 'warning', 'medium', ARRAY['in_app'], true),
  ('todo.assigned', 'eos', 'EOS todo assigned', 'info', 'medium', ARRAY['in_app'], true)
ON CONFLICT (event_key) DO NOTHING;

-- Map EOS legacy event types
INSERT INTO public.notification_event_subscriptions (user_id, event_key, in_app, email, tenant_id)
SELECT
  p.user_id,
  CASE p.event_type
    WHEN 'rock_overdue' THEN 'rock.overdue'
    WHEN 'meeting_reminder' THEN 'meeting.reminder'
    WHEN 'todo_assigned' THEN 'todo.assigned'
    WHEN 'issue_escalated' THEN 'issue.escalated'
    WHEN 'scorecard_missed' THEN 'scorecard.missed'
    ELSE p.event_type
  END,
  p.in_app,
  p.email,
  p.tenant_id
FROM public.eos_notification_preferences p
WHERE to_regclass('public.eos_notification_preferences') IS NOT NULL
ON CONFLICT (user_id, event_key, department_id) DO NOTHING;

-- Backfill category/event_key on existing notifications from metadata
UPDATE public.notifications n
SET
  category = COALESCE(n.category, n.metadata->>'module', 'system'),
  event_key = COALESCE(n.event_key, CASE n.metadata->>'module'
    WHEN 'eos' THEN 'system.alert'
    ELSE NULL
  END),
  severity = COALESCE(n.severity, n.type, 'info')
WHERE n.category IS NULL OR n.severity IS NULL;

-- ========================
-- RLS
-- ========================
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_event_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_role_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_digest_queue ENABLE ROW LEVEL SECURITY;

-- Event catalog: readable by all authenticated
DROP POLICY IF EXISTS "notif_events_select" ON public.notification_events;
CREATE POLICY "notif_events_select" ON public.notification_events
  FOR SELECT TO authenticated USING (true);

-- Preferences: own rows
DROP POLICY IF EXISTS "notif_prefs_own" ON public.notification_preferences;
CREATE POLICY "notif_prefs_own" ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Subscriptions: own rows
DROP POLICY IF EXISTS "notif_subs_own" ON public.notification_event_subscriptions;
CREATE POLICY "notif_subs_own" ON public.notification_event_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Role defaults: view all; manage admin
DROP POLICY IF EXISTS "notif_role_defaults_select" ON public.notification_role_defaults;
CREATE POLICY "notif_role_defaults_select" ON public.notification_role_defaults
  FOR SELECT TO authenticated USING (true);

-- Rules, templates: admin only (with has_permission when available)
DO $$ BEGIN
  IF to_regprocedure('public.has_permission(uuid,text)') IS NOT NULL THEN
    DROP POLICY IF EXISTS "notif_rules_admin" ON public.notification_rules;
    CREATE POLICY "notif_rules_admin" ON public.notification_rules
      FOR ALL TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'notifications.admin')
      )
      WITH CHECK (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'notifications.admin')
      );

    DROP POLICY IF EXISTS "notif_templates_admin" ON public.notification_templates;
    CREATE POLICY "notif_templates_admin" ON public.notification_templates
      FOR ALL TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'notifications.admin')
      )
      WITH CHECK (
        tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'notifications.admin')
      );

    DROP POLICY IF EXISTS "notif_role_defaults_admin" ON public.notification_role_defaults;
    CREATE POLICY "notif_role_defaults_admin" ON public.notification_role_defaults
      FOR ALL TO authenticated
      USING (public.has_permission(auth.uid(), 'notifications.admin'))
      WITH CHECK (public.has_permission(auth.uid(), 'notifications.admin'));

    -- Tighten notifications policies
    DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
    CREATE POLICY "Users can view their own notifications" ON public.notifications
      FOR SELECT TO authenticated
      USING (
        auth.uid() = user_id
        AND public.has_permission(auth.uid(), 'notifications.view')
      );

    DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
    CREATE POLICY "Users can update their own notifications" ON public.notifications
      FOR UPDATE TO authenticated
      USING (
        auth.uid() = user_id
        AND public.has_permission(auth.uid(), 'notifications.edit')
      )
      WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
    CREATE POLICY "Users can delete their own notifications" ON public.notifications
      FOR DELETE TO authenticated
      USING (
        auth.uid() = user_id
        AND public.has_permission(auth.uid(), 'notifications.edit')
      );

    DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
    CREATE POLICY "Users can create notifications" ON public.notifications
      FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'notifications.create'));

    -- Delivery logs
    DROP POLICY IF EXISTS "notif_logs_own" ON public.notification_logs;
    CREATE POLICY "notif_logs_own" ON public.notification_logs
      FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR public.has_permission(auth.uid(), 'notifications.export')
      );

    DROP POLICY IF EXISTS "notif_digest_own" ON public.notification_digest_queue;
    CREATE POLICY "notif_digest_own" ON public.notification_digest_queue
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  ELSE
    -- Fallback without has_permission
    DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
    CREATE POLICY "Users can delete their own notifications" ON public.notifications
      FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- Service role bypasses RLS for edge functions

-- updated_at trigger for preferences
CREATE OR REPLACE FUNCTION public.notification_preferences_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_preferences_updated ON public.notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.notification_preferences_updated_at();

-- EOS compat view
CREATE OR REPLACE VIEW public.eos_notification_preferences_compat AS
SELECT
  s.id,
  s.user_id,
  CASE s.event_key
    WHEN 'rock.overdue' THEN 'rock_overdue'
    WHEN 'meeting.reminder' THEN 'meeting_reminder'
    WHEN 'todo.assigned' THEN 'todo_assigned'
    WHEN 'issue.escalated' THEN 'issue_escalated'
    WHEN 'scorecard.missed' THEN 'scorecard_missed'
    ELSE s.event_key
  END AS event_type,
  s.in_app,
  s.email,
  s.tenant_id,
  s.created_at
FROM public.notification_event_subscriptions s
WHERE s.department_id IS NULL
  AND s.event_key IN ('rock.overdue','meeting.reminder','todo.assigned','issue.escalated','scorecard.missed');
