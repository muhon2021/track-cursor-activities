/**
 * CSA ingest helpers
 */

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const MAX_PROMPT_LENGTH = 32 * 1024;

export type IngestEvent = "session_start" | "prompt" | "response" | "session_end";

export interface IngestBody {
  event: IngestEvent;
  cursor_session_id: string;
  timestamp?: string;
  workspace_path?: string;
  project_name?: string;
  user_email?: string;
  prompt?: {
    text?: string;
    generation_id?: string;
    model?: string;
    model_id?: string;
    model_params?: Array<{ id: string; value: string }>;
    composer_mode?: string;
  };
  response?: { text_length?: number; model?: string; tool_calls?: number; latency_ms?: number };
}

const rateStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(tokenId: string, maxPerMinute = 60): boolean {
  const now = Date.now();
  const entry = rateStore.get(tokenId);
  if (!entry || now > entry.resetAt) {
    rateStore.set(tokenId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= maxPerMinute) return false;
  entry.count++;
  return true;
}

export function truncateText(text: string, max = MAX_PROMPT_LENGTH): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  return { text: text.slice(0, max), truncated: true };
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
