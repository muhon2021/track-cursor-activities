/**
 * EOS Issue Insights Hook
 *
 * Analytics and trends for issues: status distribution, pod breakdown,
 * resolution time, category trends.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys, cacheConfig } from "@/lib/cache";
import type { IssueStatus, IssuePriority, IssueCategory } from "../types";

export interface IssueInsights {
  byStatus: Record<IssueStatus, number>;
  byPriority: Record<IssuePriority, number>;
  byCategory: Record<IssueCategory, number>;
  byPod: { podId: string; podName: string; count: number }[];
  bySource: Record<string, number>;
  avgResolutionDays: number;
  recentTrend: { date: string; opened: number; solved: number }[];
  anonymousCount: number;
  totalSuggestions: number;
}

export function useEOSIssueInsights(days: number = 90) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.eos.issueInsights(days),
    queryFn: async (): Promise<IssueInsights> => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const [issuesRes, podsRes, suggestionsRes] = await Promise.all([
        supabase
          .from("eos_issues")
          .select("*")
          .gte("created_at", fromDate.toISOString()),
        supabase
          .from("eos_pods")
          .select("id, name")
          .eq("is_active", true),
        supabase
          .from("eos_issue_suggestions")
          .select("id"),
      ]);

      if (issuesRes.error) throw issuesRes.error;
      const issues = (issuesRes.data || []) as any[];
      const pods = (podsRes.data || []) as any[];
      const totalSuggestions = (suggestionsRes.data || []).length;

      const byStatus: Record<string, number> = {};
      const byPriority: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      const bySource: Record<string, number> = {};
      const podCounts: Record<string, number> = {};
      const dateMap = new Map<string, { opened: number; solved: number }>();

      let resolutionTotal = 0;
      let resolutionCount = 0;
      let anonymousCount = 0;

      for (const issue of issues) {
        // Status
        byStatus[issue.status] = (byStatus[issue.status] || 0) + 1;

        // Priority
        byPriority[issue.priority] = (byPriority[issue.priority] || 0) + 1;

        // Category
        byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;

        // Source
        bySource[issue.source] = (bySource[issue.source] || 0) + 1;

        // Pod
        if (issue.pod_id) {
          podCounts[issue.pod_id] = (podCounts[issue.pod_id] || 0) + 1;
        }

        // Anonymous
        if (issue.is_anonymous) anonymousCount++;

        // Resolution time
        if (issue.solved_at && issue.created_at) {
          const created = new Date(issue.created_at).getTime();
          const solved = new Date(issue.solved_at).getTime();
          resolutionTotal += (solved - created) / (1000 * 60 * 60 * 24);
          resolutionCount++;
        }

        // Date trend
        const dateKey = new Date(issue.created_at).toISOString().slice(0, 10);
        const entry = dateMap.get(dateKey) || { opened: 0, solved: 0 };
        entry.opened++;
        if (issue.solved_at) {
          const solvedKey = new Date(issue.solved_at).toISOString().slice(0, 10);
          const solvedEntry = dateMap.get(solvedKey) || { opened: 0, solved: 0 };
          solvedEntry.solved++;
          dateMap.set(solvedKey, solvedEntry);
        }
        dateMap.set(dateKey, entry);
      }

      // Build pod breakdown with names
      const podNameMap = new Map(pods.map((p: any) => [p.id, p.name]));
      const byPod = Object.entries(podCounts)
        .map(([podId, count]) => ({
          podId,
          podName: podNameMap.get(podId) || "Unknown",
          count,
        }))
        .sort((a, b) => b.count - a.count);

      // Build recent trend sorted by date
      const recentTrend = Array.from(dateMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14); // Last 14 data points

      return {
        byStatus: byStatus as Record<IssueStatus, number>,
        byPriority: byPriority as Record<IssuePriority, number>,
        byCategory: byCategory as Record<IssueCategory, number>,
        byPod,
        bySource,
        avgResolutionDays: resolutionCount > 0
          ? Math.round(resolutionTotal / resolutionCount * 10) / 10
          : 0,
        recentTrend,
        anonymousCount,
        totalSuggestions,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}
