/**
 * Fellow.ai — invoke Edge Function `fellow-api` (authenticated proxy).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import { extractTranscriptFromFellowRecording } from "@/lib/fellow-transcript";

export type FellowRecording = Record<string, unknown>;

export async function invokeFellow(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke("fellow-api", { body });
  if (error) throw error;
  if (!data || typeof data !== "object") return {};
  return data as Record<string, unknown>;
}

function asRecordingList(payload: Record<string, unknown>): FellowRecording[] {
  const raw = payload.recordings ?? payload.data;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is FellowRecording => x !== null && typeof x === "object");
}

function asNoteList(payload: Record<string, unknown>): FellowRecording[] {
  const raw = payload.notes ?? payload.data;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is FellowRecording => x !== null && typeof x === "object");
}

function asActionItemList(payload: Record<string, unknown>): FellowRecording[] {
  const raw = payload.action_items ?? payload.actionItems;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is FellowRecording => x !== null && typeof x === "object");
}

export function useFellowRecordings(limit = 50) {
  return useQuery({
    queryKey: queryKeys.meetings.fellow.recordings(limit),
    queryFn: async () => {
      const data = await invokeFellow({ action: "list-recordings", limit });
      if (typeof data.error === "string" && data.error && !asRecordingList(data).length) {
        throw new Error(data.error);
      }
      return asRecordingList(data);
    },
    retry: false,
  });
}

export function useFellowNotes(limit = 50) {
  return useQuery({
    queryKey: queryKeys.meetings.fellow.notes(limit),
    queryFn: async () => {
      const data = await invokeFellow({ action: "list-notes", limit });
      if (typeof data.error === "string" && data.error && !asNoteList(data).length) {
        throw new Error(data.error);
      }
      return asNoteList(data);
    },
    retry: false,
  });
}

export function useFellowActionItems(limit = 80) {
  return useQuery({
    queryKey: queryKeys.meetings.fellow.actionItems(limit),
    queryFn: async () => {
      const data = await invokeFellow({ action: "list-action-items", limit });
      if (typeof data.error === "string" && data.error && !asActionItemList(data).length) {
        throw new Error(data.error);
      }
      return asActionItemList(data);
    },
    retry: false,
  });
}

export async function fetchFellowRecording(recordingId: string): Promise<{
  recording: FellowRecording | null;
  transcript_text: string | null;
}> {
  const data = await invokeFellow({ action: "get-recording", recording_id: recordingId });
  if (typeof data.error === "string" && data.error) {
    throw new Error(data.error);
  }
  const rec = data.recording;
  const recording =
    rec !== null && typeof rec === "object" ? (rec as FellowRecording) : null;
  const fromPayload =
    recording && typeof recording.transcript_text === "string"
      ? recording.transcript_text
      : null;
  const transcript_text = fromPayload?.trim()
    ? fromPayload.trim()
    : extractTranscriptFromFellowRecording(recording);
  return { recording, transcript_text };
}
