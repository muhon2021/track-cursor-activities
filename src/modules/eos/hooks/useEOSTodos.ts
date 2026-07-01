/**
 * EOS Todos — tasks linked to meetings, IDS, or rocks.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys, cacheConfig, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";
import { logCrud } from "@/lib/activity-logger";
import type { EOSTodo, EOSTodoSourceType } from "../types";

export interface EOSTodoFilters {
  status?: "open" | "completed" | "all";
  sourceType?: EOSTodoSourceType | "all";
  ownerId?: string;
  search?: string;
}

export function useEOSTodos(filters: EOSTodoFilters = {}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.eos.todos(filters as unknown as Record<string, unknown>),
    queryFn: async (): Promise<EOSTodo[]> => {
      let query = supabase
        .from("tasks")
        .select("id, title, status, due_date, priority, assigned_to, eos_source_type, eos_source_id, created_at")
        .not("eos_source_type", "is", null)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status === "completed" ? "done" : "todo");
      }
      if (filters.sourceType && filters.sourceType !== "all") {
        query = query.eq("eos_source_type", filters.sourceType);
      }
      if (filters.ownerId) {
        query = query.eq("assigned_to", filters.ownerId);
      }
      if (filters.search) {
        query = query.ilike("title", `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const tasks = data || [];
      const userIds = [...new Set(tasks.map((t) => t.assigned_to).filter(Boolean))];
      const profiles: Record<string, { full_name: string; email: string }> = {};

      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        for (const p of profs || []) {
          profiles[p.id] = { full_name: p.full_name, email: p.email };
        }
      }

      return tasks.map((t) => ({
        ...t,
        assignee: t.assigned_to ? profiles[t.assigned_to] : null,
      })) as EOSTodo[];
    },
    enabled: !!user,
    staleTime: cacheConfig.staleTime.short,
  });
}

export function useCreateEOSTodo() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      assigned_to?: string;
      due_date?: string;
      priority?: string;
      eos_source_type: EOSTodoSourceType;
      eos_source_id: string;
    }) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: input.title,
          status: "todo",
          assigned_to: input.assigned_to || user!.id,
          due_date: input.due_date,
          priority: input.priority || "medium",
          eos_source_type: input.eos_source_type,
          eos_source_id: input.eos_source_id,
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      invalidateKeys.eos(queryClient);
      invalidateKeys.tasks(queryClient);
      logCrud("create", "task", data.id, { eos: true });
      toast.success("EOS todo created");
    },
    onError: (e: Error) => toast.error("Failed to create todo", { description: e.message }),
  });
}

export function useUpdateEOSTodoStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "todo" | "done" }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.eos(queryClient);
      invalidateKeys.tasks(queryClient);
    },
  });
}
