import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user exists
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = userData.user;

    // Check if user already has a role
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (existingRole) {
      // Update existing role to admin
      const { error: updateError } = await supabase
        .from("user_roles")
        .update({ role: "admin" })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({
          success: true,
          message: `User ${user.email} role updated to admin`,
          previous_role: existingRole.role,
          new_role: "admin"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Insert new admin role
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert([{ user_id: userId, role: "admin" }]);

      if (insertError) throw insertError;

      // Log the action
      await supabase.from("activity_logs").insert([{
        user_id: userId,
        action: "user_role_assigned",
        entity_type: "user",
        entity_id: userId,
        metadata: {
          role: "admin",
          method: "promote-first-admin-function"
        },
      }]);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Admin role granted to ${user.email}`,
          user_id: userId,
          email: user.email,
          role: "admin"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("Error in promote-first-admin:", error);
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
