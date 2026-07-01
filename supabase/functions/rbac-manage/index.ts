import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requirePermission } from "../_shared/permission-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";

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
      "settings.admin"
    );
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    const body = await req.json();
    const { action, role_id, permission_keys, target_user_id, new_role, reassign_to_role_id } = body;

    if (action === "change_user_role") {
      if (!target_user_id || !new_role) {
        return new Response(JSON.stringify({ error: "target_user_id and new_role are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (target_user_id === userId) {
        return new Response(
          JSON.stringify({ error: "self_change_not_allowed", message: "You cannot change your own role" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: existing } = await serviceClient
        .from("user_roles")
        .select("role")
        .eq("user_id", target_user_id)
        .maybeSingle();

      if (existing?.role === "admin" && new_role !== "admin") {
        const { count: adminCount } = await serviceClient
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "admin");

        if ((adminCount ?? 0) <= 1) {
          return new Response(
            JSON.stringify({ error: "last_admin", message: "Cannot change the role of the last remaining admin" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const { error: upsertError } = existing
        ? await serviceClient.from("user_roles").update({ role: new_role }).eq("user_id", target_user_id)
        : await serviceClient.from("user_roles").insert([{ user_id: target_user_id, role: new_role }]);

      if (upsertError) throw upsertError;

      await serviceClient.from("activity_logs").insert({
        user_id: userId,
        action: "user.role_changed",
        resource_type: "user",
        resource_id: target_user_id,
        details: { previous_role: existing?.role ?? null, new_role },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set_role_permissions") {
      if (!role_id || !Array.isArray(permission_keys)) {
        return new Response(JSON.stringify({ error: "role_id and permission_keys required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: perms } = await serviceClient
        .from("permissions")
        .select("id, key, is_assignable")
        .in("key", permission_keys);

      const { data: targetRole } = await serviceClient
        .from("roles")
        .select("slug")
        .eq("id", role_id)
        .single();

      const restrictedKeys = (perms ?? [])
        .filter((p) => p.is_assignable === false)
        .map((p) => p.key);

      if (restrictedKeys.length && targetRole?.slug !== "owner") {
        return new Response(
          JSON.stringify({
            error: "restricted_permissions",
            message: `These permissions can only be assigned to the Owner role: ${restrictedKeys.join(", ")}`,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await serviceClient.from("role_permissions").delete().eq("role_id", role_id);

      if (perms?.length) {
        await serviceClient.from("role_permissions").insert(
          perms.map((p) => ({ role_id, permission_id: p.id }))
        );
      }

      await serviceClient.from("activity_logs").insert({
        user_id: userId,
        action: "permission.changed",
        resource_type: "role",
        resource_id: role_id,
        details: { permission_count: permission_keys.length },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "clone_role") {
      if (!role_id) {
        return new Response(JSON.stringify({ error: "role_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: source, error: sourceError } = await serviceClient
        .from("roles")
        .select("*")
        .eq("id", role_id)
        .single();

      if (sourceError || !source) {
        return new Response(JSON.stringify({ error: "Source role not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cloneName = `${source.name} (Copy)`;
      const cloneSlug = `${source.slug || source.name.toLowerCase()}_copy_${Date.now()}`;

      const { data: newRole, error: createError } = await serviceClient
        .from("roles")
        .insert({
          name: cloneName,
          slug: cloneSlug,
          description: source.description,
          tenant_id: source.tenant_id || DEFAULT_TENANT,
          is_system: false,
          cloned_from_id: role_id,
        })
        .select()
        .single();

      if (createError || !newRole) {
        return new Response(JSON.stringify({ error: createError?.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: rolePerms } = await serviceClient
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", role_id);

      if (rolePerms?.length) {
        await serviceClient.from("role_permissions").insert(
          rolePerms.map((rp) => ({
            role_id: newRole.id,
            permission_id: rp.permission_id,
          }))
        );
      }

      await serviceClient.from("activity_logs").insert({
        user_id: userId,
        action: "role.created",
        resource_type: "role",
        resource_id: newRole.id,
        details: { cloned_from: role_id },
      });

      return new Response(JSON.stringify({ role: newRole }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_role") {
      if (!role_id) {
        return new Response(JSON.stringify({ error: "role_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: role, error: roleError } = await serviceClient
        .from("roles")
        .select("id, is_system")
        .eq("id", role_id)
        .single();

      if (roleError || !role) {
        return new Response(JSON.stringify({ error: "Role not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (role.is_system) {
        return new Response(
          JSON.stringify({ error: "system_role", message: "System roles cannot be deleted" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { count: memberCount } = await serviceClient
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role_id", role_id);

      if ((memberCount ?? 0) > 0) {
        if (!reassign_to_role_id) {
          return new Response(
            JSON.stringify({
              error: "members_assigned",
              message: "This role has assigned members. Provide reassign_to_role_id to reassign them before deleting.",
              member_count: memberCount,
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: targetRole, error: targetRoleError } = await serviceClient
          .from("roles")
          .select("id")
          .eq("id", reassign_to_role_id)
          .single();

        if (targetRoleError || !targetRole) {
          return new Response(JSON.stringify({ error: "reassign_to_role_id is invalid" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: reassignError } = await serviceClient
          .from("user_roles")
          .update({ role_id: targetRole.id })
          .eq("role_id", role_id);

        if (reassignError) throw reassignError;
      }

      const { error: deleteError } = await serviceClient.from("roles").delete().eq("id", role_id);
      if (deleteError) throw deleteError;

      await serviceClient.from("activity_logs").insert({
        user_id: userId,
        action: "role.deleted",
        resource_type: "role",
        resource_id: role_id,
        details: { reassigned_to: reassign_to_role_id ?? null, member_count: memberCount ?? 0 },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("rbac-manage error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
