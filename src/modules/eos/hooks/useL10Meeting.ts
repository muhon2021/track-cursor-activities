/**
 * Level 10 meeting sections hook.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys, cacheConfig, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";
import type { EOSL10Section, L10SectionKey } from "../types";

const DEFAULT_DURATIONS: Record<L10SectionKey, number> = {
  segue: 5,
  scorecard_review: 5,
  rock_review: 5,
  customer_headlines: 5,
  employee_headlines: 5,
  todo_review: 5,
  ids: 60,
  conclusion: 5,
};

const ALL_SECTIONS: L10SectionKey[] = [
  "segue",
  "scorecard_review",
  "rock_review",
  "customer_headlines",
  "employee_headlines",
  "todo_review",
  "ids",
  "conclusion",
];

export function useL10Sections(meetingId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.eos.l10Sections(meetingId || ""),
    queryFn: async (): Promise<EOSL10Section[]> => {
      const { data, error } = await supabase
        .from("eos_l10_meeting_sections")
        .select("*")
        .eq("meeting_id", meetingId!)
        .order("created_at");

      if (error) throw error;

      if (!data?.length) {
        const rows = ALL_SECTIONS.map((key) => ({
          meeting_id: meetingId!,
          section_key: key,
          duration_minutes: DEFAULT_DURATIONS[key],
        }));
        const { data: inserted, error: insertErr } = await supabase
          .from("eos_l10_meeting_sections")
          .insert(rows)
          .select();
        if (insertErr) throw insertErr;
        return (inserted || []) as EOSL10Section[];
      }

      return data as EOSL10Section[];
    },
    enabled: !!user && !!meetingId,
    staleTime: cacheConfig.staleTime.short,
  });
}

export function useUpdateL10Section() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      meetingId: string;
      notes?: string;
      started_at?: string | null;
      completed_at?: string | null;
    }) => {
      const updates: Record<string, unknown> = {};
      if (input.notes !== undefined) updates.notes = input.notes;
      if (input.started_at !== undefined) updates.started_at = input.started_at;
      if (input.completed_at !== undefined) updates.completed_at = input.completed_at;

      const { error } = await supabase
        .from("eos_l10_meeting_sections")
        .update(updates)
        .eq("id", input.id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.eos.l10Sections(vars.meetingId) });
    },
  });
}

export function useSaveL10TimerState() {
  return useMutation({
    mutationFn: async ({
      meetingId,
      timerState,
    }: {
      meetingId: string;
      timerState: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from("meetings")
        .update({ l10_timer_state: timerState as never })
        .eq("id", meetingId);
      if (error) throw error;
    },
  });
}

export function useCreateL10Todo() {
  const createTodo = useMutation({
    mutationFn: async (input: {
      title: string;
      meetingId: string;
      assigned_to?: string;
      due_date?: string;
    }) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: input.title,
          status: "todo",
          eos_source_type: "meeting",
          eos_source_id: input.meetingId,
          assigned_to: input.assigned_to,
          due_date: input.due_date,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success("Action item created"),
    onError: (e: Error) => toast.error("Failed to create action item", { description: e.message }),
  });

  return createTodo;
}
