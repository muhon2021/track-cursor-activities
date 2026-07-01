/**
 * Scorecard Admin Hook
 *
 * Exact functionality per Admin EOS Scorecards plan.
 * Tables: eos_scorecards (templates), eos_scorecard_metrics (metrics), eos_pods.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEOSPods } from "@/modules/eos/hooks/useEOSPods";
import { useCreateScorecard } from "@/modules/eos/hooks/useScorecard";
import type { EOSScorecard, EOSScorecardMetric } from "@/modules/eos/types";

const SCORECARD_KEY = "eos-scorecards";

// ─── Notes helpers (JSON: podId, role, commentary) ───────────────────────────

export interface MetricNotesMeta {
  podId?: string;
  role?: string;
  commentary?: string;
}

export function parseMetricNotes(notes: string | null | undefined): MetricNotesMeta {
  if (!notes || typeof notes !== "string") return {};
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    return {
      podId: typeof parsed.podId === "string" ? parsed.podId : undefined,
      role: typeof parsed.role === "string" ? parsed.role : undefined,
      commentary: typeof parsed.commentary === "string" ? parsed.commentary : undefined,
    };
  } catch {
    return {};
  }
}

export function serializeMetricNotes(meta: MetricNotesMeta): string | null {
  if (!meta.podId && !meta.role && !meta.commentary) return null;
  return JSON.stringify({
    ...(meta.podId && { podId: meta.podId }),
    ...(meta.role && { role: meta.role }),
    ...(meta.commentary && { commentary: meta.commentary }),
  });
}

// ─── Templates ───────────────────────────────────────────────────────────────

export function useScorecardTemplates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [SCORECARD_KEY, "admin", "templates"],
    queryFn: async (): Promise<EOSScorecard[]> => {
      const { data, error } = await supabase
        .from("eos_scorecards")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as EOSScorecard[];
    },
    enabled: !!user,
  });
}

// ─── Metrics (with filters) ───────────────────────────────────────────────────

export interface ScorecardMetricsParams {
  scorecardId?: string | null;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export function useScorecardMetrics(params: ScorecardMetricsParams) {
  const { user } = useAuth();
  const { scorecardId, startDate, endDate, search } = params;
  return useQuery({
    queryKey: [SCORECARD_KEY, "admin", "metrics", scorecardId, startDate, endDate, search],
    queryFn: async (): Promise<(EOSScorecardMetric & { notes?: string | null })[]> => {
      if (!scorecardId) return [];
      let query = supabase
        .from("eos_scorecard_metrics")
        .select("*")
        .eq("scorecard_id", scorecardId)
        .order("week_of", { ascending: false, nullsFirst: false });
      if (startDate) query = query.gte("week_of", startDate);
      if (endDate) query = query.lte("week_of", endDate);
      if (search?.trim()) query = query.ilike("name", `%${search.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as (EOSScorecardMetric & { notes?: string | null })[];
    },
    enabled: !!user && !!scorecardId,
  });
}

/** Fetch all metrics for counts (e.g. per-template metric counts) */
export function useAllMetricsForCounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [SCORECARD_KEY, "admin", "all-metrics-counts"],
    queryFn: async (): Promise<{ scorecard_id: string }[]> => {
      const { data, error } = await supabase
        .from("eos_scorecard_metrics")
        .select("scorecard_id");
      if (error) throw error;
      return (data || []) as { scorecard_id: string }[];
    },
    enabled: !!user,
  });
}

// ─── Pods ────────────────────────────────────────────────────────────────────

export function usePodsDirectory() {
  return useEOSPods();
}

// ─── Template mutations (alias to module hooks) ───────────────────────────────

export { useCreateScorecard as useCreateTemplate };

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EOSScorecard> }) => {
      const payload: Record<string, unknown> = {
        ...data,
        updated_at: new Date().toISOString(),
      };
      if (typeof data.is_active === "boolean") payload.is_active = data.is_active;
      const { error } = await supabase.from("eos_scorecards").update(payload as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SCORECARD_KEY] });
      toast.success("Template updated");
    },
    onError: (e: Error) => toast.error("Failed to update template", { description: e.message }),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("eos_scorecard_metrics").delete().eq("scorecard_id", id);
      const { error } = await supabase.from("eos_scorecards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SCORECARD_KEY] });
      toast.success("Template deleted");
    },
    onError: (e: Error) => toast.error("Failed to delete template", { description: e.message }),
  });
}

// ─── Metric mutations (with notes, is_on_track logic) ─────────────────────────

export interface CreateMetricInput {
  scorecard_id: string;
  metric_name: string;
  measurable?: string;
  goal_value?: number;
  actual_value?: number;
  week_date: string;
  owner_id?: string;
  podId?: string;
  role?: string;
  commentary?: string;
}

export interface UpdateMetricInput {
  id: string;
  scorecard_id: string;
  metric_name: string;
  measurable?: string;
  goal_value?: number;
  actual_value?: number;
  week_date: string;
  owner_id?: string;
  podId?: string;
  role?: string;
  commentary?: string;
}

function computeStatus(goal?: number, actual?: number): "on_track" | "off_track" | "needs_attention" | null {
  if (goal == null || actual == null) return null;
  return actual >= goal ? "on_track" : "off_track";
}

export function useCreateMetric() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateMetricInput) => {
      const status = computeStatus(data.goal_value, data.actual_value);
      const notes = serializeMetricNotes({
        podId: data.podId,
        role: data.role,
        commentary: data.commentary,
      });
      const payload = {
        scorecard_id: data.scorecard_id,
        name: data.metric_name,
        description: data.measurable || null,
        target_value: data.goal_value ?? null,
        current_value: data.actual_value ?? 0,
        week_of: data.week_date,
        status: status ?? "needs_attention",
        notes,
      };
      const { data: metric, error } = await supabase
        .from("eos_scorecard_metrics")
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return metric;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SCORECARD_KEY] });
      toast.success("Metric created");
    },
    onError: (e: Error) => toast.error("Failed to create metric", { description: e.message }),
  });
}

export function useUpdateMetricAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateMetricInput) => {
      const status = computeStatus(data.goal_value, data.actual_value);
      const notes = serializeMetricNotes({
        podId: data.podId,
        role: data.role,
        commentary: data.commentary,
      });
      const payload: Record<string, unknown> = {
        name: data.metric_name,
        description: data.measurable || null,
        target_value: data.goal_value ?? null,
        current_value: data.actual_value ?? 0,
        week_of: data.week_date,
        notes,
        updated_at: new Date().toISOString(),
      };
      if (status != null) payload.status = status;
      const { error } = await supabase
        .from("eos_scorecard_metrics")
        .update(payload as any)
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SCORECARD_KEY] });
      toast.success("Metric updated");
    },
    onError: (e: Error) => toast.error("Failed to update metric", { description: e.message }),
  });
}

export function useDeleteMetric() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eos_scorecard_metrics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SCORECARD_KEY] });
      toast.success("Metric deleted");
    },
    onError: (e: Error) => toast.error("Failed to delete metric", { description: e.message }),
  });
}
