/**
 * Scorecard Hooks
 *
 * CRUD operations for scorecards and their metrics.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { EOSScorecard, EOSScorecardMetric } from "../types";

const SCORECARD_KEY = "eos-scorecards";

/**
 * Fetch all active scorecards.
 */
export function useScorecards() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [SCORECARD_KEY],
    queryFn: async (): Promise<EOSScorecard[]> => {
      const { data, error } = await supabase
        .from("eos_scorecards")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as EOSScorecard[];
    },
    enabled: !!user,
  });
}

/**
 * Fetch a scorecard with its metrics.
 */
export function useScorecardDetail(id: string | undefined) {
  return useQuery({
    queryKey: [SCORECARD_KEY, "detail", id],
    queryFn: async (): Promise<EOSScorecard | null> => {
      if (!id) return null;

      const { data: scorecard, error } = await supabase
        .from("eos_scorecards")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (!scorecard) return null;

      const { data: metrics } = await supabase
        .from("eos_scorecard_metrics")
        .select("*")
        .eq("scorecard_id", id)
        .order("sort_order", { ascending: true });

      return { ...scorecard, metrics: (metrics || []) as unknown as EOSScorecardMetric[] } as unknown as EOSScorecard;
    },
    enabled: !!id,
  });
}

/**
 * Fetch metrics for a scorecard, optionally filtered by date range.
 */
export function useScorecardMetrics(scorecardId: string | undefined) {
  return useQuery({
    queryKey: [SCORECARD_KEY, "metrics", scorecardId],
    queryFn: async (): Promise<EOSScorecardMetric[]> => {
      if (!scorecardId) return [];

      const { data, error } = await supabase
        .from("eos_scorecard_metrics")
        .select("*")
        .eq("scorecard_id", scorecardId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as EOSScorecardMetric[];
    },
    enabled: !!scorecardId,
  });
}

/**
 * Create a new scorecard.
 */
export function useCreateScorecard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; frequency?: string; pod_id?: string; is_active?: boolean }) => {
      const { data: scorecard, error } = await supabase
        .from("eos_scorecards")
        .insert({
          name: data.name,
          description: data.description || null,
          frequency: data.frequency || "weekly",
          owner_id: user!.id,
          created_by: user!.id,
          pod_id: data.pod_id || null,
          is_active: data.is_active ?? true,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return scorecard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SCORECARD_KEY] });
      toast.success("Scorecard created");
    },
    onError: (error: Error) => {
      toast.error("Failed to create scorecard", { description: error.message });
    },
  });
}

/**
 * Add a metric to a scorecard.
 */
export function useAddMetric() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      scorecard_id: string;
      name: string;
      description?: string;
      metric_type?: string;
      target_value: number;
      unit?: string;
      goal_direction?: string;
    }) => {
      const { data: metric, error } = await supabase
        .from("eos_scorecard_metrics")
        .insert({
          scorecard_id: data.scorecard_id,
          name: data.name,
          description: data.description || null,
          metric_type: data.metric_type || "number",
          target_value: data.target_value,
          unit: data.unit || "",
          goal_direction: data.goal_direction || "higher_is_better",
        })
        .select()
        .single();

      if (error) throw error;
      return metric;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SCORECARD_KEY] });
      toast.success("Metric added");
    },
    onError: (error: Error) => {
      toast.error("Failed to add metric", { description: error.message });
    },
  });
}

/**
 * Update a metric value (check-in).
 */
export function useUpdateMetric() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EOSScorecardMetric> }) => {
      const { data: metric, error } = await supabase
        .from("eos_scorecard_metrics")
        .update({ ...data, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return metric;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SCORECARD_KEY] });
      toast.success("Metric updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update metric", { description: error.message });
    },
  });
}
