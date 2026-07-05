-- 20260623120000_automation_engine.sql
-- ============================================================================
-- Enterprise Automation Engine
-- Workflows, executions, templates, outbox, schedules, webhooks, approvals
-- ============================================================================

-- ========================
-- automation_workflows
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT false,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  definition JSONB NOT NULL DEFAULT '{"version":1,"nodes":[],"edges":[]}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_workflows_tenant_enabled
  ON public.automation_workflows(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_automation_workflows_trigger_type
  ON public.automation_workflows(trigger_type) WHERE enabled = true;

-- ========================
-- automation_steps
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN (
    'trigger', 'condition', 'action', 'delay', 'approval', 'loop', 'branch'
  )),
  position INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  depends_on TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_automation_steps_workflow
  ON public.automation_steps(workflow_id, position);

-- ========================
-- automation_executions
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'cancelled', 'paused'
  )),
  trigger_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  current_step_key TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  paused_until TIMESTAMPTZ,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_executions_idempotency
  ON public.automation_executions(workflow_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automation_executions_status
  ON public.automation_executions(status, created_at)
  WHERE status IN ('pending', 'paused');

CREATE INDEX IF NOT EXISTS idx_automation_executions_workflow
  ON public.automation_executions(workflow_id, created_at DESC);

-- ========================
-- automation_execution_logs
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.automation_executions(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.automation_steps(id) ON DELETE SET NULL,
  step_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'skipped', 'waiting'
  )),
  input JSONB DEFAULT '{}'::jsonb,
  output JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  duration_ms INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_execution_logs_execution
  ON public.automation_execution_logs(execution_id, created_at);

-- ========================
-- automation_templates
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  definition JSONB NOT NULL DEFAULT '{"version":1,"nodes":[],"edges":[]}'::jsonb,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_templates_category
  ON public.automation_templates(category, is_published);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_templates_system_name
  ON public.automation_templates(name) WHERE is_system = true;

-- ========================
-- automation_event_outbox
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_event_outbox_unprocessed
  ON public.automation_event_outbox(created_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_automation_event_outbox_event
  ON public.automation_event_outbox(event_key, processed_at);

-- ========================
-- automation_schedules
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  cron_expression TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workflow_id)
);

CREATE INDEX IF NOT EXISTS idx_automation_schedules_next_run
  ON public.automation_schedules(next_run_at)
  WHERE enabled = true;

-- ========================
-- automation_webhooks
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path_slug TEXT NOT NULL,
  secret TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'hmac' CHECK (auth_type IN ('none', 'hmac', 'bearer')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, path_slug)
);

-- ========================
-- automation_approvals
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.automation_executions(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.automation_steps(id) ON DELETE SET NULL,
  step_key TEXT NOT NULL,
  approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_group TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'cancelled'
  )),
  comment TEXT,
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_approvals_pending
  ON public.automation_approvals(approver_id, status)
  WHERE status = 'pending';

-- ========================
-- automation_dead_letter
-- ========================
CREATE TABLE IF NOT EXISTS public.automation_dead_letter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES public.automation_executions(id) ON DELETE SET NULL,
  workflow_id UUID REFERENCES public.automation_workflows(id) ON DELETE SET NULL,
  error TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- updated_at triggers
-- ========================
CREATE OR REPLACE FUNCTION public.automation_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_automation_workflows_updated ON public.automation_workflows;
CREATE TRIGGER trg_automation_workflows_updated
  BEFORE UPDATE ON public.automation_workflows
  FOR EACH ROW EXECUTE FUNCTION public.automation_set_updated_at();

DROP TRIGGER IF EXISTS trg_automation_executions_updated ON public.automation_executions;
CREATE TRIGGER trg_automation_executions_updated
  BEFORE UPDATE ON public.automation_executions
  FOR EACH ROW EXECUTE FUNCTION public.automation_set_updated_at();

-- ========================
-- RLS
-- ========================
ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_event_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_dead_letter ENABLE ROW LEVEL SECURITY;

