import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requirePermission } from "../_shared/permission-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action = "suspend" | "reactivate" | "remove";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const authResult = await requirePermission(
      req,
      userClient,
      corsHeaders,
      "users.admin"
    );
    if (authResult instanceof Response) return authResult;
    const { userId: actorId } = authResult;

    const body = await req.json();
    const { action, target_user_id } = body as { action: Action; target_user_id: string };

    if (!action || !target_user_id) {
      return new Response(JSON.stringify({ error: "action and target_user_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["suspend", "reactivate", "remove"].includes(action)) {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (target_user_id === actorId) {
      return new Response(
        JSON.stringify({ error: "self_action_not_allowed", message: "You cannot perform this action on your own account" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: targetRoles } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", target_user_id);

    const targetIsAdmin = (targetRoles ?? []).some((r) => r.role === "admin");

    if (targetIsAdmin && (action === "suspend" || action === "remove")) {
      const { count: adminCount } = await serviceClient
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");

      if ((adminCount ?? 0) <= 1) {
        return new Response(
          JSON.stringify({ error: "last_admin", message: "Cannot suspend or remove the last remaining admin" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (action === "suspend") {
      const { error } = await serviceClient
        .from("profiles")
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
          deactivated_by: actorId,
        })
        .eq("id", target_user_id);
      if (error) throw error;

      await serviceClient.from("activity_logs").insert({
        user_id: actorId,
        action: "user.suspended",
        resource_type: "user",
        resource_id: target_user_id,
      });
    }

    if (action === "reactivate") {
      const { error } = await serviceClient
        .from("profiles")
        .update({ is_active: true, deactivated_at: null, deactivated_by: null })
        .eq("id", target_user_id);
      if (error) throw error;

      await serviceClient.from("activity_logs").insert({
        user_id: actorId,
        action: "user.reactivated",
        resource_type: "user",
        resource_id: target_user_id,
      });
    }

    if (action === "remove") {
      const { data: ownerRole } = await serviceClient
        .from("roles")
        .select("id")
        .eq("slug", "owner")
        .maybeSingle();

      if (ownerRole?.id) {
        const { data: targetOwnerRow } = await serviceClient
          .from("user_roles")
          .select("id")
          .eq("user_id", target_user_id)
          .eq("role_id", ownerRole.id)
          .maybeSingle();

        if (targetOwnerRow) {
          const { count: ownerCount } = await serviceClient
            .from("user_roles")
            .select("user_id", { count: "exact", head: true })
            .eq("role_id", ownerRole.id);

          if ((ownerCount ?? 0) <= 1) {
            return new Response(
              JSON.stringify({ error: "last_owner", message: "Cannot delete the last remaining Owner" }),
              { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }

      await serviceClient.from("activity_logs").insert({
        user_id: actorId,
        action: "user.deleted",
        resource_type: "user",
        resource_id: target_user_id,
        details: { hard_delete: true },
      });

      // Clear references that would block profile/auth deletion
      await serviceClient
        .from("profiles")
        .update({ deactivated_by: null })
        .eq("deactivated_by", target_user_id);
      await serviceClient
        .from("departments")
        .update({ head_user_id: null })
        .eq("head_user_id", target_user_id);
      await serviceClient
        .from("user_invites")
        .update({ invited_by: null })
        .eq("invited_by", target_user_id);

      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(target_user_id);
      if (deleteError) {
        console.error("auth.admin.deleteUser failed:", deleteError);
        return new Response(
          JSON.stringify({
            error: "delete_failed",
            message: deleteError.message || "Failed to permanently delete user",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("manage-user-status error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
