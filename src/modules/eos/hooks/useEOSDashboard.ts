/**
 * EOS Dashboard aggregate data hook.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys, cacheConfig } from "@/lib/cache";
import type { EOSDashboardData, RockStatus } from "../types";

export function useEOSDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.eos.dashboard(),
    queryFn: async (): Promise<EOSDashboardData> => {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [okrsRes, issuesRes, metricsRes, meetingsRes] = await Promise.all([
        supabase.from("okrs").select("id, rock_status, okr_type, status, progress_pct, okr_type, year, quarter"),
        supabase.from("eos_issues").select("id, status"),
        supabase.from("eos_scorecard_metrics").select("id, status"),
        supabase
          .from("meetings")
          .select("id, scheduled_at, meeting_type, status")
          .eq("meeting_type", "l10"),
      ]);

      if (okrsRes.error) throw okrsRes.error;
      if (issuesRes.error) throw issuesRes.error;

      const okrs = okrsRes.data || [];
      const issues = issuesRes.data || [];
      const metrics = metricsRes.data || [];
      const meetings = meetingsRes.data || [];

      const rocksSummary: Record<RockStatus, number> = {
        on_track: 0,
        at_risk: 0,
        off_track: 0,
        completed: 0,
      };

      let annualGoals = 0;
      let annualCompleted = 0;
      let quarterlyGoals = 0;
      let quarterlyCompleted = 0;

      for (const okr of okrs) {
        const rs = (okr.rock_status || "on_track") as RockStatus;
        if (rs in rocksSummary) rocksSummary[rs]++;

        if (okr.okr_type === "company" || okr.year) {
          annualGoals++;
          if (okr.status === "completed" || okr.status === "closed") annualCompleted++;
        }
        if (okr.quarter) {
          quarterlyGoals++;
          if (okr.status === "completed" || okr.rock_status === "completed") quarterlyCompleted++;
        }
      }

      const openIssues = issues.filter((i) => i.status === "open" || i.status === "in_progress").length;
      const resolvedIssues = issues.filter((i) => i.status === "solved" || i.status === "archived").length;

      let healthy = 0;
      let warning = 0;
      let offTrack = 0;
      for (const m of metrics) {
        if (m.status === "on_track") healthy++;
        else if (m.status === "needs_attention") warning++;
        else offTrack++;
      }

      const upcoming = meetings.filter(
        (m) => m.scheduled_at && new Date(m.scheduled_at) > now
      ).length;
      const missed = meetings.filter(
        (m) =>
          m.scheduled_at &&
          new Date(m.scheduled_at) < now &&
          m.status !== "completed"
      ).length;

      const totalRocks = Object.values(rocksSummary).reduce((a, b) => a + b, 0);
      const onTrackPct = totalRocks > 0 ? (rocksSummary.on_track + rocksSummary.completed) / totalRocks : 1;
      const issueHealth = issues.length > 0 ? 1 - openIssues / issues.length : 1;
      const scorecardHealth = metrics.length > 0 ? healthy / metrics.length : 1;
      const teamHealthScore = Math.round(((onTrackPct + issueHealth + scorecardHealth) / 3) * 100);

      return {
        visionProgress: {
          annual: annualGoals > 0 ? Math.round((annualCompleted / annualGoals) * 100) : 0,
          quarterly: quarterlyGoals > 0 ? Math.round((quarterlyCompleted / quarterlyGoals) * 100) : 0,
        },
        rocksSummary,
        scorecardSummary: { healthy, warning, off_track: offTrack },
        meetings: { upcoming, missed },
        idsSummary: { open: openIssues, resolved: resolvedIssues },
        teamHealthScore,
      };
    },
    enabled: !!user,
    staleTime: cacheConfig.staleTime.short,
  });
}
