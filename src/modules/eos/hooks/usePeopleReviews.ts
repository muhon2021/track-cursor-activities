/**
 * People Analyzer reviews hook.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys, cacheConfig, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";
import type { EOSPeopleReview, CoreValueRating, PeopleReviewOverall } from "../types";

export interface PeopleReviewFilters {
  userId?: string;
  reviewPeriod?: string;
  departmentId?: string;
}

export function usePeopleReviews(filters: PeopleReviewFilters = {}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.eos.peopleReviews(filters as unknown as Record<string, unknown>),
    queryFn: async (): Promise<EOSPeopleReview[]> => {
      let query = supabase
        .from("eos_people_reviews")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters.userId) query = query.eq("user_id", filters.userId);
      if (filters.reviewPeriod) query = query.eq("review_period", filters.reviewPeriod);

      const { data, error } = await query;
      if (error) throw error;

      const reviews = (data || []) as EOSPeopleReview[];
      const userIds = [...new Set([...reviews.map((r) => r.user_id), ...reviews.map((r) => r.reviewer_id)])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

      return reviews.map((r) => ({
        ...r,
        core_values_scores: (r.core_values_scores || {}) as Record<string, CoreValueRating>,
        user: profileMap[r.user_id] || null,
        reviewer: profileMap[r.reviewer_id] || null,
      }));
    },
    enabled: !!user,
    staleTime: cacheConfig.staleTime.medium,
  });
}

export function useCreatePeopleReview() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      review_period: string;
      core_values_scores: Record<string, CoreValueRating>;
      gwc_gets_it: boolean;
      gwc_wants_it: boolean;
      gwc_has_capacity: boolean;
      overall_score: PeopleReviewOverall;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("eos_people_reviews")
        .insert({
          ...input,
          reviewer_id: user!.id,
          core_values_scores: input.core_values_scores,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateKeys.eos(queryClient);
      toast.success("People review saved");
    },
    onError: (e: Error) => toast.error("Failed to save review", { description: e.message }),
  });
}
