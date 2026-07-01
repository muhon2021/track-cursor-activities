/**
 * Pending Assignment Count Hook
 *
 * Fetches the count of pending meeting assignment suggestions that
 * need review. Uses Supabase head:true count for efficiency.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PENDING_ASSIGNMENT_COUNT_KEY = "pending-assignment-count";

/**
 * Fetch the count of pending assignment suggestions awaiting review.
 */
export function usePendingAssignmentCount() {
  return useQuery({
    queryKey: [PENDING_ASSIGNMENT_COUNT_KEY],
    queryFn: async (): Promise<number> => {
      const { count, error } = await (supabase as any)
        .from("meeting_assignment_suggestions")
        .select("id", { count: "exact", head: true })
        .eq("review_status", "pending");

      if (error) throw error;
      return count || 0;
    },
  });
}
