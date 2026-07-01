-- ============================================================================
-- Pod Management -- Complete Implementation
-- ============================================================================
-- Creates comprehensive pod management system with HR sync, Resource Projection,
-- module permissions, and health tracking capabilities.
-- ============================================================================

-- ========================
-- 1. Update pods table
-- ========================
-- Add missing columns to existing pods table
ALTER TABLE IF EXISTS pods
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS show_in_resource_projection BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ========================
-- 2. pod_employees table
-- ========================
-- Members with login/profile info (used for Resource Projection and module access)
CREATE TABLE IF NOT EXISTS pod_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id UUID, -- FK to Employee table (if exists) or employee_profiles
  has_login BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'synced')),
  is_active BOOLEAN DEFAULT true,
  role TEXT CHECK (role IN ('manager', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pod_id, employee_id),
  UNIQUE (pod_id, user_id)
);

-- Indexes for pod_employees
CREATE INDEX IF NOT EXISTS idx_pod_employees_pod_id ON pod_employees(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_employees_user_id ON pod_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_pod_employees_employee_id ON pod_employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_pod_employees_is_active ON pod_employees(is_active);

-- ========================
-- 3. employee_pods table
-- ========================
-- HR-synced pod membership (read-only from HR system)
CREATE TABLE IF NOT EXISTS employee_pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL, -- FK to Employee or employee_profiles
  pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  synced_from_hr BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (pod_id, employee_id)
);

-- Indexes for employee_pods
CREATE INDEX IF NOT EXISTS idx_employee_pods_pod_id ON employee_pods(pod_id);
CREATE INDEX IF NOT EXISTS idx_employee_pods_employee_id ON employee_pods(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_pods_synced_from_hr ON employee_pods(synced_from_hr);

-- ========================
-- 4. pod_permissions table
-- ========================
-- Module access per pod
CREATE TABLE IF NOT EXISTS pod_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES app_modules(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pod_id, module_id)
);

