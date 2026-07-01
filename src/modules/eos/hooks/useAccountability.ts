/**
 * Accountability Hooks
 *
 * CRUD operations for accountability charts, responsibilities, and GWC assessments.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type {
  AccountabilityChart,
  AccountabilityResponsibility,
  GWCAssessment,
} from "../types";

const ACCOUNTABILITY_KEY = "eos-accountability";

/**
 * Fetch the current accountability chart with responsibilities.
 */
export function useAccountabilityChart() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [ACCOUNTABILITY_KEY, "current"],
    queryFn: async (): Promise<AccountabilityChart | null> => {
      // Get the current chart
      const { data: chart, error } = await supabase
        .from("accountability_charts")
        .select("*")
        .eq("is_current", true)
        .maybeSingle();

      if (error) throw error;
      if (!chart) return null;

      // Fetch all responsibilities for this chart
      const { data: responsibilities } = await supabase
        .from("accountability_responsibilities")
        .select("*")
        .eq("chart_id", chart.id)
        .order("sort_order", { ascending: true });

      return {
        ...chart,
        responsibilities: buildTree((responsibilities || []) as unknown as AccountabilityResponsibility[]),
      };
    },
    enabled: !!user,
  });
}

/**
 * Fetch all accountability charts (for admin/history).
 */
export function useAccountabilityCharts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [ACCOUNTABILITY_KEY, "all"],
    queryFn: async (): Promise<AccountabilityChart[]> => {
      const { data, error } = await supabase
        .from("accountability_charts")
        .select("*")
        .order("version", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

/**
 * Fetch my accountability (current user's position in the chart).
 */
export function useMyAccountability() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [ACCOUNTABILITY_KEY, "my", user?.id],
    queryFn: async (): Promise<AccountabilityResponsibility | null> => {
      if (!user) return null;

      // Get the current chart
      const { data: chart } = await supabase
        .from("accountability_charts")
        .select("id")
        .eq("is_current", true)
        .maybeSingle();

      if (!chart) return null;

      // Find user's position
      const { data: responsibility, error } = await supabase
        .from("accountability_responsibilities")
        .select("*")
        .eq("chart_id", chart.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!responsibility) return null;

      // Fetch direct reports
      const { data: reports } = await supabase
        .from("accountability_responsibilities")
        .select("*")
        .eq("chart_id", chart.id)
        .eq("reports_to", responsibility.id)
        .order("sort_order", { ascending: true });

      // Fetch GWC assessment
      const { data: gwc } = await supabase
        .from("gwc_assessments")
        .select("*")
        .eq("responsibility_id", responsibility.id)
        .order("assessment_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        ...responsibility,
        direct_reports: (reports || []) as unknown as AccountabilityResponsibility[],
        gwc: gwc || null,
      } as AccountabilityResponsibility;
    },
    enabled: !!user,
  });
}

/**
 * Create a new accountability chart.
 */
export function useCreateChart() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const { data: chart, error } = await supabase
        .from("accountability_charts")
        .insert({
          name: data.name,
          description: data.description || null,
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return chart;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACCOUNTABILITY_KEY] });
      toast.success("Chart created");
    },
    onError: (error: Error) => {
      toast.error("Failed to create chart", { description: error.message });
    },
  });
}

/**
 * Add a responsibility to a chart.
 */
export function useAddResponsibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      chart_id: string;
      user_id?: string;
      role_title: string;
      department?: string;
      reports_to?: string;
      responsibilities?: string[];
    }) => {
      const { data: resp, error } = await supabase
        .from("accountability_responsibilities")
        .insert({
          chart_id: data.chart_id,
          user_id: data.user_id || null,
          role_title: data.role_title,
          department: data.department || null,
          reports_to: data.reports_to || null,
          responsibilities: data.responsibilities || [],
        })
        .select()
        .single();

      if (error) throw error;
      return resp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACCOUNTABILITY_KEY] });
      toast.success("Role added");
    },
    onError: (error: Error) => {
      toast.error("Failed to add role", { description: error.message });
    },
  });
}

/**
 * Save a GWC assessment.
 */
export function useSaveGWCAssessment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      responsibility_id: string;
      gets_it: boolean;
      wants_it: boolean;
      has_capacity: boolean;
      notes?: string;
    }) => {
      const { data: assessment, error } = await supabase
        .from("gwc_assessments")
        .upsert(
          {
            responsibility_id: data.responsibility_id,
            assessor_id: user!.id,
            gets_it: data.gets_it,
            wants_it: data.wants_it,
            has_capacity: data.has_capacity,
            notes: data.notes || null,
            assessment_date: new Date().toISOString().split("T")[0],
          },
          { onConflict: "responsibility_id,assessor_id,assessment_date" }
        )
        .select()
        .single();

      if (error) throw error;
      return assessment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACCOUNTABILITY_KEY] });
      toast.success("GWC assessment saved");
    },
    onError: (error: Error) => {
      toast.error("Failed to save assessment", { description: error.message });
    },
  });
}

// ========================
// Helpers
// ========================

/**
 * Build a tree from flat list of responsibilities.
 */
function buildTree(
  responsibilities: AccountabilityResponsibility[]
): AccountabilityResponsibility[] {
  const map = new Map<string, AccountabilityResponsibility>();
  const roots: AccountabilityResponsibility[] = [];

  // First pass: create map
  for (const r of responsibilities) {
    map.set(r.id, { ...r, direct_reports: [] });
  }

  // Second pass: build tree
  for (const r of responsibilities) {
    const node = map.get(r.id)!;
    if (r.reports_to && map.has(r.reports_to)) {
      map.get(r.reports_to)!.direct_reports!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
