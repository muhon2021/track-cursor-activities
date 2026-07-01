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
