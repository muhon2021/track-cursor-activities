/**
 * Categorize Meetings Hook
 *
 * AI-powered meeting categorization with confidence scoring.
 * Provides mutations for single and batch categorization, plus a
 * query for global category status counts.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MeetingCategorization } from "../types";

const CATEGORIZE_KEY = "meeting-categorize";

interface CategorizationResult {
  meeting_id: string;
  category: string;
  meeting_type: string | null;
  confidence: number;
  tags: string[] | null;
}

interface SmartCategorizationResult {
  results: CategorizationResult[];
  processed: number;
  errors: number;
}

interface CategoryStatusCount {
  category: string;
  count: number;
}

/**
 * Invoke AI categorization for a single meeting.
 */
export function useAiCategorizeMeetings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ meeting_id }: { meeting_id: string }): Promise<CategorizationResult> => {
      const { data, error } = await supabase.functions.invoke(
        "categorize-meeting",
        {
          body: { meeting_id },
        }
      );

      if (error) throw error;
      return data as CategorizationResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CATEGORIZE_KEY] });
      toast.success("Meeting categorized successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to categorize meeting", {
        description: error.message,
      });
    },
  });
}

/**
 * Invoke smart categorization for multiple meetings at once.
 */
export function useSmartCategorizeMeetings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      meeting_ids,
    }: {
      meeting_ids: string[];
    }): Promise<SmartCategorizationResult> => {
      const { data, error } = await supabase.functions.invoke(
        "smart-categorize-meetings",
        {
          body: { meeting_ids },
        }
      );

      if (error) throw error;
      return data as SmartCategorizationResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [CATEGORIZE_KEY] });
      toast.success(
        `Categorized ${data.processed} meeting${data.processed !== 1 ? "s" : ""}` +
          (data.errors > 0 ? ` (${data.errors} failed)` : "")
      );
    },
    onError: (error: Error) => {
      toast.error("Failed to categorize meetings", {
        description: error.message,
      });
    },
  });
}

/**
 * Fetch global counts of meetings grouped by categorization category.
 */
export function useGlobalStatusCounts() {
  return useQuery({
    queryKey: [CATEGORIZE_KEY, "status-counts"],
    queryFn: async (): Promise<CategoryStatusCount[]> => {
      const { data, error } = await supabase
        .from("meeting_categorizations")
        .select("category");

      if (error) throw error;

      const rows = (data || []) as unknown as { category: string }[];

      // Group by category and count client-side
      const countMap = new Map<string, number>();
      for (const row of rows) {
        const cat = row.category || "uncategorized";
        countMap.set(cat, (countMap.get(cat) || 0) + 1);
      }

      return Array.from(countMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
    },
  });
}
