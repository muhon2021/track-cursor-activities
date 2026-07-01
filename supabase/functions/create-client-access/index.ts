import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateClientAccessRequest {
  project_id: string;
  client_email: string;
  client_name?: string;
  project_slug?: string;
}

interface CreateClientAccessResponse {
  success: boolean;
  id?: string;
  access_token?: string;
  password?: string;
  error?: string;
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateSalt(): string {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  return bufferToHex(saltBytes.buffer);
}

async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
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
  return `${salt}:${bufferToHex(hashBuffer)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreateClientAccessRequest = await req.json();

    if (!body.project_id || !body.client_email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "project_id and client_email are required",
        } as CreateClientAccessResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const password = generatePassword();
    const passwordHash = await hashPassword(password);
    const accessToken = crypto.randomUUID();

    const { data: existing } = await supabase
      .from("project_client_access")
      .select("id")
      .eq("project_id", body.project_id)
      .eq("client_email", body.client_email)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("project_client_access")
        .update({
          password_hash: passwordHash,
          access_token: accessToken,
          is_active: true,
          project_slug: body.project_slug ?? null,
          client_name: body.client_name ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          id: existing.id,
          access_token: accessToken,
          password,
        } as CreateClientAccessResponse),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const { data: inserted, error } = await supabase
      .from("project_client_access")
      .insert({
        project_id: body.project_id,
        client_email: body.client_email,
        client_name: body.client_name ?? null,
        password_hash: passwordHash,
        access_token: accessToken,
        project_slug: body.project_slug ?? null,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        id: inserted?.id,
        access_token: accessToken,
        password,
      } as CreateClientAccessResponse),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("create-client-access error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as CreateClientAccessResponse),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
