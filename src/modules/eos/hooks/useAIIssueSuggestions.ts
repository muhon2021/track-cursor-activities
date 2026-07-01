/**
 * AI Issue Suggestions Hook
 *
 * CRUD for AI-generated issue suggestions from the eos_issue_suggestions table.
 * Supports filtering by status, issue, and suggestion_type.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { EOSIssueSuggestion } from "../types";

const SUGGESTIONS_KEY = "eos-issue-suggestions";

export interface SuggestionFilters {
  status?: "pending" | "accepted" | "rejected" | "all";
  issue_id?: string;
  suggestion_type?: "root_cause" | "action_item" | "related_pattern" | "all";
}

export interface SuggestionStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  avgConfidence: number;
  byType: Record<string, number>;
}

/**
 * Fetch AI issue suggestions with filters.
 */
export function useAIIssueSuggestions(filters?: SuggestionFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [SUGGESTIONS_KEY, filters],
    queryFn: async (): Promise<EOSIssueSuggestion[]> => {
      let query = supabase
        .from("eos_issue_suggestions")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.issue_id) {
        query = query.eq("issue_id", filters.issue_id);
      }
      if (filters?.suggestion_type && filters.suggestion_type !== "all") {
        query = query.eq("suggestion_type", filters.suggestion_type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as EOSIssueSuggestion[];
    },
    enabled: !!user,
  });
}

/**
 * Get suggestion statistics.
 */
export function useSuggestionStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [SUGGESTIONS_KEY, "stats"],
    queryFn: async (): Promise<SuggestionStats> => {
      const { data, error } = await supabase
        .from("eos_issue_suggestions")
        .select("status, suggestion_type, confidence");

      if (error) throw error;
      const suggestions = (data || []) as EOSIssueSuggestion[];

      const byType: Record<string, number> = {};
      let totalConfidence = 0;

      for (const s of suggestions) {
        byType[s.suggestion_type] = (byType[s.suggestion_type] || 0) + 1;
        totalConfidence += s.confidence;
      }

      return {
        total: suggestions.length,
        pending: suggestions.filter((s) => s.status === "pending").length,
        accepted: suggestions.filter((s) => s.status === "accepted").length,
        rejected: suggestions.filter((s) => s.status === "rejected").length,
        avgConfidence: suggestions.length > 0
          ? Math.round((totalConfidence / suggestions.length) * 100)
          : 0,
        byType,
      };
    },
    enabled: !!user,
  });
}

/**
 * Accept or reject a suggestion.
 */
export function useReviewSuggestion() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "accepted" | "rejected";
    }) => {
      const { data, error } = await supabase
        .from("eos_issue_suggestions")
        .update({
          status,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: [SUGGESTIONS_KEY] });
      toast.success(`Suggestion ${status}`);
    },
    onError: (error: Error) => {
      toast.error("Failed to review suggestion", { description: error.message });
    },
  });
}
