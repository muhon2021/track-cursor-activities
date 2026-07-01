/**
 * Link Fellow recordings to a project (meetings + meeting_assignments).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import { extractTranscriptFromFellowRecording } from "@/lib/fellow-transcript";
import { fetchFellowRecording, type FellowRecording } from "@/hooks/useFellow";

export function getFellowRecordingId(recording: FellowRecording): string {
  const id = recording.id ?? recording.recording_id ?? recording.recordingId;
  if (typeof id === "string" || typeof id === "number") return String(id);
  return "";
}

export function getFellowRecordingTitle(recording: FellowRecording): string {
  const t =
    recording.title ??
    recording.name ??
    recording.topic ??
    recording.summary ??
    recording.subject;
  if (typeof t === "string" && t.trim()) return t.trim();
  const id = getFellowRecordingId(recording);
  return id ? `Fellow recording ${id}` : "Fellow recording";
}

function pickScheduledAt(recording: FellowRecording): string | null {
  const candidates = [
    recording.started_at,
    recording.startedAt,
    recording.start_time,
    recording.startTime,
    recording.created_at,
    recording.createdAt,
    recording.recorded_at,
    recording.recordedAt,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function fellowSlug(recordingId: string): string {
  return `fellow-${recordingId}`.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 120);
}

export function useLinkFellowRecordingToProject(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recording,
      syncTranscript = false,
    }: {
      recording: FellowRecording;
      syncTranscript?: boolean;
    }) => {
      if (!projectId) throw new Error("Project not loaded");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const externalId = getFellowRecordingId(recording);
      if (!externalId) throw new Error("Recording has no id");

      let transcriptText: string | null = null;
      if (syncTranscript) {
        const fetched = await fetchFellowRecording(externalId);
        transcriptText =
          fetched.transcript_text ?? extractTranscriptFromFellowRecording(fetched.recording);
      }

      const title = getFellowRecordingTitle(recording);
      const scheduledAt = pickScheduledAt(recording);

      const { data: existing } = await supabase
        .from("meetings")
        .select("id")
        .eq("provider", "fellow")
        .eq("external_id", externalId)
        .maybeSingle();

      let meetingId: string;

      if (existing?.id) {
        meetingId = existing.id;
        const patch: Record<string, unknown> = {
          title,
          updated_at: new Date().toISOString(),
        };
        if (scheduledAt) patch.scheduled_at = scheduledAt;
        if (transcriptText != null) patch.transcript_text = transcriptText;

        const { error } = await supabase.from("meetings").update(patch as any).eq("id", meetingId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("meetings")
          .insert({
            title,
            provider: "fellow",
            external_id: externalId,
            organizer_id: user.id,
            status: "completed",
            slug: fellowSlug(externalId),
            ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
            ...(transcriptText != null ? { transcript_text: transcriptText } : {}),
          })
          .select("id")
          .single();

        if (error) throw error;
        meetingId = inserted.id;
      }

      const { data: assignExists } = await supabase
        .from("meeting_assignments")
        .select("id")
        .eq("meeting_id", meetingId)
        .eq("entity_type", "project")
        .eq("entity_id", projectId)
        .maybeSingle();

      if (!assignExists) {
        const { error: assignError } = await supabase.from("meeting_assignments").insert({
          meeting_id: meetingId,
          entity_type: "project",
          entity_id: projectId,
          assigned_by: user.id,
        });
        if (assignError) throw assignError;
      }

      return { meetingId, externalId };
    },
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: ["cross-meetings", "project", projectId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.projectMeetings(projectId) });
      queryClient.invalidateQueries({ queryKey: ["meetings", "fellow"] });
    },
  });
}
