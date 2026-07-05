-- ============================================================================
-- Project Backups - minimal schema for backup/restore UI
-- ============================================================================
-- This table stores snapshot metadata for project-level backups. The actual
-- snapshot format is intentionally generic (JSONB) so that different backup
-- strategies can be implemented by Edge Functions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  backup_type TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'completed',
  notes TEXT,
  snapshot JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_backups_project ON project_backups(project_id);
CREATE INDEX IF NOT EXISTS idx_project_backups_created_at ON project_backups(created_at DESC);

ALTER TABLE project_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view project backups" ON project_backups;
CREATE POLICY "Authenticated users can view project backups"
  ON project_backups
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage project backups" ON project_backups;
CREATE POLICY "Authenticated users can manage project backups"
  ON project_backups
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

