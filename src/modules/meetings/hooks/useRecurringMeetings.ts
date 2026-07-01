/**
 * Recurring Meetings Hook
 *
 * CRUD operations for meeting series definitions.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { MeetingSeries, SeriesFormData } from "../types";

const SERIES_KEY = "meeting-series";

/**
 * Fetch all active meeting series.
 */
export function useMeetingSeries() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [SERIES_KEY],
    queryFn: async (): Promise<MeetingSeries[]> => {
      const { data, error } = await supabase
        .from("meeting_series")
        .select("*")
        .eq("is_active", true)
        .order("title", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as MeetingSeries[];
    },
    enabled: !!user,
  });
}

/**
 * Fetch a single series by ID.
 */
export function useMeetingSeriesDetail(id: string) {
  return useQuery({
    queryKey: [SERIES_KEY, id],
    queryFn: async (): Promise<MeetingSeries> => {
      const { data, error } = await supabase
        .from("meeting_series")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as unknown as MeetingSeries;
    },
    enabled: !!id,
  });
}

/**
 * Fetch meetings belonging to a series.
 */
export function useSeriesMeetings(seriesId: string) {
  return useQuery({
    queryKey: [SERIES_KEY, seriesId, "meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, title, scheduled_at, status, duration_minutes")
        .eq("series_id", seriesId)
        .order("scheduled_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!seriesId,
  });
}

/**
 * Create a new meeting series.
 */
export function useCreateSeries() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (formData: SeriesFormData) => {
      const { data: series, error } = await supabase
        .from("meeting_series")
        .insert([{
          title: formData.title,
          description: formData.description || null,
          recurrence_rule: formData.recurrence_rule,
          duration_minutes: formData.duration_minutes,
          default_agenda: JSON.parse(JSON.stringify(formData.default_agenda || [])),
          organizer_id: user?.id!,
        }])
        .select()
        .single();

      if (error) throw error;
      return series;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERIES_KEY] });
      toast.success("Meeting series created");
    },
    onError: (error: Error) => {
      toast.error("Failed to create series", { description: error.message });
    },
  });
}

/**
 * Update a meeting series.
 */
export function useUpdateSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SeriesFormData> }) => {
      const updateData: Record<string, unknown> = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.recurrence_rule !== undefined) updateData.recurrence_rule = data.recurrence_rule;
      if (data.duration_minutes !== undefined) updateData.duration_minutes = data.duration_minutes;
      if (data.default_agenda !== undefined) updateData.default_agenda = JSON.parse(JSON.stringify(data.default_agenda));

      const { data: series, error } = await supabase
        .from("meeting_series")
        .update(updateData as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return series;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERIES_KEY] });
      toast.success("Series updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update series", { description: error.message });
    },
  });
}

/**
 * Archive (deactivate) a meeting series.
 */
export function useArchiveSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("meeting_series")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERIES_KEY] });
      toast.success("Series archived");
    },
    onError: (error: Error) => {
      toast.error("Failed to archive series", { description: error.message });
    },
  });
}
