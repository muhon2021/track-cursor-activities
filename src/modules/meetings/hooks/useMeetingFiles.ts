/**
 * Meeting Files Hook - Query/update meeting_files (transcripts)
 * 
 * Provides hooks for listing, fetching, and updating meeting_files table
 * which stores Zoom-synced recordings and transcripts.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { MeetingFile } from "../types/meetings";

const MEETING_FILES_KEY = "meeting-files";

export interface MeetingFilesFilters {
  search?: string;
  category?: string;
  verification_status?: string;
  categorization_status?: string;
  embedding_status?: string;
  project_id?: string;
  client_id?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Fetch meeting files (transcripts) with filters and pagination
 */
export function useMeetingFiles(filters?: MeetingFilesFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [MEETING_FILES_KEY, "list", filters],
    queryFn: async (): Promise<{ data: MeetingFile[]; totalCount: number }> => {
      let query = (supabase as any)
        .from("meeting_files")
        .select("*", { count: "exact" })
        .is("deleted_at", null)
        .order("meeting_start_time", { ascending: false });

      // Search filter
      if (filters?.search) {
        query = query.or(
          `meeting_topic.ilike.%${filters.search}%,transcript_text.ilike.%${filters.search}%`
        );
      }

      // Category filter
      if (filters?.category) {
        query = query.eq("meeting_category", filters.category);
      }

      // Verification status filter
      if (filters?.verification_status) {
        query = query.eq("assignment_status", filters.verification_status);
      }

      // Categorization status filter
      if (filters?.categorization_status) {
        query = query.eq("categorization_status", filters.categorization_status);
      }

      // Embedding status filter
      if (filters?.embedding_status) {
        query = query.eq("embedding_status", filters.embedding_status);
      }

      // Project filter
      if (filters?.project_id) {
        query = query.eq("project_id", filters.project_id);
      }

      // Client filter
      if (filters?.client_id) {
        query = query.eq("client_id", filters.client_id);
      }

      // Pagination
      const page = filters?.page ?? 0;
      const pageSize = filters?.pageSize ?? 25;
      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        data: (data || []) as MeetingFile[],
        totalCount: count ?? 0,
      };
    },
    enabled: !!user,
  });
}

/**
 * Fetch a single meeting file by slug
 */
export function useMeetingFile(slug: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [MEETING_FILES_KEY, "detail", slug],
    queryFn: async (): Promise<MeetingFile | null> => {
      if (!slug) return null;

      const { data, error } = await (supabase as any)
        .from("meeting_files")
        .select("*")
        .eq("slug", slug)
        .is("deleted_at", null)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }
      return data as MeetingFile;
    },
    enabled: !!user && !!slug,
  });
}

/**
 * Update a meeting file (for assignment, categorization, etc.)
 */
export function useUpdateMeetingFile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<MeetingFile>;
    }): Promise<MeetingFile> => {
      if (!user) throw new Error("User not authenticated");

      const { data: file, error } = await (supabase as any)
        .from("meeting_files")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return file as MeetingFile;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [MEETING_FILES_KEY] });
      queryClient.invalidateQueries({ queryKey: [MEETING_FILES_KEY, "detail", variables.id] });
      toast.success("Transcript updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update transcript: ${error.message}`);
    },
  });
}

/**
 * Get KPI stats for meeting files
 */
export function useMeetingFilesStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [MEETING_FILES_KEY, "stats"],
    queryFn: async () => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      // Total count
      const { count: total } = await (supabase as any)
        .from("meeting_files")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null);

      // This week count
      const { count: thisWeek } = await (supabase as any)
        .from("meeting_files")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("meeting_start_time", weekStart.toISOString());

      // Categorized count
      const { count: categorized } = await (supabase as any)
        .from("meeting_files")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .not("meeting_category", "is", null);

      // Verified count
      const { count: verified } = await (supabase as any)
        .from("meeting_files")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("assignment_status", "verified");

      // Matched to project count
      const { count: matchedToProject } = await (supabase as any)
        .from("meeting_files")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .not("project_id", "is", null);

      // Embeddings complete count
      const { count: embeddingsComplete } = await (supabase as any)
        .from("meeting_files")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("embedding_status", "completed");

      return {
        total: total ?? 0,
        thisWeek: thisWeek ?? 0,
        categorized: categorized ?? 0,
        verified: verified ?? 0,
        matchedToProject: matchedToProject ?? 0,
        embeddingsComplete: embeddingsComplete ?? 0,
      };
    },
    enabled: !!user,
  });
}

