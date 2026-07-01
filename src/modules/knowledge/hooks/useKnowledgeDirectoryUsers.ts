import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cacheConfig } from "@/lib/cache";

export interface KnowledgeDirectoryUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

export function useKnowledgeDirectoryUsers(excludeUserId?: string) {
  return useQuery({
    queryKey: ["knowledge", "directory-users", excludeUserId],
    queryFn: async (): Promise<KnowledgeDirectoryUser[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url")
        .order("full_name", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? [])
        .filter((profile) => profile.id !== excludeUserId)
        .map((profile) => ({
          id: profile.id,
          email: profile.email ?? "",
          fullName: profile.full_name?.trim() || profile.email || "Unknown user",
          avatarUrl: profile.avatar_url,
        }));
    },
    staleTime: cacheConfig.staleTime.medium,
  });
}
