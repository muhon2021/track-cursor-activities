import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, invalidateKeys, cacheConfig } from "@/lib/cache";
import { toast } from "sonner";

export interface PromptTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  template_content: string;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface PromptTemplateFormData {
  name: string;
  slug: string;
  description: string;
  category: string;
  template_content: string;
  is_active?: boolean;
}

const db = supabase as any;

export function usePromptTemplates() {
  return useQuery({
    queryKey: queryKeys.ai.promptTemplates,
    queryFn: async () => {
      const { data, error } = await db
        .from("prompt_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PromptTemplate[];
    },
    staleTime: cacheConfig.staleTime.medium,
  });
}

export function usePromptTemplateStats(templates: PromptTemplate[] | undefined) {
  const total = templates?.length ?? 0;
  const active = templates?.filter((t) => t.is_active).length ?? 0;
  const totalUsage = templates?.reduce((sum, t) => sum + (t.usage_count ?? 0), 0) ?? 0;
  const categories = new Set(templates?.map((t) => t.category) ?? []).size;
  return { total, active, totalUsage, categories };
}

export function useCreatePromptTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PromptTemplateFormData) => {
      const { data: row, error } = await db
        .from("prompt_templates")
        .insert({
          name: data.name,
          slug: data.slug || data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
          description: data.description || null,
          category: data.category,
          template_content: data.template_content,
          is_active: data.is_active ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return row as PromptTemplate;
    },
    onSuccess: () => {
      invalidateKeys.promptTemplates(queryClient);
      toast.success("Template created.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create template.");
    },
  });
}

export function useUpdatePromptTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<PromptTemplateFormData>;
    }) => {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (data.name != null) payload.name = data.name;
      if (data.slug != null) payload.slug = data.slug;
      if (data.description != null) payload.description = data.description;
      if (data.category != null) payload.category = data.category;
      if (data.template_content != null) payload.template_content = data.template_content;
      if (data.is_active != null) payload.is_active = data.is_active;

      const { data: row, error } = await db
        .from("prompt_templates")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return row as PromptTemplate;
    },
    onSuccess: () => {
      invalidateKeys.promptTemplates(queryClient);
      toast.success("Template updated.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update template.");
    },
  });
}

export function useDeletePromptTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("prompt_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.promptTemplates(queryClient);
      toast.success("Template deleted.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete template.");
    },
  });
}

export function useDuplicatePromptTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (template: PromptTemplate) => {
      const baseSlug = template.slug.replace(/-copy(-\d+)?$/, "") + "-copy";
      const { data: existing } = await db
        .from("prompt_templates")
        .select("slug")
        .ilike("slug", `${baseSlug}%`);
      const slugs = new Set((existing ?? []).map((r: any) => r.slug));
      let slug = baseSlug;
      let n = 1;
      while (slugs.has(slug)) {
        slug = `${baseSlug}-${n}`;
        n++;
      }
      const { data: row, error } = await db
        .from("prompt_templates")
        .insert({
          name: `${template.name} (Copy)`,
          slug,
          description: template.description,
          category: template.category,
          template_content: template.template_content,
          is_active: template.is_active,
          usage_count: 0,
        })
        .select()
        .single();
      if (error) throw error;
      return row as PromptTemplate;
    },
    onSuccess: () => {
      invalidateKeys.promptTemplates(queryClient);
      toast.success("Template duplicated.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to duplicate template.");
    },
  });
}
