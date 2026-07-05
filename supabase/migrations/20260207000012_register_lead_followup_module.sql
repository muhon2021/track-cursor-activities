-- ============================================================================
-- Register Lead Follow-Up Module
-- ============================================================================
-- Registers the Lead Follow-Up module in app_modules table for access control
-- and navigation.
-- ============================================================================

-- Insert Lead Follow-Up module into app_modules
INSERT INTO app_modules (
  name,
  slug,
  description,
  icon,
  category,
  is_core,
  is_active,
  sort_order,
  dependencies,
  created_at,
  updated_at
) VALUES (
  'Lead Follow-Up',
  'lead-followup',
  'Contact management and engagement tracking for sales teams with AI-powered sentiment analysis, email automation, and HubSpot integration',
  'Target',
  'business',
  false,
  true,
  10,
  ARRAY['business-dev'],
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
