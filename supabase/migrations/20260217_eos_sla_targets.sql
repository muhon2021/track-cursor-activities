-- ============================================================================
-- EOS SLA Targets — Approval rate and cycle time targets by pod/role
-- ============================================================================
-- Used by Admin EOS Accountability: SLA targets configuration and analytics.
-- One fallback row (pod_id and role_name both null); per-pod and per-role rows.
-- ============================================================================

CREATE TABLE IF NOT EXISTS eos_sla_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES eos_pods(id) ON DELETE CASCADE,
  role_name TEXT,
  approval_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 90 CHECK (approval_rate_pct >= 0 AND approval_rate_pct <= 100),
  cycle_time_days NUMERIC(5,2) NOT NULL DEFAULT 5 CHECK (cycle_time_days >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT eos_sla_targets_pod_or_role_or_fallback CHECK (
    (pod_id IS NOT NULL AND role_name IS NULL) OR
    (pod_id IS NULL AND role_name IS NOT NULL) OR
    (pod_id IS NULL AND role_name IS NULL)
  )
);

-- One fallback (null,null), one row per pod (pod_id, null), one per role (null, role_name)
CREATE UNIQUE INDEX IF NOT EXISTS idx_eos_sla_targets_entity_unique
  ON eos_sla_targets (pod_id, role_name) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_eos_sla_targets_pod ON eos_sla_targets (pod_id);
CREATE INDEX IF NOT EXISTS idx_eos_sla_targets_role ON eos_sla_targets (role_name);

ALTER TABLE eos_sla_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view SLA targets" ON eos_sla_targets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage SLA targets" ON eos_sla_targets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed single fallback row if none exists
INSERT INTO eos_sla_targets (pod_id, role_name, approval_rate_pct, cycle_time_days)
SELECT NULL, NULL, 90, 5
WHERE NOT EXISTS (SELECT 1 FROM eos_sla_targets WHERE pod_id IS NULL AND role_name IS NULL);
