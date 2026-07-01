/**
 * Meeting Permissions Hook
 *
 * Checks whether the current user can edit, delete, or manage participants
 * for a given meeting. Permissions are based on organizer ownership and
 * admin role status.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const MEETING_PERMISSIONS_KEY = "meeting-permissions";

interface MeetingPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canManageParticipants: boolean;
  isOrganizer: boolean;
  isAdmin: boolean;
}

/**
 * Check if the current user can edit/delete/manage a meeting.
 *
 * Returns permission flags derived from organizer ownership and admin role.
 */
export function useMeetingPermissions(meetingId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [MEETING_PERMISSIONS_KEY, meetingId, user?.id],
    queryFn: async (): Promise<MeetingPermissions> => {
      // Fetch organizer_id for the meeting
      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .select("organizer_id")
        .eq("id", meetingId)
        .single();

      if (meetingError) throw meetingError;

      const isOrganizer = meeting?.organizer_id === user?.id;

      // Check if the user has an admin role
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id ?? "");

      if (rolesError) throw rolesError;

      const roleNames = (roles || []) as unknown as { role: string }[];
      const isAdmin = roleNames.some(
        (r) => r.role === "admin" || r.role === "moderator"
      );

      return {
        canEdit: isOrganizer || isAdmin,
        canDelete: isOrganizer || isAdmin,
        canManageParticipants: isOrganizer || isAdmin,
        isOrganizer,
        isAdmin,
      };
    },
    enabled: !!meetingId && !!user?.id,
  });
}
