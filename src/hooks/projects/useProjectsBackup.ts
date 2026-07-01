/**
 * Project backups - per PROJECTS-EXACT-FILE-LIST.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAllProjectBackups() {
  return useQuery({
    queryKey: ["project-backups-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_backups").select("id, project_id, created_at").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateProjectBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => ({}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-backups-summary"] }),
  });
}

export function useRestoreProjectBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { createdAt?: string }) => {
      const { error } = await supabase.functions.invoke("restore-projects-from-backup", { body: params });
      if (error) throw error;
      return {};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-backups-summary"] });
    },
  });
}
