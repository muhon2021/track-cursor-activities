import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAuth, authErrorResponse, type AuthError } from "./auth-middleware.ts";

export async function requirePermission(
  req: Request,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>,
  permissionKey: string
): Promise<{ userId: string } | Response> {
  try {
    const auth = await validateAuth(req, supabase);
    const { data: allowed, error } = await supabase.rpc("has_permission", {
      _user_id: auth.user.id,
      _permission_key: permissionKey,
    });

    if (error) {
      console.error("Permission check failed:", error);
      return new Response(
        JSON.stringify({ error: "Permission check failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: `Permission required: ${permissionKey}` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return { userId: auth.user.id };
  } catch (err) {
    return authErrorResponse(err as AuthError, corsHeaders);
  }
}

export async function requireAnyPermission(
  req: Request,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>,
  permissionKeys: string[]
): Promise<{ userId: string } | Response> {
  for (const key of permissionKeys) {
    const result = await requirePermission(req, supabase, corsHeaders, key);
    if (!(result instanceof Response)) {
      return result;
    }
  }
  return new Response(
    JSON.stringify({ error: "Insufficient permissions" }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
