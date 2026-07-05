-- ============================================================================
-- Setup Lead Follow-Up System Settings
-- ============================================================================
-- Initializes system_settings for lead follow-up module configuration.
-- ============================================================================

-- Insert or update lead_followup settings (if system_settings table exists)
INSERT INTO system_settings (
  category,
  key,
  value,
  description,
  data_type,
  created_at,
  updated_at
) VALUES
  (
    'lead_followup',
    'min_interval_days',
    '3',
    'Minimum allowed follow-up interval in days',
    'integer',
    NOW(),
    NOW()
  ),
  (
    'lead_followup',
    'max_interval_days',
    '90',
    'Maximum allowed follow-up interval in days',
    'integer',
    NOW(),
    NOW()
  ),
  (
    'lead_followup',
    'default_interval_days',
    '7',
    'Default follow-up interval in days',
    'integer',
    NOW(),
    NOW()
  ),
  (
    'email_tracking',
    'enable_open_tracking',
    'true',
    'Enable email open tracking via pixels',
    'boolean',
    NOW(),
    NOW()
  ),
  (
    'email_tracking',
    'enable_click_tracking',
    'true',
    'Enable email click tracking via link rewriting',
    'boolean',
    NOW(),
    NOW()
  ),
  (
    'lead_followup',
    'auto_status_enabled',
    'true',
    'Enable automatic status rule application',
    'boolean',
    NOW(),
    NOW()
  )
ON CONFLICT (category, key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
