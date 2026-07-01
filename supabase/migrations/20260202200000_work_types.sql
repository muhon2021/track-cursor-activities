-- Work Types for project billing and resource planning
CREATE TABLE IF NOT EXISTS work_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'services' CHECK (category IN ('services', 'support', 'admin', 'internal', 'other')),
  is_billable BOOLEAN DEFAULT true,
  default_rate NUMERIC(10, 2),
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE work_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read work types"
  ON work_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can manage work types"
  ON work_types FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed default work types
INSERT INTO work_types (name, slug, category, is_billable, default_rate, color, sort_order)
VALUES
  ('Discovery', 'discovery', 'services', true, 150.00, '#8b5cf6', 0),
  ('Development', 'development', 'services', true, 175.00, '#3b82f6', 1),
  ('Design', 'design', 'services', true, 160.00, '#ec4899', 2),
  ('QA / Testing', 'qa-testing', 'services', true, 125.00, '#22c55e', 3),
  ('Project Management', 'project-management', 'services', true, 140.00, '#f59e0b', 4),
  ('Support', 'support', 'support', true, 100.00, '#14b8a6', 5),
  ('Internal Meeting', 'internal-meeting', 'internal', false, NULL, '#6b7280', 6),
  ('Admin / Overhead', 'admin-overhead', 'admin', false, NULL, '#9ca3af', 7)
ON CONFLICT (slug) DO NOTHING;