-- Workflows: tenant-scoped with department visibility
CREATE POLICY "automation_workflows_select"
  ON public.automation_workflows FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (
      department_id IS NULL
      OR public.user_in_department(auth.uid(), department_id)
      OR public.has_permission(auth.uid(), 'automation.admin')
    )
  );

CREATE POLICY "automation_workflows_insert"
  ON public.automation_workflows FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND public.has_permission(auth.uid(), 'automation.create')
  );

CREATE POLICY "automation_workflows_update"
  ON public.automation_workflows FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.has_permission(auth.uid(), 'automation.edit')
  );

CREATE POLICY "automation_workflows_delete"
  ON public.automation_workflows FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.has_permission(auth.uid(), 'automation.delete')
  );

-- Steps: via workflow access
CREATE POLICY "automation_steps_select"
  ON public.automation_steps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.automation_workflows w
      WHERE w.id = workflow_id AND w.tenant_id = public.get_user_tenant_id()
    )
  );

CREATE POLICY "automation_steps_manage"
  ON public.automation_steps FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.automation_workflows w
      WHERE w.id = workflow_id
        AND w.tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'automation.edit')
    )
  );

-- Executions
CREATE POLICY "automation_executions_select"
  ON public.automation_executions FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.has_permission(auth.uid(), 'automation.logs.view')
  );

CREATE POLICY "automation_execution_logs_select"
  ON public.automation_execution_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.automation_executions e
      WHERE e.id = execution_id
        AND e.tenant_id = public.get_user_tenant_id()
        AND public.has_permission(auth.uid(), 'automation.logs.view')
    )
  );

-- Templates: system templates visible to all; tenant templates scoped
CREATE POLICY "automation_templates_select"
  ON public.automation_templates FOR SELECT TO authenticated
  USING (
    is_system = true
    OR tenant_id IS NULL
    OR tenant_id = public.get_user_tenant_id()
  );

CREATE POLICY "automation_templates_manage"
  ON public.automation_templates FOR ALL TO authenticated
  USING (
    public.has_permission(auth.uid(), 'automation.templates.manage')
    AND (tenant_id IS NULL OR tenant_id = public.get_user_tenant_id())
  );

-- Approvals: approver or admin
CREATE POLICY "automation_approvals_select"
  ON public.automation_approvals FOR SELECT TO authenticated
  USING (
    approver_id = auth.uid()
    OR public.has_permission(auth.uid(), 'automation.admin')
  );

CREATE POLICY "automation_approvals_update"
  ON public.automation_approvals FOR UPDATE TO authenticated
  USING (approver_id = auth.uid());

-- Webhooks admin
CREATE POLICY "automation_webhooks_select"
  ON public.automation_webhooks FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.has_permission(auth.uid(), 'automation.view')
  );

CREATE POLICY "automation_webhooks_manage"
  ON public.automation_webhooks FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.has_permission(auth.uid(), 'automation.webhooks.manage')
  );

-- Schedules via workflow
CREATE POLICY "automation_schedules_select"
  ON public.automation_schedules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.automation_workflows w
      WHERE w.id = workflow_id AND w.tenant_id = public.get_user_tenant_id()
    )
  );

-- Service role full access (edge functions)
CREATE POLICY "automation_service_role_workflows"
  ON public.automation_workflows FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_steps"
  ON public.automation_steps FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_executions"
  ON public.automation_executions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_logs"
  ON public.automation_execution_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_outbox"
  ON public.automation_event_outbox FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_schedules"
  ON public.automation_schedules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_approvals"
  ON public.automation_approvals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_dlq"
  ON public.automation_dead_letter FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_webhooks"
  ON public.automation_webhooks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "automation_service_role_templates"
  ON public.automation_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Emit outbox helper (callable from edge functions and triggers)
CREATE OR REPLACE FUNCTION public.automation_emit_event(
  p_event_key TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.automation_event_outbox (event_key, payload, tenant_id)
  VALUES (
    p_event_key,
    p_payload,
    COALESCE(p_tenant_id, '00000000-0000-0000-0000-000000000001'::UUID)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.automation_emit_event(TEXT, JSONB, UUID) TO authenticated, service_role;


-- 20260623120000_role_builder_v2.sql
-- ============================================================================
-- User Management V2 — Sprint 1: Custom Role Builder
-- New permission catalog keys + non-assignable flag
-- ============================================================================

ALTER TABLE public.permissions
  ADD COLUMN IF NOT EXISTS is_assignable BOOLEAN NOT NULL DEFAULT true;

INSERT INTO public.permissions (key, name, category, resource, action, description, is_assignable) VALUES
  ('org.manage_mfa_policy', 'Manage MFA Policy', 'Organization', 'org', 'manage_mfa_policy', 'Configure organization-wide MFA enforcement', true),
  ('org.manage_notification_settings', 'Manage Notification Settings', 'Organization', 'org', 'manage_notification_settings', 'Configure notification dispatch and preferences', true),
  ('org.manage_org_settings', 'Manage Organization Settings', 'Organization', 'org', 'manage_org_settings', 'Edit organization-wide configuration', true),
  ('org.view_sessions', 'View Sessions', 'Organization', 'org', 'view_sessions', 'View active member sessions', true),
  ('org.terminate_sessions', 'Terminate Sessions', 'Organization', 'org', 'terminate_sessions', 'Terminate active member sessions', true),
  ('org.manage_scim', 'Manage SCIM', 'Organization', 'org', 'manage_scim', 'Configure SCIM provisioning', true),
  ('org.delete_org', 'Delete Organization', 'Organization', 'org', 'delete_org', 'Permanently delete the organization', false),
  ('org.transfer_ownership', 'Transfer Ownership', 'Organization', 'org', 'transfer_ownership', 'Transfer organization ownership to another member', false)
ON CONFLICT (key) DO NOTHING;


-- 20260623120100_automation_rbac_extensions.sql
-- ============================================================================
-- Automation Engine — RBAC extensions, module registration, feature flag, seeds
-- ============================================================================

-- Additional permissions
INSERT INTO public.permissions (key, name, category, resource, action, description)
VALUES
  ('automation.execute', 'Execute Automation', 'Automation', 'automation', 'execute', 'Manually trigger workflow execution'),
  ('automation.logs.view', 'View Automation Logs', 'Automation', 'automation', 'logs.view', 'View workflow execution logs'),
  ('automation.templates.manage', 'Manage Automation Templates', 'Automation', 'automation', 'templates.manage', 'Create and publish automation templates'),
  ('automation.webhooks.manage', 'Manage Automation Webhooks', 'Automation', 'automation', 'webhooks.manage', 'Configure incoming automation webhooks')
ON CONFLICT (key) DO NOTHING;

-- Grant new permissions to roles (same pattern as enterprise RBAC seed)
DO $$
DECLARE
  v_owner_id UUID;
  v_admin_id UUID;
  v_manager_id UUID;
  v_member_id UUID;
  v_viewer_id UUID;
BEGIN
  SELECT id INTO v_owner_id FROM public.roles WHERE slug = 'owner' AND tenant_id = '00000000-0000-0000-0000-000000000001';
  SELECT id INTO v_admin_id FROM public.roles WHERE slug = 'admin' AND tenant_id = '00000000-0000-0000-0000-000000000001';
  SELECT id INTO v_manager_id FROM public.roles WHERE slug = 'manager' AND tenant_id = '00000000-0000-0000-0000-000000000001';
  SELECT id INTO v_member_id FROM public.roles WHERE slug = 'member' AND tenant_id = '00000000-0000-0000-0000-000000000001';
  SELECT id INTO v_viewer_id FROM public.roles WHERE slug = 'viewer' AND tenant_id = '00000000-0000-0000-0000-000000000001';

  IF v_owner_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_owner_id, p.id FROM public.permissions p WHERE p.key LIKE 'automation.%'
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_admin_id, p.id FROM public.permissions p WHERE p.key LIKE 'automation.%'
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_manager_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_manager_id, p.id FROM public.permissions p
    WHERE p.key IN (
      'automation.view', 'automation.create', 'automation.edit', 'automation.export',
      'automation.execute', 'automation.logs.view', 'automation.templates.manage'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_member_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_member_id, p.id FROM public.permissions p
    WHERE p.key IN ('automation.view', 'automation.execute', 'automation.logs.view')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_viewer_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_viewer_id, p.id FROM public.permissions p
    WHERE p.key IN ('automation.view', 'automation.logs.view')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Register automation module
INSERT INTO public.app_modules (name, slug, description, icon, category, is_core, is_active, sort_order, dependencies)
VALUES (
  'Automation',
  'automation',
  'No-code workflow automation with triggers, actions, and approvals',
  'Workflow',
  'operations',
  false,
  true,
  9,
  '{platform}'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true;

-- Feature flag
INSERT INTO public.app_config (key, value, category, description)
VALUES ('features.enableAutomations', 'true', 'features', 'Enable automation engine')
ON CONFLICT (key) DO NOTHING;

-- Extend notification_events for automation triggers
INSERT INTO public.notification_events (event_key, category, description, default_severity, default_priority, default_channels, is_subscribable)
VALUES
  ('task.created', 'tasks', 'New task created', 'info', 'medium', ARRAY['in_app'], true),
  ('task.updated', 'tasks', 'Task updated', 'info', 'low', ARRAY['in_app'], true),
  ('user.created', 'users', 'New user created', 'info', 'medium', ARRAY['in_app','email'], true),
  ('issue.created', 'eos', 'New EOS issue created', 'info', 'medium', ARRAY['in_app'], true),
  ('email.received', 'integrations', 'Inbound email received', 'info', 'medium', ARRAY['in_app'], false)
ON CONFLICT (event_key) DO NOTHING;

-- Seed system templates
INSERT INTO public.automation_templates (name, description, category, trigger_type, is_published, is_system, definition)
VALUES
  (
    'Task Reminder',
    'Remind assignee if task not completed after 24 hours',
    'tasks',
    'task.created',
    true,
    true,
    '{"version":1,"trigger":{"type":"task.created","filters":{}},"nodes":[{"id":"trigger","type":"trigger","config":{"event":"task.created"}},{"id":"delay1","type":"delay","config":{"duration":"24h"}},{"id":"cond1","type":"condition","config":{"operator":"AND","rules":[{"field":"status","op":"neq","value":"completed"}]}},{"id":"action1","type":"action","config":{"action":"send_notification","title":"Task Reminder","message":"Your task is still open"}}],"edges":[{"from":"trigger","to":"delay1"},{"from":"delay1","to":"cond1"},{"from":"cond1","to":"action1","when":"true"}]}'::jsonb
  ),
  (
    'Meeting Reminder',
    'Send reminder 15 minutes before meeting',
    'meetings',
    'meeting.scheduled',
    true,
    true,
    '{"version":1,"trigger":{"type":"meeting.scheduled"},"nodes":[{"id":"trigger","type":"trigger","config":{"event":"meeting.scheduled"}},{"id":"action1","type":"action","config":{"action":"send_notification","title":"Meeting Reminder","message":"Your meeting starts soon"}}],"edges":[{"from":"trigger","to":"action1"}]}'::jsonb
  ),
  (
    'Rock Escalation',
    'Notify manager when rock is overdue',
    'eos',
    'rock.overdue',
    true,
    true,
    '{"version":1,"trigger":{"type":"rock.overdue"},"nodes":[{"id":"trigger","type":"trigger","config":{"event":"rock.overdue"}},{"id":"action1","type":"action","config":{"action":"send_notification","severity":"warning"}}],"edges":[{"from":"trigger","to":"action1"}]}'::jsonb
  ),
  (
    'Issue Escalation',
    'Escalate unresolved issues after 48 hours',
    'eos',
    'issue.created',
    true,
    true,
    '{"version":1,"trigger":{"type":"issue.created"},"nodes":[{"id":"trigger","type":"trigger","config":{}},{"id":"delay1","type":"delay","config":{"duration":"48h"}},{"id":"action1","type":"action","config":{"action":"send_notification","title":"Issue Escalation"}}],"edges":[{"from":"trigger","to":"delay1"},{"from":"delay1","to":"action1"}]}'::jsonb
  ),
  (
    'New User Onboarding',
    'Welcome email and task for new users',
    'users',
    'user.created',
    true,
    true,
    '{"version":1,"trigger":{"type":"user.created"},"nodes":[{"id":"trigger","type":"trigger","config":{}},{"id":"action1","type":"action","config":{"action":"send_email","template":"welcome"}},{"id":"action2","type":"action","config":{"action":"create_task","title":"Complete onboarding"}}],"edges":[{"from":"trigger","to":"action1"},{"from":"action1","to":"action2"}]}'::jsonb
  ),
  (
    'Customer Follow-up',
    'Follow up with customer 3 days after deal stage change',
    'business',
    'custom.event',
    true,
    true,
    '{"version":1,"trigger":{"type":"custom.event","filters":{"module":"deals"}},"nodes":[{"id":"trigger","type":"trigger","config":{}},{"id":"delay1","type":"delay","config":{"duration":"72h"}},{"id":"action1","type":"action","config":{"action":"send_email"}}],"edges":[{"from":"trigger","to":"delay1"},{"from":"delay1","to":"action1"}]}'::jsonb
  ),
  (
    'Weekly Report',
    'Generate and send weekly summary every Monday',
    'reports',
    'schedule',
    true,
    true,
    '{"version":1,"trigger":{"type":"schedule","cron":"0 9 * * 1"},"nodes":[{"id":"trigger","type":"trigger","config":{"cron":"0 9 * * 1"}},{"id":"action1","type":"action","config":{"action":"generate_summary"}}],"edges":[{"from":"trigger","to":"action1"}]}'::jsonb
  ),
  (
    'Daily Digest',
    'Daily activity digest at 8 AM',
    'reports',
    'schedule',
    true,
    true,
    '{"version":1,"trigger":{"type":"schedule","cron":"0 8 * * *"},"nodes":[{"id":"trigger","type":"trigger","config":{}},{"id":"action1","type":"action","config":{"action":"send_notification","title":"Daily Digest"}}],"edges":[{"from":"trigger","to":"action1"}]}'::jsonb
  ),
  (
    'Approval Workflow',
    'Multi-level manager and finance approval',
    'approvals',
    'manual',
    true,
    true,
    '{"version":1,"trigger":{"type":"manual"},"nodes":[{"id":"trigger","type":"trigger","config":{}},{"id":"approval1","type":"approval","config":{"level":1,"role":"manager"}},{"id":"approval2","type":"approval","config":{"level":2,"role":"admin","label":"Finance"}},{"id":"action1","type":"action","config":{"action":"send_notification","title":"Approved"}}],"edges":[{"from":"trigger","to":"approval1"},{"from":"approval1","to":"approval2","when":"approved"},{"from":"approval2","to":"action1","when":"approved"}]}'::jsonb
  ),
  (
    'AI Summary Workflow',
    'Generate AI summary when agent completes',
    'ai',
    'ai.agent.completed',
    true,
    true,
    '{"version":1,"trigger":{"type":"ai.agent.completed"},"nodes":[{"id":"trigger","type":"trigger","config":{}},{"id":"action1","type":"action","config":{"action":"generate_summary"}},{"id":"action2","type":"action","config":{"action":"send_notification"}}],"edges":[{"from":"trigger","to":"action1"},{"from":"action1","to":"action2"}]}'::jsonb
  )
ON CONFLICT (name) WHERE is_system DO NOTHING;


-- 20260623120200_automation_pg_cron.sql
-- pg_cron schedule for automation engine (commented — enable on Supabase Pro)
-- SELECT cron.schedule(
--   'automation-scheduler',
--   '* * * * *',
--   $$ SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/automation-scheduler',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
--     ),
--     body := '{}'::jsonb
--   ) $$
-- );
--
-- SELECT cron.schedule(
--   'automation-trigger-evaluator',
--   '* * * * *',
--   $$ SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/automation-trigger-evaluator',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
--     ),
--     body := '{}'::jsonb
--   ) $$
-- );

-- Documentation-only migration; configure cron via Supabase Dashboard or uncomment above on Pro plans.


