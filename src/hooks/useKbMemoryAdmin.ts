import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import { toast } from "sonner";
import type { AdminUserMemory } from "@/types/knowledgeRag";

export function useMemoryAdminSearch(email?: string, department?: string) {
  return useQuery({
    queryKey: queryKeys.knowledge.memoryAdmin("search", email, department),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-memory-actions", {
        body: { action: "search", email, department },
      });
      if (error) throw error;
      return (data?.users ?? []) as { id: string; email: string; full_name: string; department?: string; memory_count: number }[];
    },
    enabled: !!(email || department),
  });
}

export function useMemoryAdminList(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.knowledge.memoryAdmin("list", userId),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-memory-actions", {
        body: { action: "list", user_id: userId },
      });
      if (error) throw error;
      return (data?.memories ?? []) as AdminUserMemory[];
    },
    enabled: !!userId,
  });
}

export function useMemoryAdminActions() {
  return useMutation({
    mutationFn: async (input: { action: "delete" | "export"; user_id: string; memory_id?: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-memory-actions", { body: input });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      if (vars.action === "delete") toast.success("Memory deleted");
      if (vars.action === "export") toast.success("Memory export ready");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
