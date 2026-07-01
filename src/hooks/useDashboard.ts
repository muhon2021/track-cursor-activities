import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DashboardStats {
  clients: {
    total: number;
    thisMonth: number;
  };
  meetings: {
    total: number;
    thisWeek: number;
    upcoming: number;
  };
  aiAgents: {
    total: number;
    runsToday: number;
  };
  knowledge: {
    total: number;
    recent: number;
  };
}

export interface RecentActivity {
  id: string;
  action: string;
  detail: string;
  time: string;
  type: "client" | "meeting" | "ai" | "knowledge";
}

export function useDashboardStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const now = new Date();
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      // Fetch clients
      const [clientsTotal, clientsThisMonth] = await Promise.all([
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .gte("created_at", monthAgo),
      ]);

      // Fetch meetings
      const [meetingsTotal, meetingsThisWeek, meetingsUpcoming] = await Promise.all([
        supabase.from("meetings").select("*", { count: "exact", head: true }),
        supabase
          .from("meetings")
          .select("*", { count: "exact", head: true })
          .gte("created_at", weekAgo),
        supabase
          .from("meetings")
          .select("*", { count: "exact", head: true })
          .gte("scheduled_at", now.toISOString())
          .eq("status", "scheduled"),
      ]);

      // Fetch AI agents stats
      const [agentsTotal, agentRunsToday] = await Promise.all([
        supabase.from("ai_agents").select("*", { count: "exact", head: true }),
        supabase
          .from("ai_agent_runs")
          .select("*", { count: "exact", head: true })
          .gte("created_at", todayStart),
      ]);

      // Fetch knowledge entries
      const [knowledgeTotal, knowledgeRecent] = await Promise.all([
        supabase.from("knowledge_entries").select("*", { count: "exact", head: true }),
        supabase
          .from("knowledge_entries")
          .select("*", { count: "exact", head: true })
          .gte("created_at", weekAgo),
      ]);

      const stats: DashboardStats = {
        clients: {
          total: clientsTotal.count || 0,
          thisMonth: clientsThisMonth.count || 0,
        },
        meetings: {
          total: meetingsTotal.count || 0,
          thisWeek: meetingsThisWeek.count || 0,
          upcoming: meetingsUpcoming.count || 0,
        },
        aiAgents: {
          total: agentsTotal.count || 0,
          runsToday: agentRunsToday.count || 0,
        },
        knowledge: {
          total: knowledgeTotal.count || 0,
          recent: knowledgeRecent.count || 0,
        },
      };

      return stats;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useRecentActivity() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const activity: RecentActivity[] = [];

      // Get recent clients
      const { data: recentClients } = await supabase
        .from("clients")
        .select("id, name, created_at")
        .order("created_at", { ascending: false })
        .limit(3);

      recentClients?.forEach((client) => {
        activity.push({
          id: client.id,
          action: "Client added",
          detail: client.name,
          time: new Date(client.created_at).toISOString(),
          type: "client",
        });
      });

      // Get recent meetings
      const { data: recentMeetings } = await supabase
        .from("meetings")
        .select("id, title, created_at, status")
        .order("created_at", { ascending: false })
        .limit(3);

      recentMeetings?.forEach((meeting) => {
        activity.push({
          id: meeting.id,
          action: meeting.status === "completed" ? "Meeting completed" : "Meeting scheduled",
          detail: meeting.title,
          time: new Date(meeting.created_at).toISOString(),
          type: "meeting",
        });
      });

      // Get recent AI agent runs
      const { data: recentRuns } = await supabase
        .from("ai_agent_runs")
        .select("id, status, created_at, agent_id")
        .order("created_at", { ascending: false })
        .limit(3);

      recentRuns?.forEach((run) => {
        activity.push({
          id: run.id,
          action: `AI run ${run.status}`,
          detail: `Agent execution`,
          time: new Date(run.created_at).toISOString(),
          type: "ai",
        });
      });

      // Get recent knowledge entries
      const { data: recentKnowledge } = await supabase
        .from("knowledge_entries")
        .select("id, title, created_at")
        .order("created_at", { ascending: false })
        .limit(3);

      recentKnowledge?.forEach((entry) => {
        activity.push({
          id: entry.id,
          action: "Knowledge added",
          detail: entry.title,
          time: new Date(entry.created_at).toISOString(),
          type: "knowledge",
        });
      });

      // Sort by time and return top 10
      return activity
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 10);
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return date.toLocaleDateString();
}

export interface AITeamMember {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  avatar: string | null;
}

export function useAITeamSummary() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard", "ai-team"],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name, description, slug, avatar")
        .eq("is_enabled", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) throw error;
      return (data || []) as AITeamMember[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}
