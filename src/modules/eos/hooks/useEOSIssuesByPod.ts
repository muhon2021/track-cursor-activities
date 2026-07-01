/**
 * EOS Issues By Pod Hook
 *
 * Groups issues by pod with per-pod stats. Used by IssuesPodOverview
 * and IssuesByPod pages.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { EOSIssue, EOSPod } from "../types";

export interface PodIssueGroup {
  pod: EOSPod;
  issues: EOSIssue[];
  stats: {
    total: number;
    open: number;
    in_progress: number;
    solved: number;
    critical: number;
  };
}

export interface IssuesByPodData {
  groups: PodIssueGroup[];
  unassigned: EOSIssue[];
  totalIssues: number;
}

/**
 * Fetch all issues grouped by pod with per-pod stats.
 */
export function useEOSIssuesByPod() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["eos-issues-by-pod"],
    queryFn: async (): Promise<IssuesByPodData> => {
      const [issuesRes, podsRes] = await Promise.all([
        supabase
          .from("eos_issues")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("eos_pods")
          .select("*")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

      if (issuesRes.error) throw issuesRes.error;
      if (podsRes.error) throw podsRes.error;

      const issues = (issuesRes.data || []) as unknown as EOSIssue[];
      const pods = (podsRes.data || []) as unknown as EOSPod[];

      const podMap = new Map<string, EOSIssue[]>();
      const unassigned: EOSIssue[] = [];

      for (const issue of issues) {
        if (issue.pod_id) {
          const list = podMap.get(issue.pod_id) || [];
          list.push(issue);
          podMap.set(issue.pod_id, list);
        } else {
          unassigned.push(issue);
        }
      }

      const groups: PodIssueGroup[] = pods.map((pod) => {
        const podIssues = podMap.get(pod.id) || [];
        return {
          pod,
          issues: podIssues,
          stats: {
            total: podIssues.length,
            open: podIssues.filter((i) => i.status === "open").length,
            in_progress: podIssues.filter((i) => i.status === "in_progress").length,
            solved: podIssues.filter((i) => i.status === "solved").length,
            critical: podIssues.filter((i) => i.priority === "critical").length,
          },
        };
      });

      return {
        groups,
        unassigned,
        totalIssues: issues.length,
      };
    },
    enabled: !!user,
  });
}

/**
 * Fetch issues for a specific pod.
 */
export function usePodIssues(podId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["eos-issues", "pod", podId],
    queryFn: async (): Promise<{ pod: EOSPod | null; issues: EOSIssue[] }> => {
      if (!podId) return { pod: null, issues: [] };

      const [issuesRes, podRes] = await Promise.all([
        supabase
          .from("eos_issues")
          .select("*")
          .eq("pod_id", podId)
          .order("created_at", { ascending: false }),
        supabase
          .from("eos_pods")
          .select("*")
          .eq("id", podId)
          .single(),
      ]);

      if (issuesRes.error) throw issuesRes.error;

      return {
        pod: podRes.data as unknown as EOSPod | null,
        issues: (issuesRes.data || []) as unknown as EOSIssue[],
      };
    },
    enabled: !!user && !!podId,
  });
}
