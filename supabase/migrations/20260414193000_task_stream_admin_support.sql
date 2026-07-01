-- Add stream-style metadata and role access rules on task_categories.

ALTER TABLE IF EXISTS task_categories
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'layers',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES task_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_task_categories_parent_id ON task_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_task_categories_is_active ON task_categories(is_active);

CREATE TABLE IF NOT EXISTS task_category_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES task_categories(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  access_level TEXT NOT NULL DEFAULT 'full' CHECK (access_level IN ('full', 'read_only')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (category_id, role_id, access_level)
);

ALTER TABLE task_category_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read task_category_roles" ON task_category_roles;
CREATE POLICY "Authenticated users can read task_category_roles"
  ON task_category_roles FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage task_category_roles" ON task_category_roles;
CREATE POLICY "Admins can manage task_category_roles"
  ON task_category_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );
