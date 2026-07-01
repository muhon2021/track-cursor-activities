/**
 * Agent categories (AI Hub): list with counts, create, update, toggle active, delete.
 * Categories are linked to ai_agents via ai_agents.category = ai_agent_categories.slug.
 * Counts: match ai_agents.category to ai_agent_categories.slug; only non-deleted agents
 * (if ai_agents.deleted_at exists, filter deleted_at IS NULL).
 * Delete is allowed only when the category has no agents.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, invalidateKeys, cacheConfig } from "@/lib/cache";
import { toast } from "sonner";

export interface AgentCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentCategoryWithCounts extends AgentCategory {
  total_agents: number;
  active_agents: number;
}

export interface AgentCategoriesStats {
  totalCategories: number;
  activeCategories: number;
  totalAgents: number;
  activeAgents: number;
}

async function fetchCategories(): Promise<AgentCategory[]> {
  const { data, error } = await supabase
    .from("ai_agent_categories")
    .select("*")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AgentCategory[];
}

async function fetchAgentCountsByCategory(): Promise<
  Map<string, { total: number; active: number }>
> {
  let query = supabase
    .from("ai_agents")
    .select("category, is_enabled");
  // If ai_agents has deleted_at, uncomment to exclude soft-deleted agents:
  // query = query.is("deleted_at", null);
  const { data, error } = await query;
  if (error) throw error;
  const map = new Map<string, { total: number; active: number }>();
  for (const row of data ?? []) {
    const slug = row.category ?? "general";
    const cur = map.get(slug) ?? { total: 0, active: 0 };
    cur.total += 1;
    if (row.is_enabled) cur.active += 1;
    map.set(slug, cur);
  }
  return map;
}

export function useAgentCategories() {
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: queryKeys.ai.agentCategories,
    queryFn: async (): Promise<AgentCategoryWithCounts[]> => {
      const [categories, countsMap] = await Promise.all([
        fetchCategories(),
        fetchAgentCountsByCategory(),
      ]);
      return categories.map((c) => {
        const counts = countsMap.get(c.slug) ?? { total: 0, active: 0 };
        return {
          ...c,
          total_agents: counts.total,
          active_agents: counts.active,
        };
      });
    },
    staleTime: cacheConfig.staleTime.medium,
  });

  const stats: AgentCategoriesStats = (() => {
    const list = categoriesQuery.data ?? [];
    let totalAgents = 0;
    let activeAgents = 0;
    for (const c of list) {
      totalAgents += c.total_agents;
      activeAgents += c.active_agents;
    }
    return {
      totalCategories: list.length,
      activeCategories: list.filter((c) => c.is_active).length,
      totalAgents,
      activeAgents,
    };
  })();

  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      slug: string;
      description?: string | null;
      icon?: string | null;
      display_order?: number;
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("ai_agent_categories")
        .insert({
          name: payload.name,
          slug: payload.slug,
          description: payload.description ?? null,
          icon: payload.icon ?? "FolderOpen",
          display_order: payload.display_order ?? 0,
          is_active: payload.is_active ?? true,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateKeys.ai(queryClient);
      toast.success("Category created");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to create category");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      oldSlug: string;
      updates: {
        name?: string;
        slug?: string;
        description?: string | null;
        icon?: string | null;
        display_order?: number;
        is_active?: boolean;
      };
    }) => {
      const { id, oldSlug, updates } = params;
      if (updates.slug && updates.slug !== oldSlug) {
        const { error: updateAgentsError } = await supabase
          .from("ai_agents")
          .update({ category: updates.slug })
          .eq("category", oldSlug);
        if (updateAgentsError) throw updateAgentsError;
      }
      const { error } = await supabase
        .from("ai_agent_categories")
        .update({
          ...(updates.name != null && { name: updates.name }),
          ...(updates.slug != null && { slug: updates.slug }),
          ...(updates.description !== undefined && {
            description: updates.description,
          }),
          ...(updates.icon !== undefined && { icon: updates.icon }),
          ...(updates.display_order !== undefined && {
            display_order: updates.display_order,
          }),
          ...(updates.is_active !== undefined && { is_active: updates.is_active }),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.ai(queryClient);
      toast.success("Category updated");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to update category");
    },
  });

  const setActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("ai_agent_categories")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { is_active }) => {
      invalidateKeys.ai(queryClient);
      toast.success(is_active ? "Category activated" : "Category deactivated");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to update category");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, slug }: { id: string; slug: string }) => {
      const { count, error: countError } = await supabase
        .from("ai_agents")
        .select("id", { count: "exact", head: true })
        .eq("category", slug);
      if (countError) throw countError;
      if ((count ?? 0) > 0) {
        throw new Error("Cannot delete category that has agents. Move or remove agents first.");
      }
      const { error } = await supabase
        .from("ai_agent_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.ai(queryClient);
      toast.success("Category deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete category");
    },
  });

  return {
    data: categoriesQuery.data ?? [],
    stats,
    isLoading: categoriesQuery.isLoading,
    refetch: categoriesQuery.refetch,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    setActive: setActiveMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

/** Alias for replication / external docs: same as useAgentCategories(). */
export function useAIAgentCategoriesWithCounts() {
  return useAgentCategories();
}
