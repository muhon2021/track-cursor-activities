import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the calling user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callingUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !callingUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify calling user is admin
    const { data: callerRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .single();

    if (roleError || !callerRole) {
      return new Response(
        JSON.stringify({ error: "User role not found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (callerRole.role !== "admin") {
      return new Response(
        JSON.stringify({
          error: "Forbidden - Only admins can promote users",
          your_role: callerRole.role
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { targetUserId, newRole } = requestBody;

    if (!targetUserId || !newRole) {
      return new Response(
        JSON.stringify({ error: "targetUserId and newRole are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate role
    const validRoles = ["admin", "moderator", "user"];
    if (!validRoles.includes(newRole)) {
      return new Response(
        JSON.stringify({
          error: "Invalid role",
          valid_roles: validRoles,
          provided_role: newRole
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify target user exists
    const { data: targetUserData, error: targetUserError } = await supabase.auth.admin.getUserById(targetUserId);

    if (targetUserError || !targetUserData?.user) {
      return new Response(
        JSON.stringify({ error: "Target user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetUser = targetUserData.user;

    // Check if target user has existing role
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", targetUserId)
      .single();

    const oldRole = existingRole?.role || "none";

    if (existingRole) {
      // Update existing role
      const { error: updateError } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", targetUserId);

      if (updateError) throw updateError;
    } else {
      // Insert new role
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert([{ user_id: targetUserId, role: newRole }]);

      if (insertError) throw insertError;
    }

    // Log the action in activity_logs
    await supabase.from("activity_logs").insert([{
      user_id: callingUser.id,
      action: "user_role_updated",
      entity_type: "user",
      entity_id: targetUserId,
      metadata: {
        old_role: oldRole,
        new_role: newRole,
        target_user_email: targetUser.email,
        admin_email: callingUser.email,
        timestamp: new Date().toISOString()
      },
    }]);

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${targetUser.email} role changed from ${oldRole} to ${newRole}`,
        details: {
          target_user_id: targetUserId,
          target_user_email: targetUser.email,
          old_role: oldRole,
          new_role: newRole,
          changed_by: callingUser.email,
          changed_at: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in promote-to-admin:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Unknown error",
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
