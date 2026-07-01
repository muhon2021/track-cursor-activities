/**
 * Productivity Hook - Core productivity data queries
 *
 * Employee detail and list are keyed by employee_email. Ensure productivity
 * data uses unique emails per person (e.g. from HR/CSV import) for correct aggregation.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ProductivityRecord, ProductivityFilters, ProductivitySummary, AIProductivityInsight } from "../types";
import { useDepartments as useDepartmentsList } from "@/hooks/useDepartments";

export { useDepartmentsList as useDepartments };

const PRODUCTIVITY_KEY = "productivity";

export function useProductivityRecords(filters?: ProductivityFilters) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [PRODUCTIVITY_KEY, "records", filters],
    queryFn: async (): Promise<ProductivityRecord[]> => {
      let query = supabase
        .from("productivity_records")
        .select("*")
        .order("week_start", { ascending: false });

      if (filters?.department) query = query.eq("department", filters.department);
      if (filters?.location) query = query.eq("location", filters.location);
      if (filters?.week_start) query = query.eq("week_start", filters.week_start);
      if (filters?.search) query = query.ilike("employee_email", `%${filters.search}%`);

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return (data || []) as ProductivityRecord[];
    },
    enabled: !!user,
  });
}

export function useProductivitySummary(weekStart?: string) {
  return useQuery({
    queryKey: [PRODUCTIVITY_KEY, "summary", weekStart],
    queryFn: async (): Promise<ProductivitySummary> => {
      let query = supabase.from("productivity_records").select("*");
      if (weekStart) query = query.eq("week_start", weekStart);
      else {
        // Get most recent week
        const { data: latest } = await supabase
          .from("productivity_records")
          .select("week_start")
          .order("week_start", { ascending: false })
          .limit(1);
        if (latest?.[0]) query = query.eq("week_start", latest[0].week_start);
      }

      const { data, error } = await query;
      if (error) throw error;

      const records = data || [];
      const deptMap = new Map<string, { sum_util: number; count: number }>();

      let totalUtil = 0;
      let totalEff = 0;
      let totalTasks = 0;

      records.forEach((r: any) => {
        totalUtil += Number(r.utilization_pct) || 0;
        totalEff += Number(r.efficiency_score) || 0;
        totalTasks += r.tasks_completed || 0;

        const dept = r.department || "Unassigned";
        const cur = deptMap.get(dept) || { sum_util: 0, count: 0 };
        cur.sum_util += Number(r.utilization_pct) || 0;
        cur.count++;
        deptMap.set(dept, cur);
      });

      return {
        total_employees: records.length,
        avg_utilization: records.length ? Math.round(totalUtil / records.length) : 0,
        avg_efficiency: records.length ? Math.round(totalEff / records.length) : 0,
        total_tasks_completed: totalTasks,
        departments: Array.from(deptMap.entries()).map(([name, val]) => ({
          name,
          avg_utilization: Math.round(val.sum_util / val.count),
          employee_count: val.count,
        })),
      };
    },
  });
}

export interface PodProductivitySummary {
  pod_id: string;
  pod_name: string;
  department_name: string;
  member_count: number;
  avg_utilization: number;
  avg_efficiency: number;
  total_tasks: number;
}

export function usePodProductivity(weekStart?: string) {
  return useQuery({
    queryKey: [PRODUCTIVITY_KEY, "pods", weekStart],
    queryFn: async (): Promise<PodProductivitySummary[]> => {
      const [podRes, memberRes, profileRes, recordsRes] = await Promise.all([
        supabase.from("pods").select("id, name, department_id, is_active").eq("is_active", true),
        supabase.from("pod_members").select("pod_id, user_id"),
        supabase.from("employee_profiles").select("user_id, email"),
        (() => {
          let q = supabase.from("productivity_records").select("employee_email, utilization_pct, efficiency_score, tasks_completed");
          if (weekStart) q = q.eq("week_start", weekStart);
          return q;
        })(),
      ]);

      const pods = podRes.data || [];
      const members = memberRes.data || [];
      const profiles = profileRes.data || [];
      const records = recordsRes.data || [];

      const { data: depts } = await supabase.from("departments").select("id, name");
      const deptMap = new Map((depts || []).map((d: any) => [d.id, d.name]));
      const userEmailMap = new Map(profiles.map((p: any) => [p.user_id, p.email]));

      const recordMap = new Map<string, { util: number; eff: number; tasks: number }>();
      (records as any[]).forEach((r) => {
        recordMap.set(r.employee_email, {
          util: Number(r.utilization_pct) || 0,
          eff: Number(r.efficiency_score) || 0,
          tasks: r.tasks_completed || 0,
        });
      });

      return pods.map((pod: any) => {
        const podMembers = members.filter((m: any) => m.pod_id === pod.id);
        let sumUtil = 0, sumEff = 0, sumTasks = 0, matched = 0;
        podMembers.forEach((m: any) => {
          const email = userEmailMap.get(m.user_id);
          if (email) {
            const rec = recordMap.get(email);
            if (rec) { sumUtil += rec.util; sumEff += rec.eff; sumTasks += rec.tasks; matched++; }
          }
        });
        return {
          pod_id: pod.id, pod_name: pod.name,
          department_name: deptMap.get(pod.department_id) || "Unassigned",
          member_count: podMembers.length,
          avg_utilization: matched ? Math.round(sumUtil / matched) : 0,
          avg_efficiency: matched ? Math.round(sumEff / matched) : 0,
          total_tasks: sumTasks,
        };
      }).sort((a: PodProductivitySummary, b: PodProductivitySummary) => b.avg_utilization - a.avg_utilization);
    },
  });
}

export function useAvailableWeeks() {
  return useQuery({
    queryKey: [PRODUCTIVITY_KEY, "weeks"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("productivity_records")
        .select("week_start")
        .order("week_start", { ascending: false });
      if (error) throw error;
      const unique = [...new Set((data || []).map((d: any) => d.week_start))];
      return unique as string[];
    },
  });
}

export function useAIProductivityInsights(scope?: { department?: string; week_start?: string }) {
  return useQuery({
    queryKey: [PRODUCTIVITY_KEY, "ai-insights", scope],
    queryFn: async (): Promise<AIProductivityInsight[]> => {
      let query = supabase
        .from("ai_productivity_insights")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (scope?.department) {
        query = query.eq("department", scope.department);
      }
      if (scope?.week_start) {
        query = query.eq("week_start", scope.week_start);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AIProductivityInsight[];
    },
  });
}

