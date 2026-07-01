/**
 * Meeting Efficiency Hook
 *
 * Computes efficiency metrics across meetings:
 * - Average duration, attendance rate, takeaway density
 * - Agenda completion rate
 * - Meetings with/without agendas and takeaways
 * - Efficiency score per meeting
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MeetingEfficiencyData {
  totalMeetings: number;
  avgDuration: number;
  avgParticipants: number;
  avgTakeaways: number;
  withAgenda: number;
  withTakeaways: number;
  agendaRate: number;
  takeawayRate: number;
  avgEfficiencyScore: number;
  byMonth: { month: string; meetings: number; avgDuration: number; avgEfficiency: number }[];
}

export function useMeetingEfficiency(days: number = 90) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["meeting-efficiency", days],
    queryFn: async (): Promise<MeetingEfficiencyData> => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const [meetingsRes, agendaRes, takeawaysRes, participantsRes] = await Promise.all([
        (supabase as any)
          .from("meetings")
          .select("id, title, duration_minutes, created_at, metadata")
          .gte("created_at", fromDate.toISOString()),
        (supabase as any)
          .from("meeting_agenda_items")
          .select("id, meeting_id, is_completed"),
        (supabase as any)
          .from("meeting_takeaways")
          .select("id, meeting_id"),
        (supabase as any)
          .from("meeting_participants")
          .select("id, meeting_id, attended"),
      ]);

      const meetings = (meetingsRes.data || []) as any[];
      const agendaItems = (agendaRes.data || []) as any[];
      const takeaways = (takeawaysRes.data || []) as any[];
      const participants = (participantsRes.data || []) as any[];

      if (meetings.length === 0) {
        return {
          totalMeetings: 0,
          avgDuration: 0,
          avgParticipants: 0,
          avgTakeaways: 0,
          withAgenda: 0,
          withTakeaways: 0,
          agendaRate: 0,
          takeawayRate: 0,
          avgEfficiencyScore: 0,
          byMonth: [],
        };
      }

      // Build maps
      const meetingIds = new Set(meetings.map((m: any) => m.id));
      const agendaByMeeting = new Map<string, any[]>();
      const takeawaysByMeeting = new Map<string, any[]>();
      const participantsByMeeting = new Map<string, any[]>();

      for (const a of agendaItems) {
        if (!meetingIds.has(a.meeting_id)) continue;
        const list = agendaByMeeting.get(a.meeting_id) || [];
        list.push(a);
        agendaByMeeting.set(a.meeting_id, list);
      }

      for (const t of takeaways) {
        if (!meetingIds.has(t.meeting_id)) continue;
        const list = takeawaysByMeeting.get(t.meeting_id) || [];
        list.push(t);
        takeawaysByMeeting.set(t.meeting_id, list);
      }

      for (const p of participants) {
        if (!meetingIds.has(p.meeting_id)) continue;
        const list = participantsByMeeting.get(p.meeting_id) || [];
        list.push(p);
        participantsByMeeting.set(p.meeting_id, list);
      }

      // Compute per-meeting metrics
      let totalDuration = 0;
      let totalParticipants = 0;
      let totalTakeaways = 0;
      let withAgenda = 0;
      let withTakeaways = 0;
      let totalEfficiency = 0;

      const monthMap = new Map<string, { meetings: number; totalDuration: number; totalEfficiency: number }>();

      for (const meeting of meetings) {
        const duration = meeting.duration_minutes || 30;
        totalDuration += duration;

        const mAgenda = agendaByMeeting.get(meeting.id) || [];
        const mTakeaways = takeawaysByMeeting.get(meeting.id) || [];
        const mParticipants = participantsByMeeting.get(meeting.id) || [];

        const attended = mParticipants.filter((p: any) => p.attended).length;
        totalParticipants += attended || mParticipants.length;
        totalTakeaways += mTakeaways.length;

        if (mAgenda.length > 0) withAgenda++;
        if (mTakeaways.length > 0) withTakeaways++;

        // Efficiency score: weighted composite
        const hasAgenda = mAgenda.length > 0 ? 25 : 0;
        const hasTakeaways = mTakeaways.length > 0 ? 25 : 0;
        const durationScore = duration <= 60 ? 25 : duration <= 90 ? 15 : 5;
        const attendanceScore = mParticipants.length > 0
          ? Math.round((attended / mParticipants.length) * 25)
          : 25;

        const efficiency = hasAgenda + hasTakeaways + durationScore + attendanceScore;
        totalEfficiency += efficiency;

        // Monthly aggregation
        const dateStr = meeting.created_at;
        const month = new Date(dateStr).toLocaleString("default", { month: "short", year: "2-digit" });
        const entry = monthMap.get(month) || { meetings: 0, totalDuration: 0, totalEfficiency: 0 };
        entry.meetings++;
        entry.totalDuration += duration;
        entry.totalEfficiency += efficiency;
        monthMap.set(month, entry);
      }

      const totalMeetings = meetings.length;

      const byMonth = Array.from(monthMap.entries())
        .map(([month, data]) => ({
          month,
          meetings: data.meetings,
          avgDuration: Math.round(data.totalDuration / data.meetings),
          avgEfficiency: Math.round(data.totalEfficiency / data.meetings),
        }))
        .reverse();

      return {
        totalMeetings,
        avgDuration: Math.round(totalDuration / totalMeetings),
        avgParticipants: Math.round(totalParticipants / totalMeetings),
        avgTakeaways: +(totalTakeaways / totalMeetings).toFixed(1),
        withAgenda,
        withTakeaways,
        agendaRate: Math.round((withAgenda / totalMeetings) * 100),
        takeawayRate: Math.round((withTakeaways / totalMeetings) * 100),
        avgEfficiencyScore: Math.round(totalEfficiency / totalMeetings),
        byMonth,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}
