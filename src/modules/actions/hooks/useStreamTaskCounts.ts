import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const COUNTS_KEY = "stream-task-counts";

export function useStreamTaskCounts() {
  return useQuery({
    queryKey: [COUNTS_KEY],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("category_id")
        .not("category_id", "is", null)
        .not("status", "in", '("completed","cancelled","closed","descoped")');

      if (error) throw error;

      return (data || []).reduce<Record<string, number>>((acc, row) => {
        if (!row.category_id) return acc;
        acc[row.category_id] = (acc[row.category_id] || 0) + 1;
        return acc;
      }, {});
    },
  });
}
