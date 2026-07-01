/**
 * Calendar Meetings Hook (meetings table)
 *
 * Fetches meetings for a month range and returns a map of local date (yyyy-MM-dd)
 * to meetings array for calendar view.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cacheConfig } from "@/lib/cache";
import { parseMeetingDate, isMeetingDateValid } from "@/lib/date-utils";
import type { MeetingV2Schedule } from "../types/meetings";

const MEETINGS_V2_KEY = "meetings-v2";
const db = supabase as any;

/**
 * Fetch meetings for a given month and return a map of date string (yyyy-MM-dd)
 * to meetings array, using local time for grouping.
 */
export function useCalendarMeetingsV2(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  return useQuery({
    queryKey: [MEETINGS_V2_KEY, "calendar", year, month],
    queryFn: async (): Promise<Record<string, MeetingV2Schedule[]>> => {
      const { data, error } = await db
        .from("meetings")
        .select("*")
        .gte("scheduled_at", startIso)
        .lte("scheduled_at", endIso)
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      const list = (data || []) as MeetingV2Schedule[];

      const byDate: Record<string, MeetingV2Schedule[]> = {};
      list.forEach((m) => {
        if (!m.scheduled_at) return;
        const d = parseMeetingDate(m.scheduled_at);
        if (!isMeetingDateValid(d)) return;
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (!byDate[dateKey]) byDate[dateKey] = [];
        byDate[dateKey].push(m);
      });
      return byDate;
    },
    enabled: !!year && !!month,
    staleTime: cacheConfig.staleTime.short,
  });
}

/**
 * Legacy: fetch meetings within a date range.
 */
export function useCalendarMeetings(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["calendar-meetings", startDate, endDate],
    queryFn: async (): Promise<MeetingV2Schedule[]> => {
      const { data, error } = await db
        .from("meetings")
        .select("*")
        .gte("scheduled_at", startDate)
        .lte("scheduled_at", endDate)
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return (data || []) as MeetingV2Schedule[];
    },
    enabled: !!startDate && !!endDate,
  });
}

/**
 * Convenience: fetch meetings for a given month (returns list, not map).
 */
export function useMeetingsForMonth(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
  return useCalendarMeetings(startDate, endDate);
}
