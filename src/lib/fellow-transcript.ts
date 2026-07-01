/**
 * Helpers to read transcript / text from Fellow recording payloads (client-side).
 */

function collectStrings(value: unknown, out: string[], depth = 0): void {
  if (depth > 12 || value == null) return;
  if (typeof value === "string") {
    const t = value.trim();
    if (t.length > 2) out.push(t);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const key of ["text", "content", "body", "title", "summary", "description", "transcript", "transcript_text"]) {
      if (key in o) collectStrings(o[key], out, depth + 1);
    }
    for (const v of Object.values(o)) {
      if (v !== null && typeof v === "object") collectStrings(v, out, depth + 1);
    }
  }
}

/**
 * Best-effort transcript string from a Fellow `get-recording` (or list) payload.
 */
export function extractTranscriptFromFellowRecording(recording: Record<string, unknown> | null | undefined): string | null {
  if (!recording) return null;
  const direct =
    recording.transcript_text ??
    recording.transcriptText ??
    recording.transcript ??
    (recording as { transcript?: unknown }).transcript;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const fromNotes: string[] = [];
  collectStrings(recording.ai_notes ?? recording.aiNotes, fromNotes);
  if (fromNotes.length === 0) return null;
  const merged = fromNotes.join("\n\n").trim();
  return merged || null;
}
