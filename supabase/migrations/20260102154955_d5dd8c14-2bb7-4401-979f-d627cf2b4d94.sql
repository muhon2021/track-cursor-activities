-- Seed default app_config values for enterprise deployment
-- This migration creates all default branding, features, email, and system settings

-- Branding settings
INSERT INTO public.app_config (key, value, category, description, is_sensitive)
VALUES 
  ('branding.companyName', '"CollabAi"', 'branding', 'Company name displayed throughout the app', false),
  ('branding.tagline', '"AI-Powered Collaboration Platform"', 'branding', 'Company tagline', false),
  ('branding.supportEmail', '"support@collabai.software"', 'branding', 'Support email address', false),
  ('branding.logoUrl', 'null', 'branding', 'URL to company logo', false)
ON CONFLICT (key) DO NOTHING;

-- Feature flags
INSERT INTO public.app_config (key, value, category, description, is_sensitive)
VALUES 
  ('features.enableAIChat', 'true', 'features', 'Enable AI Chat module', false),
  ('features.enableKnowledgeBase', 'true', 'features', 'Enable Knowledge Base module', false),
  ('features.enableMeetings', 'true', 'features', 'Enable Meetings module', false),
  ('features.enableTasks', 'true', 'features', 'Enable Tasks module', false),
  ('features.enableNotifications', 'true', 'features', 'Enable Notifications', false),
  ('features.enableSemanticSearch', 'true', 'features', 'Enable AI semantic search', false),
  ('features.enableClients', 'true', 'features', 'Enable Clients/CRM module', false),
  ('features.enableAIAgents', 'true', 'features', 'Enable AI Agents management', false),
  ('features.enablePersonalKnowledge', 'true', 'features', 'Enable user file uploads', false),
  ('features.enableFeedback', 'true', 'features', 'Enable feedback collection', false),
  ('features.enableGoogleDrive', 'false', 'features', 'Enable Google Drive integration', false),
  ('features.enableZoomSync', 'false', 'features', 'Enable Zoom meeting sync', false)
ON CONFLICT (key) DO NOTHING;

-- Email settings
INSERT INTO public.app_config (key, value, category, description, is_sensitive)
VALUES 
  ('email.enableEmailNotifications', 'true', 'email', 'Enable email notifications', false),
  ('email.fromName', '"CollabAi"', 'email', 'Sender name for emails', false),
  ('email.fromEmail', '"noreply@collabai.software"', 'email', 'Sender email address', false)
ON CONFLICT (key) DO NOTHING;

-- System settings
INSERT INTO public.app_config (key, value, category, description, is_sensitive)
VALUES 
  ('system.maintenanceMode', 'false', 'system', 'Enable maintenance mode', false),
  ('system.allowSignups', 'true', 'system', 'Allow new user signups', false),
  ('system.requireEmailVerification', 'false', 'system', 'Require email verification', false),
  ('system.sessionTimeout', '7', 'system', 'Session timeout in days', false),
  ('system.onboardingCompleted', 'false', 'system', 'Whether initial setup is complete', false),
  ('system.templateDataSeeded', 'false', 'system', 'Whether template data has been seeded', false)
ON CONFLICT (key) DO NOTHING;