/**
 * VTO version history hook.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys, cacheConfig } from "@/lib/cache";
import type { EOSVTOVersion } from "../types";

export function useVTOVersions(section: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.eos.vtoVersions(section),
    queryFn: async (): Promise<EOSVTOVersion[]> => {
      const { data: vto } = await supabase
        .from("eos_vto")
        .select("id")
        .eq("section", section)
        .single();

      if (!vto) return [];

      const { data, error } = await supabase
        .from("eos_vto_versions")
        .select("*")
        .eq("vto_id", vto.id)
        .order("version", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as EOSVTOVersion[];
    },
    enabled: !!user && !!section,
    staleTime: cacheConfig.staleTime.medium,
  });
}
