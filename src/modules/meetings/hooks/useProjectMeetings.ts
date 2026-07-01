/**
 * Project Meetings Hook
 *
 * Fetches meetings linked to a specific project via the meeting_assignments
 * table (entity_type = "project").
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MeetingAssignment } from "../types";

const PROJECT_MEETINGS_KEY = "project-meetings";

interface ProjectMeetingAssignment extends MeetingAssignment {
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
 * Fetch all meetings linked to a specific project.
 */
export function useProjectMeetings(projectId: string) {
  return useQuery({
    queryKey: [PROJECT_MEETINGS_KEY, projectId],
    queryFn: async (): Promise<ProjectMeetingAssignment[]> => {
      const { data, error } = await supabase
        .from("meeting_assignments")
        .select(
          "*, meeting:meetings(id, title, scheduled_at, status, duration_minutes, slug)"
        )
        .eq("entity_type", "project")
        .eq("entity_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ProjectMeetingAssignment[];
    },
    enabled: !!projectId,
  });
}
