-- ============================================================================
-- Migration: app_modules, user_module_permissions, system_settings
-- Phase 0: Foundation for modular architecture
-- ============================================================================

-- ===================
-- 1. app_modules table
-- ===================
-- Registry of available modules. Admin can toggle modules on/off.

CREATE TABLE IF NOT EXISTS app_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'Layout',
  category TEXT DEFAULT 'business' CHECK (category IN ('core', 'business', 'intelligence', 'operations')),
  is_core BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  dependencies TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE app_modules ENABLE ROW LEVEL SECURITY;

-- Everyone can read modules (needed for navigation filtering)
CREATE POLICY "Anyone can read app_modules"
  ON app_modules FOR SELECT
  USING (true);

-- Only admins can update modules
CREATE POLICY "Admins can update app_modules"
  ON app_modules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can insert modules
CREATE POLICY "Admins can insert app_modules"
  ON app_modules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Seed default modules
INSERT INTO app_modules (name, slug, description, icon, category, is_core, is_active, sort_order, dependencies) VALUES
  ('Platform Core', 'platform', 'Authentication, layouts, navigation, UI components', 'Layout', 'core', true, true, 0, '{}'),
  ('Actions', 'actions', 'Standalone task management with streams and comments', 'CheckSquare', 'operations', false, true, 1, '{platform}'),
  ('EOS', 'eos', 'Entrepreneurial Operating System - V/TO, OKRs, issues, scorecards', 'Target', 'business', false, true, 2, '{platform}'),
  ('Meetings', 'meetings', 'Meeting lifecycle management with AI summaries', 'Calendar', 'operations', false, true, 3, '{platform}'),
  ('Knowledge Base', 'knowledge', 'Knowledge management with vector embeddings and semantic search', 'BookOpen', 'intelligence', false, true, 4, '{platform}'),
  ('Projects', 'projects', 'Project lifecycle management with billing and resource projection', 'FolderKanban', 'business', false, true, 5, '{platform}'),
  ('Business Development', 'business-dev', 'Deal pipeline, client management, contacts, CRM integration', 'TrendingUp', 'business', false, true, 6, '{platform}'),
  ('Productivity', 'productivity', 'Team and individual productivity metrics and AI insights', 'BarChart3', 'operations', false, true, 7, '{platform}'),
  ('Admin', 'admin', 'Administrative control panel for platform configuration', 'Shield', 'core', true, true, 8, '{platform}')
ON CONFLICT (slug) DO NOTHING;


-- ==============================
-- 2. user_module_permissions table
-- ==============================
-- Per-user module access. If no row exists, user has access to all active modules.
-- When rows exist for a user, they can only access modules listed here.

CREATE TABLE IF NOT EXISTS user_module_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES app_modules(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Enable RLS
ALTER TABLE user_module_permissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own permissions
CREATE POLICY "Users can read own module permissions"
  ON user_module_permissions FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all permissions
CREATE POLICY "Admins can read all module permissions"
  ON user_module_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Admins can manage permissions
CREATE POLICY "Admins can insert module permissions"
  ON user_module_permissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete module permissions"
  ON user_module_permissions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );


-- ========================
-- 3. system_settings table
-- ========================
-- Key-value settings organized by category.
-- Used for module-specific configuration that doesn't fit in app_config.

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category, key)
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can read system_settings"
  ON system_settings FOR SELECT
  USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can manage system_settings"
  ON system_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );


-- ==============================
-- 4. RPC: get_user_modules
-- ==============================
-- Returns list of module slugs the current user can access.

CREATE OR REPLACE FUNCTION get_user_modules()
RETURNS TABLE(slug TEXT, name TEXT, icon TEXT, category TEXT) AS $$
DECLARE
  has_restrictions BOOLEAN;
BEGIN
  -- Check if user has specific module restrictions
  SELECT EXISTS(
    SELECT 1 FROM user_module_permissions WHERE user_id = auth.uid()
  ) INTO has_restrictions;

  IF has_restrictions THEN
    -- Return only granted modules that are also active
    RETURN QUERY
      SELECT m.slug, m.name, m.icon, m.category
      FROM app_modules m
      INNER JOIN user_module_permissions p ON p.module_id = m.id
      WHERE p.user_id = auth.uid()
      AND m.is_active = true
      ORDER BY m.sort_order;
  ELSE
    -- No restrictions: return all active modules
    RETURN QUERY
      SELECT m.slug, m.name, m.icon, m.category
      FROM app_modules m
      WHERE m.is_active = true
      ORDER BY m.sort_order;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
