/**
 * Meetings V2 Hook - CRUD for meetings table
 *
 * List with tab filters (today/upcoming/open/past), search, type, "my meetings only".
 * Single meeting by id or slug. Create/update/delete with cache invalidation.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { sanitizeSearchInput } from "@/lib/sanitize";
import { cacheConfig } from "@/lib/cache";
import type { MeetingV2Schedule, MeetingV2FormData, MeetingType } from "../types/meetings";

export type { MeetingType };
export type MeetingStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

const MEETINGS_V2_KEY = "meetings-v2";
const LIST_LIMIT = 200;

export interface MeetingsV2Filters {
  tab?: "today" | "upcoming" | "open" | "past";
  type?: MeetingType | "all";
  search?: string;
  my_meetings_only?: boolean;
  client_id?: string;
  project_id?: string;
  deal_id?: string;
  date_from?: string;
  date_to?: string;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfTomorrow(): Date {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return startOfDay(t);
}

const db = supabase as any;

/**
 * Fetch meeting IDs where the user is a participant (for "my meetings" filter).
 */
async function getParticipantMeetingIds(userId: string): Promise<string[]> {
  const { data, error } = await db
    .from("meeting_participants")
    .select("meeting_id")
    .eq("user_id", userId);
  if (error) return [];
  return (data || []).map((r: any) => r.meeting_id);
}

/**
 * Fetch meetings with filters and optional participant filter.
 */
export function useMeetingsV2(filters?: MeetingsV2Filters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [MEETINGS_V2_KEY, "list", filters],
    queryFn: async (): Promise<MeetingV2Schedule[]> => {
      let query = db
        .from("meetings")
        .select("*")
        .order("scheduled_at", { ascending: true })
        .limit(LIST_LIMIT);

      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const todayEnd = endOfDay(now).toISOString();
      const tomorrowStart = startOfTomorrow().toISOString();

      if (filters?.tab) {
        switch (filters.tab) {
          case "today":
            query = query
              .gte("scheduled_at", todayStart)
              .lte("scheduled_at", todayEnd);
            break;
          case "upcoming":
            query = query
              .gte("scheduled_at", tomorrowStart)
              .neq("status", "cancelled");
            break;
          case "open":
            query = query
              .lt("scheduled_at", todayStart)
              .in("status", ["scheduled", "in_progress"]);
            break;
          case "past":
            query = query.lt("scheduled_at", todayStart);
            query = query.in("status", ["completed", "cancelled"]);
            break;
        }
      }

      if (filters?.type && filters.type !== "all") {
        query = query.eq("meeting_type", filters.type);
      }

      if (filters?.search?.trim()) {
        const safe = sanitizeSearchInput(filters.search.trim());
        const term = `%${safe}%`;
        query = query.or(
          `title.ilike.${term},description.ilike.${term},notes.ilike.${term}`
        );
      }

      if (filters?.client_id) {
        query = query.eq("client_id", filters.client_id);
      }
      // meetings table has no project_id column; filter not applied
      if (filters?.deal_id) {
        query = query.eq("deal_id", filters.deal_id);
      }
      if (filters?.date_from) {
        query = query.gte("scheduled_at", filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte("scheduled_at", filters.date_to);
      }

      if (filters?.my_meetings_only && user?.id) {
        const participantIds = await getParticipantMeetingIds(user.id);
        if (participantIds.length > 0) {
          query = query.or(
            `organizer_id.eq.${user.id},id.in.(${participantIds.join(",")})`
          );
        } else {
          query = query.eq("organizer_id", user.id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MeetingV2Schedule[];
    },
    enabled: !!user,
    staleTime: cacheConfig.staleTime.short,
  });
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Fetch a single meeting by ID or slug.
 */
export function useMeetingV2(idOrSlug: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [MEETINGS_V2_KEY, "detail", idOrSlug],
    queryFn: async (): Promise<MeetingV2Schedule | null> => {
      if (!idOrSlug) return null;

      const isUuid = UUID_REGEX.test(idOrSlug);
      const { data, error } = await db
        .from("meetings")
        .select("*")
        .match(isUuid ? { id: idOrSlug } : { slug: idOrSlug })
        .maybeSingle();

      if (error) throw error;
      return data as MeetingV2Schedule | null;
    },
    enabled: !!user && !!idOrSlug,
    staleTime: cacheConfig.staleTime.short,
  });
}

/**
 * Create a new meeting.
 */
export function useCreateMeetingV2() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: MeetingV2FormData): Promise<MeetingV2Schedule> => {
      if (!user) throw new Error("User not authenticated");

      const slug =
        data.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || null;

      // meetings table has no project_id or notify_participants columns; omit from insert
      const row = {
        title: data.title,
        meeting_type: data.meeting_type || "internal",
        description: data.description || null,
        scheduled_at: data.scheduled_at,
        duration_minutes: data.duration_minutes ?? 60,
        location: data.location || null,
        timezone: data.timezone || null,
        status: (data.status as MeetingStatus) || "scheduled",
        notes: data.notes || null,
        client_id: data.client_id || null,
        deal_id: data.deal_id || null,
        recurrence_pattern: data.recurrence_pattern || null,
        recurrence_end_date: data.recurrence_end_date || null,
        parent_meeting_id: data.parent_meeting_id || null,
        organizer_id: user.id,
        slug: slug || null,
      };

      const { data: meeting, error } = await db
        .from("meetings")
        .insert(row)
        .select()
        .single();

      if (error) throw error;
      return meeting as MeetingV2Schedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MEETINGS_V2_KEY] });
      toast.success("Meeting created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create meeting");
    },
  });
}

/**
 * Update an existing meeting.
 */
export function useUpdateMeetingV2() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<MeetingV2FormData>;
    }): Promise<MeetingV2Schedule> => {
      if (!user) throw new Error("User not authenticated");

      const updatePayload: Record<string, unknown> = { ...data };
      if (data.title) {
        updatePayload.slug =
          data.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || null;
      }
      // meetings table has no project_id or notify_participants columns
      delete updatePayload.project_id;
      delete updatePayload.notify_participants;

      const { data: meeting, error } = await db
        .from("meetings")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      if (!meeting) throw new Error("Meeting not found or access denied");
      return meeting as MeetingV2Schedule;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [MEETINGS_V2_KEY] });
      queryClient.invalidateQueries({
        queryKey: [MEETINGS_V2_KEY, "detail", variables.id],
      });
      toast.success("Meeting updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update meeting");
    },
  });
}

/**
 * Delete a meeting.
 */
export function useDeleteMeetingV2() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (!user) throw new Error("User not authenticated");

      const { error } = await db.from("meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MEETINGS_V2_KEY] });
      toast.success("Meeting deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete meeting");
    },
  });
}

/**
 * Mark a meeting as completed.
 */
export function useCloseMeetingV2() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string): Promise<MeetingV2Schedule> => {
      if (!user) throw new Error("User not authenticated");

      const { data: meeting, error } = await db
        .from("meetings")
        .update({ status: "completed" })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      if (!meeting) throw new Error("Meeting not found or access denied");
      return meeting as MeetingV2Schedule;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [MEETINGS_V2_KEY] });
      queryClient.invalidateQueries({ queryKey: [MEETINGS_V2_KEY, "detail", id] });
      toast.success("Meeting marked as completed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to close meeting");
    },
  });
}
