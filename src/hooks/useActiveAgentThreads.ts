/**
 * Active conversation threads per agent — for /agents continuation badges.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, cacheConfig } from "@/lib/cache";

const db = supabase as any;

export interface ActiveAgentThread {
  agentId: string;
  agentSlug: string;
  conversationId: string;
  title: string | null;
  messageCount: number;
  lastMessageAt: string | null;
}

export function useActiveAgentThreads() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.ai.activeThreads(user?.id ?? ""),
    queryFn: async (): Promise<Map<string, ActiveAgentThread>> => {
      if (!user?.id) return new Map();

      const { data, error } = await db
        .from("agent_conversations")
        .select(
          `
          id, agent_id, title, message_count, last_message_at,
          ai_agents (slug)
        `
        )
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .gt("message_count", 0)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) throw error;

      const map = new Map<string, ActiveAgentThread>();
      for (const row of data ?? []) {
        const slug = (row.ai_agents as { slug?: string } | null)?.slug;
        if (!slug || map.has(slug)) continue;
        map.set(slug, {
          agentId: row.agent_id,
          agentSlug: slug,
          conversationId: row.id,
          title: row.title,
          messageCount: row.message_count ?? 0,
          lastMessageAt: row.last_message_at,
        });
      }
      return map;
    },
    enabled: !!user?.id,
    staleTime: cacheConfig.staleTime.short,
  });
}
