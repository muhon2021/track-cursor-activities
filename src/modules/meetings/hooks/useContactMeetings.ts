/**
 * Contact Meetings Hook
 *
 * Fetches meetings linked to a specific contact via the contact_meeting_links
 * join table. Also provides mutations for adding and removing links.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { ContactMeetingLink } from "../types";

const CONTACT_MEETINGS_KEY = "contact-meetings";

interface ContactMeetingRow {
  id: string;
  contact_id: string;
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
 * Fetch all meetings linked to a specific contact.
 */
export function useContactMeetings(contactId: string) {
  return useQuery({
    queryKey: [CONTACT_MEETINGS_KEY, contactId],
    queryFn: async (): Promise<ContactMeetingRow[]> => {
      const { data, error } = await (supabase as any)
        .from("contact_meeting_links")
        .select(
          "*, meeting:meetings(id, title, scheduled_at, status, duration_minutes, slug)"
        )
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ContactMeetingRow[];
    },
    enabled: !!contactId,
  });
}

/**
 * Link a meeting to a contact by inserting into contact_meeting_links.
 */
export function useAddContactMeetingLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      meetingId,
    }: {
      contactId: string;
      meetingId: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from("contact_meeting_links")
        .insert({
          contact_id: contactId,
          meeting_id: meetingId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [CONTACT_MEETINGS_KEY, vars.contactId] });
      toast.success("Meeting linked to contact");
    },
    onError: (error: Error) => {
      if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
        toast.error("This meeting is already linked to the contact");
      } else {
        toast.error("Failed to link meeting to contact", { description: error.message });
      }
    },
  });
}

/**
 * Remove a contact-meeting link by its id.
 */
export function useRemoveContactMeetingLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      contactId,
    }: {
      id: string;
      contactId: string;
    }) => {
      const { error } = await (supabase as any)
        .from("contact_meeting_links")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [CONTACT_MEETINGS_KEY, vars.contactId] });
      toast.success("Meeting unlinked from contact");
    },
    onError: (error: Error) => {
      toast.error("Failed to unlink meeting from contact", { description: error.message });
    },
  });
}
