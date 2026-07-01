import { supabase } from "@/integrations/supabase/client";

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";

/** Fire-and-forget automation event emission (non-blocking). */
export function emitAutomationEvent(
  eventKey: string,
  payload: Record<string, unknown> = {},
  tenantId?: string
): void {
  void supabase
    .rpc("automation_emit_event", {
      p_event_key: eventKey,
      p_payload: payload,
      p_tenant_id: tenantId ?? DEFAULT_TENANT,
    })
    .then(({ error }) => {
      if (error) console.warn("[automation-emit]", eventKey, error.message);
    });
}
