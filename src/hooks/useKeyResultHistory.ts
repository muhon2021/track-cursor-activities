import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { KeyResultHistoryRow } from "@/types/okr";

export function useKeyResultHistory(krId: string) {
  const query = useQuery({
    queryKey: ["okr-key-result-history", krId],
    queryFn: async (): Promise<KeyResultHistoryRow[]> => {
      if (!krId) return [];
      const { data, error } = await supabase
        .from("key_result_history" as never)
        .select("*" as never)
        .eq("key_result_id", krId)
        .order("updated_at", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as KeyResultHistoryRow[];
    },
    enabled: !!krId,
  });

  const trend = useMemo<"up" | "down" | "stable">(() => {
    const rows = query.data || [];
    if (rows.length < 2) return "stable";
    const first = Number(rows[0].new_value || 0);
    const last = Number(rows[rows.length - 1].new_value || 0);
    if (last > first) return "up";
    if (last < first) return "down";
    return "stable";
  }, [query.data]);

  return { data: query.data || [], isLoading: query.isLoading, trend };
}

export function useKeyResultsHistory(krIds: string[]) {
  return useQuery({
    queryKey: ["okr-key-results-history", krIds.slice().sort().join(",")],
    queryFn: async (): Promise<Record<string, KeyResultHistoryRow[]>> => {
      if (!krIds.length) return {};
      const { data, error } = await supabase
        .from("key_result_history" as never)
        .select("*" as never)
        .in("key_result_id", krIds as never)
        .order("updated_at", { ascending: true });

      if (error) throw error;

      const grouped: Record<string, KeyResultHistoryRow[]> = {};
      ((data || []) as unknown as KeyResultHistoryRow[]).forEach((row) => {
        if (!grouped[row.key_result_id]) grouped[row.key_result_id] = [];
        grouped[row.key_result_id].push(row);
      });

      return grouped;
    },
    enabled: krIds.length > 0,
  });
}
