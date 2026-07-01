/**
 * Cryptographic helpers for tamper-evident audit log chaining.
 */

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface AuditLogPayload {
  id?: string;
  user_id?: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  details?: Record<string, unknown>;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: string;
  previous_row_hash?: string | null;
}

export function canonicalizeAuditPayload(payload: AuditLogPayload): string {
  const normalized = {
    user_id: payload.user_id ?? null,
    action: payload.action,
    resource_type: payload.resource_type ?? null,
    resource_id: payload.resource_id ?? null,
    details: payload.details ?? {},
    ip_address: payload.ip_address ?? null,
    user_agent: payload.user_agent ?? null,
    created_at: payload.created_at ?? null,
    previous_row_hash: payload.previous_row_hash ?? null,
  };
  return JSON.stringify(normalized);
}

export async function computeAuditRowHash(
  payload: AuditLogPayload,
  previousRowHash: string | null
): Promise<string> {
  const withPrevious = { ...payload, previous_row_hash: previousRowHash };
  return sha256Hex(canonicalizeAuditPayload(withPrevious));
}
