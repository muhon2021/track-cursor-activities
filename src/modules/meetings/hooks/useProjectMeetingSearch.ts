/**
 * Project Meeting Search Hook
 *
 * Searches meetings linked to a specific project via the meeting_assignments
 * table (entity_type = 'project'), filtered by title ilike match.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchInput } from "@/lib/sanitize";
import type { MeetingAssignment } from "../types";

const PROJECT_MEETING_SEARCH_KEY = "project-meeting-search";

interface ProjectMeetingSearchResult extends MeetingAssignment {
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
 * Search meetings linked to a specific project by title.
 * Only executes when projectId is provided and query is at least 2 characters.
 */
export function useProjectMeetingSearch(projectId: string, query: string) {
  return useQuery({
    queryKey: [PROJECT_MEETING_SEARCH_KEY, projectId, query],
    queryFn: async (): Promise<ProjectMeetingSearchResult[]> => {
      const { data, error } = await supabase
        .from("meeting_assignments")
        .select(
          "*, meeting:meetings!inner(id, title, scheduled_at, status, duration_minutes, slug)"
        )
        .eq("entity_type", "project")
        .eq("entity_id", projectId)
        .ilike("meetings.title" as any, `%${sanitizeSearchInput(query)}%`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ProjectMeetingSearchResult[];
    },
    enabled: !!projectId && query.length >= 2,
  });
}
