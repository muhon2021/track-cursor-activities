import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type LastUpdate = { updated_at: string | null };
type KeyResultUpdateRow = { id: string; updated_at: string | null };

const frequencyDays: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

export function useKeyResultLastUpdates(krIds: string[]) {
  const query = useQuery({
    queryKey: ["okr-key-result-last-updates", krIds.slice().sort().join(",")],
    queryFn: async (): Promise<Record<string, LastUpdate>> => {
      if (!krIds.length) return {};
      const { data, error } = await supabase
        .from("okr_key_results")
        .select("id,updated_at")
        .in("id", krIds)
        .limit(krIds.length);

      if (error) throw error;
      const map: Record<string, LastUpdate> = {};
      ((data || []) as KeyResultUpdateRow[]).forEach((row) => {
        map[row.id] = { updated_at: row.updated_at || null };
      });
      return map;
    },
    enabled: krIds.length > 0,
  });

  const isOverdue = (krId: string, frequency: keyof typeof frequencyDays = "weekly") => {
    const value = query.data?.[krId];
    if (!value?.updated_at) return true;
    const updatedAt = new Date(value.updated_at).getTime();
    const thresholdMs = (frequencyDays[frequency] || 7) * 24 * 60 * 60 * 1000;
    return Date.now() - updatedAt > thresholdMs;
  };

  return { data: query.data || {}, isLoading: query.isLoading, isOverdue };
}
