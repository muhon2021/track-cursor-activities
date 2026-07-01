-- ============================================================================
-- Admin EOS Scorecards — RLS, pod linkage, triggers
-- ============================================================================
-- Implements admin-only management for scorecards per implementation plan.
-- - Admin-only INSERT/UPDATE/DELETE on scorecards and scorecard_metrics
-- - Add pod_id to eos_scorecards for template–pod linkage
-- - Add updated_at triggers
-- ============================================================================

-- Add pod_id to eos_scorecards (optional template–pod linkage)
ALTER TABLE eos_scorecards
  ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES eos_pods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_eos_scorecards_pod_id ON eos_scorecards(pod_id);

-- Triggers for updated_at (uses update_updated_at_column from earlier migrations)
DROP TRIGGER IF EXISTS update_eos_scorecards_updated_at ON eos_scorecards;
CREATE TRIGGER update_eos_scorecards_updated_at
  BEFORE UPDATE ON eos_scorecards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_eos_scorecard_metrics_updated_at ON eos_scorecard_metrics;
CREATE TRIGGER update_eos_scorecard_metrics_updated_at
  BEFORE UPDATE ON eos_scorecard_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- RLS: Admin-only management for scorecards
-- ============================================================================

-- Drop permissive "authenticated can manage" policies
DROP POLICY IF EXISTS "Authenticated users can manage scorecards" ON eos_scorecards;
DROP POLICY IF EXISTS "Authenticated users can manage metrics" ON eos_scorecard_metrics;

-- Scorecards: SELECT for authenticated; INSERT/UPDATE/DELETE for admins only
CREATE POLICY "Admins can manage scorecards"
  ON eos_scorecards
  FOR ALL
  TO authenticated
  USING (
    (auth.uid() IS NOT NULL)
    AND (
      -- SELECT: any authenticated user
      (TG_OP IS NULL OR current_setting('request.jwt.claim.role', true) IS NOT NULL)
      OR public.is_admin()
    )
  )
  WITH CHECK (public.is_admin());

-- Simpler approach: separate SELECT (authenticated) from INSERT/UPDATE/DELETE (admin)
-- Re-create: SELECT for authenticated (keep existing)
-- The existing "Authenticated users can view scorecards" handles SELECT.
-- We only need to replace the "manage" with admin-only for INSERT/UPDATE/DELETE.

-- Drop the complex policy we just created and do it properly:
DROP POLICY IF EXISTS "Admins can manage scorecards" ON eos_scorecards;

CREATE POLICY "Admins can insert scorecards"
  ON eos_scorecards FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update scorecards"
  ON eos_scorecards FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete scorecards"
  ON eos_scorecards FOR DELETE TO authenticated
  USING (public.is_admin());

-- Scorecard metrics: SELECT for authenticated; INSERT/UPDATE/DELETE for admins
CREATE POLICY "Admins can insert scorecard metrics"
  ON eos_scorecard_metrics FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update scorecard metrics"
  ON eos_scorecard_metrics FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete scorecard metrics"
  ON eos_scorecard_metrics FOR DELETE TO authenticated
  USING (public.is_admin());
