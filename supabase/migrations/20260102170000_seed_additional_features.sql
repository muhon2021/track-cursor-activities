-- Add additional feature flags and branding options
-- This migration extends the default configuration with new features

-- Insert new feature flags
INSERT INTO public.app_config (key, value, category, description) VALUES
  -- Additional Features
  ('features.enableClients', 'true', 'features', 'Enable client management module'),
  ('features.enableAIAgents', 'true', 'features', 'Enable AI agents management'),
  ('features.enablePersonalKnowledge', 'true', 'features', 'Enable personal knowledge uploads'),
  ('features.enableFeedback', 'true', 'features', 'Enable feedback collection'),
  ('features.enableGoogleDrive', 'false', 'features', 'Enable Google Drive integration'),
  ('features.enableZoomSync', 'false', 'features', 'Enable Zoom meeting sync'),

  -- Branding
  ('branding.logoUrl', 'null', 'branding', 'URL to custom logo image'),

  -- System
  ('system.onboardingCompleted', 'false', 'system', 'Platform onboarding wizard completed')
ON CONFLICT (key) DO NOTHING;
