/**
 * Client Meetings Hook
 *
 * Fetches meetings linked to a specific client via the client_meetings
 * join table. Also provides mutations for adding and removing links.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { ClientMeeting } from "../types";

const CLIENT_MEETINGS_KEY = "client-meetings";

interface ClientMeetingRow {
  id: string;
  client_id: string;
  meeting_id: string;
  created_at: string;
  meeting: {
    id: string;
    title: string;
    scheduled_at: string | null;
    status: string | null;
    duration_minutes: number | null;
    slug: string | null;
  } | null;
}

/**
 * Fetch all meetings linked to a specific client.
 */
export function useClientMeetings(clientId: string) {
  return useQuery({
    queryKey: [CLIENT_MEETINGS_KEY, clientId],
    queryFn: async (): Promise<ClientMeetingRow[]> => {
      const { data, error } = await (supabase as any)
        .from("client_meetings")
        .select(
          "*, meeting:meetings(id, title, scheduled_at, status, duration_minutes, slug)"
        )
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ClientMeetingRow[];
    },
    enabled: !!clientId,
  });
}

/**
 * Link a meeting to a client by inserting into client_meetings.
 */
export function useAddClientMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      meetingId,
    }: {
      clientId: string;
      meetingId: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from("client_meetings")
        .insert({
          client_id: clientId,
          meeting_id: meetingId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [CLIENT_MEETINGS_KEY, vars.clientId] });
      toast.success("Meeting linked to client");
    },
    onError: (error: Error) => {
      if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
        toast.error("This meeting is already linked to the client");
      } else {
        toast.error("Failed to link meeting to client", { description: error.message });
      }
    },
  });
}

/**
 * Remove a client-meeting link by its id.
 */
export function useRemoveClientMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      clientId,
    }: {
      id: string;
      clientId: string;
    }) => {
      const { error } = await (supabase as any)
        .from("client_meetings")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [CLIENT_MEETINGS_KEY, vars.clientId] });
      toast.success("Meeting unlinked from client");
    },
    onError: (error: Error) => {
      toast.error("Failed to unlink meeting from client", { description: error.message });
    },
  });
}
