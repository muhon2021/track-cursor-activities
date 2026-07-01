/**
 * Agent Collaboration Hooks
 *
 * React hooks for multi-agent collaboration features.
 * Enables teams of agents to work together on complex tasks.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface AgentTeam {
  id: string;
  name: string;
  description: string | null;
  team_type: string;
  collaboration_strategy: string | null;
  coordinator_agent_id: string | null;
  created_by: string;
  is_active: boolean;
  created_at: string;
}

export interface CollaborationSession {
  id: string;
  team_id: string;
  user_id: string;
  goal: string;
  session_type: string;
  status: string;
  current_stage: string | null;
  current_agent_id: string | null;
  final_output: any;
  outcome: string | null;
  total_messages: number;
  total_handoffs: number;
  total_cost: number;
  started_at: string;
  completed_at: string | null;
}

export interface AgentHandoff {
  id: string;
  session_id: string;
  from_agent_id: string;
  to_agent_id: string;
  handoff_reason: string;
  handoff_type: string | null;
  context_summary: string | null;
  status: string;
  handed_off_at: string;
}

/**
 * Fetch user's agent teams
 */
export function useAgentTeams() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["agent-teams"],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("agent_teams" as never)
        .select(`
          *,
          members:agent_team_members(
            *,
            agent:ai_agents(*)
          )
        ` as never)
        .eq("created_by", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

/**
 * Create a new agent team
 */
export function useCreateTeam() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      description?: string;
      team_type: string;
      collaboration_strategy?: string;
      agent_ids: string[];
    }) => {
      if (!user) throw new Error("User not authenticated");

      // Create team
      const { data: team, error: teamError } = await supabase
        .from("agent_teams" as never)
        .insert({
          name: params.name,
          description: params.description,
          team_type: params.team_type,
          collaboration_strategy: params.collaboration_strategy,
          created_by: user.id,
        } as never)
        .select()
        .single();

      if (teamError) throw teamError;

      // Add team members
      const members = params.agent_ids.map((agent_id, index) => ({
        team_id: (team as any).id,
        agent_id,
        priority_order: index,
        is_active: true,
      }));

      const { error: membersError } = await supabase
        .from("agent_team_members" as never)
        .insert(members as never);

      if (membersError) throw membersError;

      return team;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-teams"] });
      toast.success("Team created successfully");
    },
    onError: (error: unknown) => {
      console.error("Create team error:", error);
      toast.error((error as Error).message || "Failed to create team");
    },
  });
}

/**
 * Start a collaboration session
 */
export function useStartCollaboration() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      team_id: string;
      goal: string;
      session_type?: string;
      initial_context?: Record<string, any>;
    }) => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase.functions.invoke("orchestrate-agent-team", {
        body: {
          team_id: params.team_id,
          user_id: user.id,
          goal: params.goal,
          session_type: params.session_type || "task_delegation",
          initial_context: params.initial_context || {},
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaboration-sessions"] });
      toast.success("Collaboration started");
    },
    onError: (error: unknown) => {
      console.error("Start collaboration error:", error);
      toast.error((error as Error).message || "Failed to start collaboration");
    },
  });
}

/**
 * Fetch collaboration sessions
 */
export function useCollaborationSessions(teamId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["collaboration-sessions", teamId],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("agent_collaboration_sessions" as never)
        .select("*" as never)
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(50);

      if (teamId) {
        query = query.eq("team_id", teamId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as CollaborationSession[];
    },
    enabled: !!user,
  });
}

/**
 * Fetch collaboration messages for a session
 */
export function useCollaborationMessages(sessionId: string) {
  return useQuery({
    queryKey: ["collaboration-messages", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_collaboration_messages" as never)
        .select(`
          *,
          from_agent:ai_agents!from_agent_id(*),
          to_agent:ai_agents!to_agent_id(*)
        ` as never)
        .eq("session_id", sessionId)
        .order("created_at");

      if (error) throw error;
      return data || [];
    },
    enabled: !!sessionId,
  });
}

/**
 * Fetch handoffs for a session
 */
export function useHandoffs(sessionId: string) {
  return useQuery({
    queryKey: ["handoffs", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_handoffs" as never)
        .select(`
          *,
          from_agent:ai_agents!from_agent_id(*),
          to_agent:ai_agents!to_agent_id(*)
        ` as never)
        .eq("session_id", sessionId)
        .order("handed_off_at");

      if (error) throw error;
      return (data || []) as AgentHandoff[];
    },
    enabled: !!sessionId,
  });
}

/**
 * Request handoff to another agent
 */
export function useRequestHandoff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      session_id: string;
      from_agent_id: string;
      to_agent_id: string;
      handoff_reason: string;
      context_summary?: string;
      work_completed?: any;
      work_remaining?: any;
    }) => {
      const { data, error } = await supabase
        .from("agent_handoffs" as never)
        .insert({
          session_id: params.session_id,
          from_agent_id: params.from_agent_id,
          to_agent_id: params.to_agent_id,
          handoff_reason: params.handoff_reason,
          context_summary: params.context_summary,
          work_completed: params.work_completed,
          work_remaining: params.work_remaining,
          status: "pending",
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["handoffs", variables.session_id] });
      toast.success("Handoff requested");
    },
    onError: (error: unknown) => {
      console.error("Handoff error:", error);
      toast.error((error as Error).message || "Failed to request handoff");
    },
  });
}
