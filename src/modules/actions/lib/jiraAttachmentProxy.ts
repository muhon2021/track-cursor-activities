import { supabase } from "@/integrations/supabase/client";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

export function buildJiraAttachmentProxyUrl(attachmentId: string, filename?: string): string {
  const u = new URL(`${supabaseUrl}/functions/v1/jira-attachment-proxy`);
  u.searchParams.set("attachment_id", attachmentId);
  if (filename) u.searchParams.set("filename", filename);
  return u.toString();
}

/** Opens a Jira attachment via the Edge proxy (uses user JWT + server JIRA_* secrets). */
export async function openJiraAttachment(attachmentId: string, filename?: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not signed in");
  }
  const url = buildJiraAttachmentProxyUrl(attachmentId, filename);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `Attachment request failed (${r.status})`);
  }
  const blob = await r.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
}
