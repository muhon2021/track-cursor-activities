import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import { toast } from "sonner";
import type { KbPermission, KbSourcePermissionRow } from "@/types/knowledgeRag";

export function useKbSourcePermissions() {
  return useQuery({
    queryKey: queryKeys.knowledge.permissions,
    queryFn: async () => {
      const [{ data: sources }, { data: perms }] = await Promise.all([
        supabase.from("knowledge_sources").select("id, name").order("name"),
        supabase.from("kb_source_permissions").select("*"),
      ]);
      return {
        sources: sources ?? [],
        permissions: (perms ?? []) as KbSourcePermissionRow[],
      };
    },
  });
}

export function useUpsertKbSourcePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      source_id: string;
      app_role: "admin" | "moderator" | "user";
      permissions: KbPermission[];
      id?: string;
    }) => {
      if (input.id) {
        const { error } = await supabase
          .from("kb_source_permissions")
          .update({ permissions: input.permissions })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("kb_source_permissions").upsert({
          source_id: input.source_id,
          app_role: input.app_role,
          permissions: input.permissions,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.permissions });
      toast.success("Permissions updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
