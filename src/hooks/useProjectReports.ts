/**
 * Project Reports — real Supabase aggregates
 *
 * Fetches projects with joined milestones, risks, and billing data
 * to compute per-project report metrics for the admin Reports page.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectReportRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  milestones_total: number;
  milestones_done: number;
  risks_open: number;
  budget_total: number;
  invoiced_total: number;
  budget_spent_pct: number;
  start_date: string | null;
  end_date: string | null;
}

export function useProjectReports() {
  return useQuery({
    queryKey: ["project-reports"],
    queryFn: async (): Promise<ProjectReportRow[]> => {
      // Fetch projects with their status name
      const { data: projects, error: projError } = await supabase
        .from("projects")
        .select("id, name, slug, status_id, budget, start_date, end_date, is_archived, project_statuses(name)")
        .eq("is_archived", false)
        .order("name");

      if (projError) throw projError;
      if (!projects || projects.length === 0) return [];

      const projectIds = projects.map((p) => p.id);

      // Fetch milestones, risks, billing in parallel; use empty data for any failed query so we still return project list
      const [milestonesRes, risksRes, billingRes] = await Promise.all([
        supabase
          .from("project_milestones")
          .select("id, project_id, status")
          .in("project_id", projectIds),
        supabase
          .from("project_risks")
          .select("id, project_id, status")
          .in("project_id", projectIds),
        supabase
          .from("project_billing")
          .select("project_id, total_budget, invoiced_amount")
          .in("project_id", projectIds),
      ]);

      const milestonesData = milestonesRes.error ? [] : milestonesRes.data || [];
      const risksData = risksRes.error ? [] : risksRes.data || [];
      const billingData = billingRes.error ? [] : billingRes.data || [];

      // Build lookup maps
      const milestonesByProject = new Map<string, { total: number; done: number }>();
      for (const m of milestonesData) {
        const entry = milestonesByProject.get(m.project_id) || { total: 0, done: 0 };
        entry.total++;
        if (m.status === "completed" || m.status === "done") entry.done++;
        milestonesByProject.set(m.project_id, entry);
      }

      const risksByProject = new Map<string, number>();
      for (const r of risksData) {
        if (r.status === "open" || r.status === "active" || !r.status) {
          risksByProject.set(r.project_id, (risksByProject.get(r.project_id) || 0) + 1);
        }
      }

      const billingByProject = new Map<string, { budget: number; invoiced: number }>();
      for (const b of billingData) {
        const entry = billingByProject.get(b.project_id) || { budget: 0, invoiced: 0 };
        entry.budget += b.total_budget || 0;
        entry.invoiced += b.invoiced_amount || 0;
        billingByProject.set(b.project_id, entry);
      }

      return projects.map((p) => {
        const ms = milestonesByProject.get(p.id) || { total: 0, done: 0 };
        const risksOpen = risksByProject.get(p.id) || 0;
        const billing = billingByProject.get(p.id) || { budget: 0, invoiced: 0 };
        const budgetTotal = billing.budget || p.budget || 0;
        const budgetPct = budgetTotal > 0 ? Math.round((billing.invoiced / budgetTotal) * 100) : 0;

        // Extract status name from joined relation
        const statusObj = p.project_statuses as { name: string } | null;
        const statusName = statusObj?.name || "No Status";

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          status: statusName,
          milestones_total: ms.total,
          milestones_done: ms.done,
          risks_open: risksOpen,
          budget_total: budgetTotal,
          invoiced_total: billing.invoiced,
          budget_spent_pct: budgetPct,
          start_date: p.start_date,
          end_date: p.end_date,
        };
      });
    },
    staleTime: 60 * 1000,
  });
}
