/**
 * Processes Hook - Process documentation CRUD
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { ProcessCategory, ProcessDocument } from "../types";

const PROCESSES_KEY = "processes";

export function useProcessCategories() {
  return useQuery({
    queryKey: [PROCESSES_KEY, "categories"],
    queryFn: async (): Promise<ProcessCategory[]> => {
      const { data: categories, error } = await supabase
        .from("process_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;

      // Get document counts
      const { data: docs } = await supabase
        .from("process_documents")
        .select("category_id")
        .eq("status", "published");

      const countMap = new Map<string, number>();
      (docs || []).forEach((d: any) => {
        countMap.set(d.category_id, (countMap.get(d.category_id) || 0) + 1);
      });

      return (categories || []).map((c: any) => ({
        ...c,
        document_count: countMap.get(c.id) || 0,
      })) as ProcessCategory[];
    },
  });
}

export function useProcessDocuments(categorySlug?: string) {
  return useQuery({
    queryKey: [PROCESSES_KEY, "documents", categorySlug],
    queryFn: async (): Promise<ProcessDocument[]> => {
      let query = supabase
        .from("process_documents")
        .select("*")
        .eq("status", "published")
        .order("title");

      if (categorySlug) {
        const { data: cat } = await supabase
          .from("process_categories")
          .select("id")
          .eq("slug", categorySlug)
          .single();
        if (cat) query = query.eq("category_id", cat.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ProcessDocument[];
    },
  });
}

export function useProcessDocument(categorySlug: string, docSlug: string) {
  return useQuery({
    queryKey: [PROCESSES_KEY, "document", categorySlug, docSlug],
    queryFn: async (): Promise<ProcessDocument | null> => {
      const { data: cat } = await supabase
        .from("process_categories")
        .select("id")
        .eq("slug", categorySlug)
        .single();

      if (!cat) return null;

      const { data, error } = await supabase
        .from("process_documents")
        .select("*")
        .eq("category_id", cat.id)
        .eq("slug", docSlug)
        .single();
      if (error) throw error;
      return data as unknown as ProcessDocument;
    },
    enabled: !!categorySlug && !!docSlug,
  });
}

export function useCreateProcessDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: { category_id: string; title: string; content?: string; tags?: string[] }) => {
      const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { data: doc, error } = await supabase.from("process_documents").insert({
        category_id: data.category_id,
        title: data.title,
        slug: `${slug}-${Date.now().toString(36)}`,
        content: data.content || null,
        tags: data.tags || [],
        status: "published",
        created_by: user?.id || null,
        published_at: new Date().toISOString(),
      }).select().single();
      if (error) throw error;
      return doc;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [PROCESSES_KEY] }); toast.success("Document created"); },
    onError: (error: Error) => toast.error("Failed to create document", { description: error.message }),
  });
}

export function useUpdateProcessDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { title?: string; content?: string; tags?: string[]; category_id?: string } }) => {
      const { error } = await supabase.from("process_documents").update({
        ...data,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [PROCESSES_KEY] }); toast.success("Document updated"); },
    onError: (error: Error) => toast.error("Failed to update document", { description: error.message }),
  });
}

export function useDeleteProcessDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("process_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [PROCESSES_KEY] }); toast.success("Document deleted"); },
    onError: (error: Error) => toast.error("Failed to delete document", { description: error.message }),
  });
}
