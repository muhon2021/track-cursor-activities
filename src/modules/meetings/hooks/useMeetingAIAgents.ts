/**
 * Meeting AI Agents Hook
 *
 * Provides convenient wrappers around the AI agent framework
 * for meetings-specific agents: summarization, action extraction,
 * categorization, prep, transcript analysis, follow-up emails,
 * efficiency coaching, and client matching.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Agent slugs — must match the seeded ai_agents records
const MEETING_AGENT_SLUGS = {
  summarizer: "meeting-summarizer",
  actionExtractor: "meeting-action-extractor",
  categorizer: "meeting-categorizer",
  prepAssistant: "meeting-prep-assistant",
  transcriptAnalyzer: "meeting-transcript-analyzer",
  followUpGenerator: "meeting-followup-generator",
  efficiencyCoach: "meeting-efficiency-coach",
  clientMatcher: "meeting-client-matcher",
} as const;

interface AgentRunResult {
  run_id: string;
  status: string;
  output: string;
  token_usage?: { prompt_tokens: number; completion_tokens: number };
  latency_ms: number;
}

/**
 * Fetch all meeting-category AI agents.
 */
export function useMeetingAgents() {
  return useQuery({
    queryKey: ["meeting-ai-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("category", "meetings")
        .eq("is_enabled", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });
}

/**
 * Generic meeting agent execution.
 * Calls the run-ai-agent edge function with the given slug and context.
 */
function useRunMeetingAgent() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      agentSlug,
      context,
    }: {
      agentSlug: string;
      context: Record<string, unknown>;
    }): Promise<AgentRunResult> => {
      const { data, error } = await supabase.functions.invoke("run-ai-agent", {
        body: {
          agent_slug: agentSlug,
          user_id: user?.id,
          execution_context: context,
        },
      });

      if (error) throw error;
      return data as AgentRunResult;
    },
    onError: (error: Error) => {
      toast.error(error.message || "AI agent execution failed");
    },
  });
}

/**
 * Summarize a meeting from its transcript or notes.
 */
