import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";

export async function emitAutomationEvent(
  supabase: SupabaseClient,
  eventKey: string,
  payload: Record<string, unknown> = {},
  tenantId?: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("automation_emit_event", {
    p_event_key: eventKey,
    p_payload: payload,
    p_tenant_id: tenantId ?? DEFAULT_TENANT,
  });

  if (error) {
    console.error("[automation-emit] failed:", eventKey, error.message);
    return null;
  }
  return data as string;
}
