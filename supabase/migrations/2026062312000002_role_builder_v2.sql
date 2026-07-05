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
