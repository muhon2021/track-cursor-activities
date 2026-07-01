import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type KnowledgeCategory = Database['public']['Tables']['knowledge_categories']['Row'];
type KnowledgeCategoryInsert = Database['public']['Tables']['knowledge_categories']['Insert'];
type KnowledgeCategoryUpdate = Database['public']['Tables']['knowledge_categories']['Update'];

interface CategoryStats {
  entry_count: number;
  published_count: number;
  draft_count: number;
  total_views: number;
  last_updated: string | null;
}

interface CategoryWithStats extends KnowledgeCategory {
  stats?: CategoryStats;
  children?: CategoryWithStats[];
}

/**
 * Hook to fetch all categories with optional statistics
 */
export function useCategories(includeStats = false) {
  return useQuery({
    queryKey: ['knowledge-categories', includeStats],
    queryFn: async () => {
      const { data: categories, error } = await supabase
        .from('knowledge_categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;

      if (!includeStats) {
        return categories as KnowledgeCategory[];
      }

      // Fetch stats for each category by counting entries directly
      const categoriesWithStats: CategoryWithStats[] = await Promise.all(
        categories.map(async (category) => {
          const { data: entries } = await supabase
            .from('knowledge_entries')
            .select('status, view_count, updated_at')
            .eq('category_id', category.id);

          const stats: CategoryStats = {
            entry_count: entries?.length || 0,
            published_count: entries?.filter((e) => e.status === 'published').length || 0,
            draft_count: entries?.filter((e) => e.status === 'draft').length || 0,
            total_views: entries?.reduce((sum, e) => sum + (e.view_count || 0), 0) || 0,
            last_updated: entries?.length
              ? entries.sort((a, b) => 
                  new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                )[0]?.updated_at
              : null,
          };

          return {
            ...category,
            stats,
          };
        })
      );

      return categoriesWithStats;
    },
  });
}

/**
 * Hook to fetch categories organized in a tree structure
 */
export function useCategoryTree() {
  const { data: categories = [], ...rest } = useCategories(true);

  const buildTree = (items: CategoryWithStats[]): CategoryWithStats[] => {
    const map = new Map<string, CategoryWithStats>();
    const roots: CategoryWithStats[] = [];

    // Create a map of all items
    items.forEach((item) => {
      map.set(item.id, { ...item, children: [] });
    });

    // Build the tree
    items.forEach((item) => {
      const node = map.get(item.id)!;
      if (item.parent_id) {
        const parent = map.get(item.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  return {
    ...rest,
    data: buildTree(categories as CategoryWithStats[]),
    flatData: categories,
  };
}

/**
 * Hook to fetch a single category by ID
 */
export function useCategory(id: string | undefined) {
  return useQuery({
    queryKey: ['knowledge-category', id],
    queryFn: async () => {
      if (!id) throw new Error('Category ID is required');

      const { data, error } = await supabase
        .from('knowledge_categories')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as KnowledgeCategory;
    },
    enabled: !!id,
  });
}

/**
 * Hook to fetch a category by slug
 */
export function useCategoryBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['knowledge-category-slug', slug],
    queryFn: async () => {
      if (!slug) throw new Error('Category slug is required');

      const { data, error } = await supabase
        .from('knowledge_categories')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      return data as KnowledgeCategory;
    },
    enabled: !!slug,
  });
}

/**
 * Hook to create a new category
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (category: KnowledgeCategoryInsert) => {
      const { data, error } = await supabase
        .from('knowledge_categories')
        .insert(category)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-categories'] });
      toast.success('Category created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create category: ${error.message}`);
    },
  });
}

/**
 * Hook to update a category
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: KnowledgeCategoryUpdate;
    }) => {
      const { data, error } = await supabase
        .from('knowledge_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-categories'] });
      queryClient.invalidateQueries({
        queryKey: ['knowledge-category', variables.id],
      });
      toast.success('Category updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update category: ${error.message}`);
    },
  });
}

/**
 * Hook to delete a category
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First check if category has entries
      const { count } = await supabase
        .from('knowledge_entries')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', id);

      if (count && count > 0) {
        throw new Error(
          `Cannot delete category with ${count} entries. Please reassign or delete the entries first.`
        );
      }

      // Check if category has children
      const { count: childCount } = await supabase
        .from('knowledge_categories')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', id);

      if (childCount && childCount > 0) {
        throw new Error(
          `Cannot delete category with ${childCount} subcategories. Please delete or reassign subcategories first.`
        );
      }

      const { error } = await supabase
        .from('knowledge_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-categories'] });
      toast.success('Category deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete category: ${error.message}`);
    },
  });
}

/**
 * Hook to reorder categories (update sort_order)
 */
export function useReorderCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Array<{ id: string; sort_order: number }>) => {
      const promises = updates.map(({ id, sort_order }) =>
        supabase
          .from('knowledge_categories')
          .update({ sort_order })
          .eq('id', id)
      );

      const results = await Promise.all(promises);
      const error = results.find((r) => r.error)?.error;
      if (error) throw error;

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-categories'] });
      toast.success('Categories reordered successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reorder categories: ${error.message}`);
    },
  });
}

/**
 * Hook to get category statistics
 */
export function useCategoryStats(categoryId: string | undefined) {
  return useQuery({
    queryKey: ['knowledge-category-stats', categoryId],
    queryFn: async () => {
      if (!categoryId) throw new Error('Category ID is required');

      const { data: entries } = await supabase
        .from('knowledge_entries')
        .select('status, view_count, updated_at')
        .eq('category_id', categoryId);

      const stats: CategoryStats = {
        entry_count: entries?.length || 0,
        published_count: entries?.filter((e) => e.status === 'published').length || 0,
        draft_count: entries?.filter((e) => e.status === 'draft').length || 0,
        total_views: entries?.reduce((sum, e) => sum + (e.view_count || 0), 0) || 0,
        last_updated: entries?.length
          ? entries.sort((a, b) => 
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            )[0]?.updated_at
          : null,
      };

      return stats;
    },
    enabled: !!categoryId,
  });
}

/**
 * Hook to get embedding statistics across all knowledge entries
 * Note: embedding_status column doesn't exist yet, using embeddings table instead
 */
export function useEmbeddingStats() {
  return useQuery({
    queryKey: ['knowledge-embedding-stats'],
    queryFn: async () => {
      // Count published entries
      const { data: entries, error } = await supabase
        .from('knowledge_entries')
        .select('id')
        .eq('status', 'published');

      if (error) throw error;

      // Count entries with embeddings
      const { data: embeddings } = await supabase
        .from('embeddings')
        .select('entity_id')
        .eq('entity_type', 'knowledge_entry');

      const entryIdsWithEmbeddings = new Set(embeddings?.map((e) => e.entity_id) || []);
      const totalChunks = embeddings?.length || 0;

      const stats = {
        total: entries?.length || 0,
        pending: 0,
        processing: 0,
        completed: entries?.filter((e) => entryIdsWithEmbeddings.has(e.id)).length || 0,
        failed: 0,
        totalChunks,
      };

      return stats;
    },
  });
}
