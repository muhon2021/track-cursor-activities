/**
 * AI Agent Categories – list with counts, CRUD, toggle status.
 * Uses typedQuery, typedInsert, typedUpdate from supabase-helpers.
 * Categories linked to agents via ai_agents.category = ai_agent_categories.slug.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { typedQuery, typedInsert, typedUpdate } from "@/lib/supabase-helpers";
import type { Database } from "@/integrations/supabase/types";

type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// ============================================================================
// TYPES
// ============================================================================

export interface AIAgentCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  is_active: boolean | null;
  display_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AIAgentCategoryWithCounts extends AIAgentCategory {
  agent_count: number;
  active_agent_count: number;
}

export type CreateAIAgentCategoryInput = {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  is_active?: boolean;
  display_order?: number;
};

export type UpdateAIAgentCategoryInput = Partial<
  Omit<CreateAIAgentCategoryInput, "slug">
>;

// ============================================================================
// QUERY KEYS
// ============================================================================

export const aiAgentCategoriesKeys = {
  all: ["ai_agent_categories"] as const,
  lists: () => [...aiAgentCategoriesKeys.all, "list"] as const,
  withCounts: () => [...aiAgentCategoriesKeys.all, "with-counts"] as const,
  detail: (id: string) => [...aiAgentCategoriesKeys.all, "detail", id] as const,
};

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

async function fetchAIAgentCategories(): Promise<AIAgentCategory[]> {
  const { data, error } = await typedQuery("ai_agent_categories")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw new Error(String(error));
  return (data ?? []) as AIAgentCategory[];
}

async function fetchActiveAIAgentCategories(): Promise<AIAgentCategory[]> {
  const { data, error } = await typedQuery("ai_agent_categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) throw new Error(String(error));
  return (data ?? []) as AIAgentCategory[];
}

async function fetchAIAgentCategoriesWithCounts(): Promise<
  AIAgentCategoryWithCounts[]
> {
  const { data: categories, error: categoriesError } = await typedQuery(
    "ai_agent_categories"
  )
    .select("*")
    .order("display_order", { ascending: true });
  if (categoriesError) throw new Error(String(categoriesError));

  const { data: agents, error: agentsError } = await typedQuery("ai_agents")
    .select("id, category, is_enabled")
    .is("deleted_at", null);
  if (agentsError) throw new Error(String(agentsError));

  type CategoryRow = AIAgentCategory & { slug: string };
  type AgentRow = { id: string; category?: string | null; is_enabled?: boolean };

  const list = (categories ?? []) as CategoryRow[];
  const agentList = (agents ?? []) as AgentRow[];

  return list.map((category) => {
    const categoryAgents = agentList.filter(
      (a) => (a.category ?? "") === category.slug
    );
    const activeAgents = categoryAgents.filter((a) => a.is_enabled === true);
    return {
      ...category,
      agent_count: categoryAgents.length,
      active_agent_count: activeAgents.length,
    } as AIAgentCategoryWithCounts;
  });
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch all AI agent categories (including inactive for admin)
 */
export function useAIAgentCategories() {
  return useQuery({
    queryKey: aiAgentCategoriesKeys.lists(),
    queryFn: fetchAIAgentCategories,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch only active AI agent categories (for form selectors)
 */
export function useActiveAIAgentCategories() {
  return useQuery({
    queryKey: [...aiAgentCategoriesKeys.lists(), "active"],
    queryFn: fetchActiveAIAgentCategories,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch AI agent categories with agent counts (for admin dashboard)
 */
export function useAIAgentCategoriesWithCounts() {
  return useQuery({
    queryKey: aiAgentCategoriesKeys.withCounts(),
    queryFn: fetchAIAgentCategoriesWithCounts,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Create a new AI agent category
 */
export function useCreateAIAgentCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAIAgentCategoryInput) => {
      const payload: TablesInsert<"ai_agent_categories"> = {
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        icon: input.icon ?? "folder",
        is_active: input.is_active ?? true,
        display_order: input.display_order ?? 0,
      };
      const { data, error } = await typedInsert(
        "ai_agent_categories",
        payload
      );
      if (error) throw new Error(String(error));
      return data as AIAgentCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiAgentCategoriesKeys.all });
    },
  });
}

/**
 * Update an existing AI agent category
 */
export function useUpdateAIAgentCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateAIAgentCategoryInput;
    }) => {
      const updateData: TablesUpdate<"ai_agent_categories"> = {
        ...(updates.name != null && { name: updates.name }),
        ...(updates.description !== undefined && {
          description: updates.description ?? null,
        }),
        ...(updates.icon !== undefined && { icon: updates.icon ?? null }),
        ...(updates.is_active !== undefined && { is_active: updates.is_active }),
        ...(updates.display_order !== undefined && {
          display_order: updates.display_order ?? 0,
        }),
      };
      const { data, error } = await typedUpdate(
        "ai_agent_categories",
        id,
        updateData
      );
      if (error) throw new Error(String(error));
      return data as AIAgentCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiAgentCategoriesKeys.all });
    },
  });
}

/**
 * Delete an AI agent category. Fails if any agents reference this category (by slug).
 * UI should disable Delete when agent_count > 0; this is a server-side guard.
 */
export function useDeleteAIAgentCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, slug }: { id: string; slug: string }) => {
      const { count, error: countError } = await supabase
        .from("ai_agents")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("category", slug);
      if (countError) throw new Error(countError.message);
      if ((count ?? 0) > 0) {
        throw new Error(
          "Cannot delete category that has agents. Move or remove agents first."
        );
      }
      const { error } = await supabase
        .from("ai_agent_categories")
        .delete()
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiAgentCategoriesKeys.all });
    },
  });
}

/**
 * Toggle the active status of an AI agent category
 */
export function useToggleAIAgentCategoryStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      isActive,
    }: {
      id: string;
      isActive: boolean;
    }) => {
      const updateData: TablesUpdate<"ai_agent_categories"> = {
        is_active: !isActive,
      };
      const { data, error } = await typedUpdate(
        "ai_agent_categories",
        id,
        updateData
      );
      if (error) throw new Error(String(error));
      return data as AIAgentCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiAgentCategoriesKeys.all });
    },
  });
}
