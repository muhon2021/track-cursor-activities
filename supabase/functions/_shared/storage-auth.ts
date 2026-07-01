import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export interface StorageConfigRow {
  id: string;
  storage_type: "local" | "s3" | "supabase";
  aws_access_key_id: string | null;
  aws_secret_access_key: string | null;
  aws_region: string;
  s3_bucket_name: string | null;
  supabase_storage_bucket: string;
  supabase_storage_public: boolean;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(supabaseUrl, supabaseKey);
}

export async function requireAuthenticatedUser(
  req: Request,
  supabase: SupabaseClient,
): Promise<{ id: string; email?: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Response(JSON.stringify({ success: false, message: "Missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !user) {
    throw new Response(JSON.stringify({ success: false, message: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return { id: user.id, email: user.email };
}

export async function requireAdminUser(
  req: Request,
  supabase: SupabaseClient,
): Promise<{ id: string; email?: string }> {
  const user = await requireAuthenticatedUser(req, supabase);

  const { data: adminRole, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (error || !adminRole) {
    throw new Response(JSON.stringify({ success: false, message: "Admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return user;
}

export function maskSecret(value: string | null | undefined, visibleChars = 2): string {
  if (!value || value.length <= visibleChars * 2) {
    return value ? "*".repeat(Math.max(value.length, 4)) : "";
  }

  const start = value.slice(0, visibleChars);
  const end = value.slice(-visibleChars);
  const maskedLength = Math.max(value.length - visibleChars * 2, 4);
  return `${start}${"*".repeat(maskedLength)}${end}`;
}

export async function getStorageConfig(supabase: SupabaseClient): Promise<StorageConfigRow> {
  const { data, error } = await supabase
    .from("storage_config")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as StorageConfigRow;
  }

  const { data: created, error: createError } = await supabase
    .from("storage_config")
    .insert({
      storage_type: "local",
      aws_region: "us-east-1",
      supabase_storage_bucket: "knowledgebase",
      supabase_storage_public: true,
    })
    .select("*")
    .single();

  if (createError) {
    throw createError;
  }

  return created as StorageConfigRow;
}