-- Indexes for pod_permissions
CREATE INDEX IF NOT EXISTS idx_pod_permissions_pod_id ON pod_permissions(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_permissions_module_id ON pod_permissions(module_id);

-- ========================
-- 5. Update app_modules if needed
-- ========================
-- Ensure app_modules has page_route column for pod permissions
ALTER TABLE IF EXISTS app_modules
  ADD COLUMN IF NOT EXISTS page_route TEXT;

-- ========================
-- 6. RLS Policies
-- ========================

-- Enable RLS on all tables
ALTER TABLE pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_permissions ENABLE ROW LEVEL SECURITY;

-- Pods policies
DROP POLICY IF EXISTS "Admins can manage pods" ON pods;
CREATE POLICY "Admins can manage pods"
  ON pods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view active pods" ON pods;
CREATE POLICY "Users can view active pods"
  ON pods FOR SELECT
  USING (is_active = true);

-- pod_employees policies
DROP POLICY IF EXISTS "Admins can manage pod_employees" ON pod_employees;
CREATE POLICY "Admins can manage pod_employees"
  ON pod_employees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view own pod membership" ON pod_employees;
CREATE POLICY "Users can view own pod membership"
  ON pod_employees FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- employee_pods policies (read-only for non-admins)
DROP POLICY IF EXISTS "Admins can manage employee_pods" ON employee_pods;
CREATE POLICY "Admins can manage employee_pods"
  ON employee_pods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view employee_pods" ON employee_pods;
CREATE POLICY "Users can view employee_pods"
  ON employee_pods FOR SELECT
  USING (true);

-- pod_permissions policies
DROP POLICY IF EXISTS "Admins can manage pod_permissions" ON pod_permissions;
CREATE POLICY "Admins can manage pod_permissions"
  ON pod_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view pod_permissions" ON pod_permissions;
CREATE POLICY "Users can view pod_permissions"
  ON pod_permissions FOR SELECT
  USING (true);

-- ========================
-- 7. Sync Function
-- ========================
-- Copies HR-synced members from employee_pods into pod_employees
-- Resolves user_id via email matching against profiles table
CREATE OR REPLACE FUNCTION sync_pod_employees_from_hr()
RETURNS TABLE (
  pod_id UUID,
  employees_synced INTEGER,
  employees_with_login INTEGER,
  employees_without_login INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pod RECORD;
  v_employee RECORD;
  v_user_id UUID;
  v_synced_count INTEGER;
  v_with_login_count INTEGER;
  v_without_login_count INTEGER;
BEGIN
  -- Loop through each pod
  FOR v_pod IN SELECT id FROM pods WHERE is_active = true
  LOOP
    v_synced_count := 0;
    v_with_login_count := 0;
    v_without_login_count := 0;

    -- Get all HR-synced employees for this pod
    FOR v_employee IN
      SELECT DISTINCT ep.employee_id, ep.pod_id
      FROM employee_pods ep
      WHERE ep.pod_id = v_pod.id
        AND ep.synced_from_hr = true
    LOOP
      -- Try to find matching user_id via email
      -- First try employee_profiles
      SELECT user_id INTO v_user_id
      FROM employee_profiles
      WHERE id::text = v_employee.employee_id::text
        OR email = (
          SELECT email FROM employee_profiles WHERE id::text = v_employee.employee_id::text
        )
      LIMIT 1;

      -- If not found, try profiles table by email
      IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id
        FROM profiles
        WHERE email = (
          SELECT email FROM employee_profiles WHERE id::text = v_employee.employee_id::text
        )
        LIMIT 1;
      END IF;

      -- Upsert into pod_employees
      INSERT INTO pod_employees (
        pod_id,
        employee_id,
        user_id,
        has_login,
        source,
        is_active
      )
      VALUES (
        v_employee.pod_id,
        v_employee.employee_id,
        v_user_id,
        v_user_id IS NOT NULL,
        'synced',
        true
      )
      ON CONFLICT (pod_id, employee_id) 
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        has_login = EXCLUDED.has_login,
        updated_at = now()
      WHERE pod_employees.source = 'synced'; -- Only update if it was synced

      v_synced_count := v_synced_count + 1;
      IF v_user_id IS NOT NULL THEN
        v_with_login_count := v_with_login_count + 1;
      ELSE
        v_without_login_count := v_without_login_count + 1;
      END IF;
    END LOOP;

    -- Return stats for this pod
    RETURN QUERY SELECT v_pod.id, v_synced_count, v_with_login_count, v_without_login_count;
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION sync_pod_employees_from_hr() TO authenticated;

-- ========================
-- 8. Triggers
-- ========================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_pod_employees_updated_at ON pod_employees;
CREATE TRIGGER update_pod_employees_updated_at
  BEFORE UPDATE ON pod_employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employee_pods_updated_at ON employee_pods;
CREATE TRIGGER update_employee_pods_updated_at
  BEFORE UPDATE ON employee_pods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pods_updated_at ON pods;
CREATE TRIGGER update_pods_updated_at
  BEFORE UPDATE ON pods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================
-- 9. Helper Views (Optional)
-- ========================

-- View: pods_with_stats
CREATE OR REPLACE VIEW pods_with_stats AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.color,
  p.is_active,
  p.show_in_resource_projection,
  p.created_by,
  p.created_at,
  p.updated_at,
  COUNT(DISTINCT ep.employee_id) FILTER (WHERE ep.synced_from_hr = true) as hr_synced_count,
  COUNT(DISTINCT pe.employee_id) FILTER (WHERE pe.is_active = true) as rp_members_count,
  COUNT(DISTINCT pe.user_id) FILTER (WHERE pe.has_login = true AND pe.is_active = true) as has_login_count,
  COUNT(DISTINCT pe.employee_id) FILTER (WHERE pe.has_login = false AND pe.is_active = true) as no_login_count
FROM pods p
LEFT JOIN employee_pods ep ON ep.pod_id = p.id
LEFT JOIN pod_employees pe ON pe.pod_id = p.id
GROUP BY p.id, p.name, p.description, p.color, p.is_active, p.show_in_resource_projection, p.created_by, p.created_at, p.updated_at;

-- Grant access to view
GRANT SELECT ON pods_with_stats TO authenticated;