export function useSummarizeMeeting() {
  const runAgent = useRunMeetingAgent();

  return useMutation({
    mutationFn: async ({
      meetingId,
      transcript,
      notes,
      meetingTitle,
      participants,
    }: {
      meetingId: string;
      transcript?: string;
      notes?: string;
      meetingTitle?: string;
      participants?: string[];
    }) => {
      const result = await runAgent.mutateAsync({
        agentSlug: MEETING_AGENT_SLUGS.summarizer,
        context: {
          meeting_id: meetingId,
          meeting_title: meetingTitle,
          transcript,
          notes,
          participants,
        },
      });

      // Persist summary to the meeting record
      if (result.output) {
        await supabase
          .from("meetings")
          .update({ ai_summary: result.output })
          .eq("id", meetingId);
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Meeting summary generated");
    },
  });
}

/**
 * Extract action items from a meeting transcript.
 */
export function useExtractActionItems() {
  const runAgent = useRunMeetingAgent();

  return useMutation({
    mutationFn: async ({
      meetingId,
      transcript,
      meetingDate,
    }: {
      meetingId: string;
      transcript: string;
      meetingDate?: string;
    }) => {
      const result = await runAgent.mutateAsync({
        agentSlug: MEETING_AGENT_SLUGS.actionExtractor,
        context: {
          meeting_id: meetingId,
          transcript,
          meeting_date: meetingDate,
        },
      });

      return result;
    },
    onSuccess: () => {
      toast.success("Action items extracted");
    },
  });
}

/**
 * Categorize a meeting.
 */
export function useCategorizeMeeting() {
  const runAgent = useRunMeetingAgent();

  return useMutation({
    mutationFn: async ({
      meetingId,
      title,
      description,
      participants,
      transcriptExcerpt,
    }: {
      meetingId: string;
      title: string;
      description?: string;
      participants?: string[];
      transcriptExcerpt?: string;
    }) => {
      const result = await runAgent.mutateAsync({
        agentSlug: MEETING_AGENT_SLUGS.categorizer,
        context: {
          meeting_id: meetingId,
          title,
          description,
          participants,
          transcript_excerpt: transcriptExcerpt,
        },
      });

      return result;
    },
    onSuccess: () => {
      toast.success("Meeting categorized");
    },
  });
}

/**
 * Generate a meeting prep briefing.
 */
export function usePrepareMeeting() {
  const runAgent = useRunMeetingAgent();

  return useMutation({
    mutationFn: async ({
      meetingId,
      title,
      scheduledAt,
      participants,
      clientInfo,
      dealInfo,
      previousMeetings,
      openActionItems,
    }: {
      meetingId: string;
      title: string;
      scheduledAt?: string;
      participants?: string[];
      clientInfo?: Record<string, unknown>;
      dealInfo?: Record<string, unknown>;
      previousMeetings?: Array<{ title: string; date: string; summary?: string }>;
      openActionItems?: Array<{ text: string; assignee?: string; due_date?: string }>;
    }) => {
      const result = await runAgent.mutateAsync({
        agentSlug: MEETING_AGENT_SLUGS.prepAssistant,
        context: {
          meeting_id: meetingId,
          title,
          scheduled_at: scheduledAt,
          participants,
          client_info: clientInfo,
          deal_info: dealInfo,
          previous_meetings: previousMeetings,
          open_action_items: openActionItems,
        },
      });

      return result;
    },
    onSuccess: () => {
      toast.success("Meeting prep briefing generated");
    },
  });
}

/**
 * Analyze a meeting transcript for deep insights.
 */
export function useAnalyzeTranscript() {
  const runAgent = useRunMeetingAgent();

  return useMutation({
    mutationFn: async ({
      meetingId,
      transcript,
      meetingTitle,
      meetingType,
    }: {
      meetingId: string;
      transcript: string;
      meetingTitle?: string;
      meetingType?: string;
    }) => {
      const result = await runAgent.mutateAsync({
        agentSlug: MEETING_AGENT_SLUGS.transcriptAnalyzer,
        context: {
          meeting_id: meetingId,
          transcript,
          meeting_title: meetingTitle,
          meeting_type: meetingType,
        },
      });

      return result;
    },
    onSuccess: () => {
      toast.success("Transcript analysis complete");
    },
  });
}

/**
 * Generate a follow-up email for a meeting.
 */
export function useGenerateFollowUpEmail() {
  const runAgent = useRunMeetingAgent();

  return useMutation({
    mutationFn: async ({
      meetingId,
      meetingTitle,
      meetingDate,
      participants,
      summary,
      actionItems,
      decisions,
      nextMeetingDate,
      isClientFacing,
    }: {
      meetingId: string;
      meetingTitle: string;
      meetingDate?: string;
      participants?: string[];
      summary?: string;
      actionItems?: Array<{ task: string; owner?: string; due_date?: string }>;
      decisions?: string[];
      nextMeetingDate?: string;
      isClientFacing?: boolean;
    }) => {
      const result = await runAgent.mutateAsync({
        agentSlug: MEETING_AGENT_SLUGS.followUpGenerator,
        context: {
          meeting_id: meetingId,
          meeting_title: meetingTitle,
          meeting_date: meetingDate,
          participants,
          summary,
          action_items: actionItems,
          decisions,
          next_meeting_date: nextMeetingDate,
          is_client_facing: isClientFacing,
        },
      });

      return result;
    },
    onSuccess: () => {
      toast.success("Follow-up email drafted");
    },
  });
}

/**
 * Analyze meeting efficiency patterns.
 */
export function useAnalyzeMeetingEfficiency() {
  const runAgent = useRunMeetingAgent();

  return useMutation({
    mutationFn: async ({
      meetings,
      dateRange,
      focusArea,
    }: {
      meetings: Array<{
        title: string;
        type?: string;
        duration_minutes: number;
        efficiency_score?: number | null;
        status: string;
        is_recurring: boolean;
        action_item_count?: number;
        decision_count?: number;
      }>;
      dateRange?: { start: string; end: string };
      focusArea?: "time" | "effectiveness" | "cost" | "all";
    }) => {
      const result = await runAgent.mutateAsync({
        agentSlug: MEETING_AGENT_SLUGS.efficiencyCoach,
        context: {
          meetings,
          date_range: dateRange,
          focus_area: focusArea || "all",
        },
      });

      return result;
    },
    onSuccess: () => {
      toast.success("Efficiency analysis complete");
    },
  });
}

/**
 * Match an unassigned meeting to clients/deals/projects.
 */
export function useMatchMeetingToClient() {
  const runAgent = useRunMeetingAgent();

  return useMutation({
    mutationFn: async ({
      meetingId,
      meetingTitle,
      meetingDescription,
      participants,
      availableClients,
      availableDeals,
      availableProjects,
    }: {
      meetingId: string;
      meetingTitle: string;
      meetingDescription?: string;
      participants?: Array<{ email: string; name?: string }>;
      availableClients?: Array<{ id: string; name: string; email?: string; company?: string }>;
      availableDeals?: Array<{ id: string; title: string; stage?: string; client_name?: string }>;
      availableProjects?: Array<{ id: string; name: string; client_name?: string }>;
    }) => {
      const result = await runAgent.mutateAsync({
        agentSlug: MEETING_AGENT_SLUGS.clientMatcher,
        context: {
          meeting_id: meetingId,
          meeting_title: meetingTitle,
          meeting_description: meetingDescription,
          participants,
          available_clients: availableClients,
          available_deals: availableDeals,
          available_projects: availableProjects,
        },
      });

      return result;
    },
    onSuccess: () => {
      toast.success("Meeting matching complete");
    },
  });
}
