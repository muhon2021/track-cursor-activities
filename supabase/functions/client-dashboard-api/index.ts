import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface AuthRequest {
  action: "authenticate" | "get-dashboard" | "submit-feedback" | "get-feedback-history";
  access_token?: string;
  password?: string;
  project_id?: string;
  client_access_id?: string;
  rating?: number;
  feedback_text?: string;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [salt, expectedHash] = storedHash.split(":");
    if (!salt || !expectedHash) return false;
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    const saltData = encoder.encode(salt);
    const key = await crypto.subtle.importKey(
      "raw",
      passwordData,
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltData,
        iterations: 100000,
        hash: "SHA-256",
      },
      key,
      256
    );
    return bufferToHex(hashBuffer) === expectedHash;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: AuthRequest = await req.json();

    if (body.action === "authenticate") {
      if (!body.access_token || !body.password) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing credentials" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { data: accessRecord, error: fetchError } = await supabase
        .from("project_client_access")
        .select("id, project_id, client_email, client_name, password_hash, is_active")
        .eq("access_token", body.access_token)
        .single();

      if (fetchError || !accessRecord) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid credentials" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }

      if (!accessRecord.is_active) {
        return new Response(
          JSON.stringify({ success: false, error: "ACCESS_REVOKED", revoked: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }

      const isValidPassword = await verifyPassword(body.password, accessRecord.password_hash);
      if (!isValidPassword) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid credentials" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }

      const { data: currentStats } = await supabase
        .from("project_client_access")
        .select("login_count")
        .eq("id", accessRecord.id)
        .single();

      await supabase
        .from("project_client_access")
        .update({
          login_count: (currentStats?.login_count || 0) + 1,
          last_login_at: new Date().toISOString(),
        })
        .eq("id", accessRecord.id);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            client_access_id: accessRecord.id,
            project_id: accessRecord.project_id,
            client_email: accessRecord.client_email,
            client_name: accessRecord.client_name,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (body.action === "get-dashboard") {
      if (!body.project_id) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing project_id" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { data: projectRow } = await supabase
        .from("projects")
        .select("id, name, slug, start_date, end_date, budget")
        .eq("id", body.project_id)
        .single();

      const project = projectRow
        ? {
            id: projectRow.id,
            name: projectRow.name,
            client_name: null,
            status: null,
            progress_percentage: 0,
            start_date: projectRow.start_date,
            end_date: projectRow.end_date,
            budget: projectRow.budget,
            estimated_hours: null,
            actual_hours: null,
          }
        : null;

      const { data: milestonesRows } = await supabase
        .from("project_milestones")
        .select("id, title, description, due_date, completed_at, status, sort_order, pm_notes")
        .eq("project_id", body.project_id)
        .order("sort_order", { ascending: true });

      const milestones = (milestonesRows || []).map((m) => ({
        id: m.id,
        name: m.title,
        description: m.description,
        target_date: m.due_date,
        completion_date: m.completed_at,
        status: m.status,
        progress_percentage: m.status === "completed" ? 100 : 0,
        pm_notes: m.pm_notes,
        order_index: m.sort_order,
        amount: null,
        payment_due_date: null,
        invoice_link: null,
        payment_status: null,
      }));

      const { data: risks } = await supabase
        .from("project_risks")
        .select("id, title, description, severity, status, created_at, mitigation")
        .eq("project_id", body.project_id)
        .order("created_at", { ascending: false });

      const risksMapped = (risks || []).map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        priority: r.severity,
        status: r.status,
        identified_at: r.created_at,
        mitigation_plan: r.mitigation,
      }));

      const { data: comments } = await supabase
        .from("project_client_comments")
        .select("id, comment_text, sprint_name, milestone_id, created_at")
        .eq("project_id", body.project_id)
        .eq("is_visible", true)
        .order("created_at", { ascending: false });

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            project,
            sprints: [],
            milestones,
            comments: comments || [],
            risks: risksMapped,
            invoiceSummary: {
              totalAmount: 0,
              paidAmount: 0,
              pendingAmount: 0,
              overdueCount: 0,
            },
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (body.action === "submit-feedback") {
      if (!body.project_id || !body.feedback_text) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required fields" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      const now = new Date();
      const weekNumber = Math.ceil(
        (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 / 7
      );
      const { data, error } = await supabase
        .from("client_feedback")
        .insert({
          project_id: body.project_id,
          client_access_id: body.client_access_id ?? null,
          rating: body.rating ?? null,
          feedback_text: body.feedback_text,
          week_number: weekNumber,
          year: now.getFullYear(),
        })
        .select()
        .single();
      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (body.action === "get-feedback-history") {
      if (!body.project_id) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing project_id" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      let q = supabase
        .from("client_feedback")
        .select("id, rating, feedback_text, week_number, year, created_at")
        .eq("project_id", body.project_id)
        .order("created_at", { ascending: false });
      if (body.client_access_id) {
        q = q.eq("client_access_id", body.client_access_id);
      }
      const { data: feedback } = await q;
      return new Response(
        JSON.stringify({ success: true, data: feedback || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  } catch (error) {
    console.error("client-dashboard-api error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
