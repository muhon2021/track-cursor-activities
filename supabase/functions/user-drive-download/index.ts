/**
 * User Drive Download Edge Function
 * Downloads files from user's Google Drive with proper authentication
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";

// deno-lint-ignore no-explicit-any
type AnySupabase = ReturnType<typeof createClient<any, any, any>>;

interface TokenRow {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string | null;
  is_active: boolean;
}

/** Refresh an expired Google OAuth token */
async function refreshGoogleToken(
  supabase: AnySupabase,
  tokenRow: { id: string; refresh_token: string },
): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client credentials not configured");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenRow.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Token refresh failed: ${errText}`);
  }

  const tokens = await response.json();
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

  await supabase
    .from("user_oauth_tokens")
    .update({
      access_token: tokens.access_token,
      expires_at: expiresAt,
      last_refreshed_at: new Date().toISOString(),
      error_message: null,
      error_at: null,
    })
    .eq("id", tokenRow.id);

  return tokens.access_token;
}

/** Get a valid Google access token for the user */
async function getValidAccessToken(
  supabase: AnySupabase,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("user_oauth_tokens")
    .select("id, access_token, refresh_token, expires_at, is_active")
    .eq("user_id", userId)
    .eq("provider_slug", "google-drive")
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw new Error("No Google Drive OAuth token found. Please connect your Google account first.");
  }

  const tokenRow = data as TokenRow;

  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at) : null;
  const isExpired = !expiresAt || expiresAt.getTime() < Date.now() + 5 * 60 * 1000;

  if (isExpired && tokenRow.refresh_token) {
    return await refreshGoogleToken(supabase, { id: tokenRow.id, refresh_token: tokenRow.refresh_token });
  }

  return tokenRow.access_token;
}

/** Get export MIME type for Google Workspace files */
function getExportMimeType(mimeType: string): string {
  const exportMap: Record<string, string> = {
    "application/vnd.google-apps.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.google-apps.presentation": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.google-apps.drawing": "image/png",
  };
  return exportMap[mimeType] || "application/pdf";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate user
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get request body
    const { file_id, mime_type, file_name } = await req.json().catch(() => ({}));

    if (!file_id) {
      return new Response(
        JSON.stringify({ error: "file_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(supabase, user.id);

    // Determine if this is a Google Workspace file
    const isGoogleWorkspaceFile = mime_type?.startsWith("application/vnd.google-apps");

    // Build download URL
    let downloadUrl: string;
    if (isGoogleWorkspaceFile) {
      // Export Google Workspace files
      const exportMimeType = getExportMimeType(mime_type);
      downloadUrl = `${DRIVE_FILES_URL}/${file_id}/export?mimeType=${encodeURIComponent(exportMimeType)}`;
    } else {
      // Download regular files
      downloadUrl = `${DRIVE_FILES_URL}/${file_id}?alt=media`;
    }

    // Fetch file content
    const response = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Drive download failed (${response.status}): ${errText}`);
    }

    // Get file content
    const fileContent = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    // Determine filename
    let filename = file_name || "download";
    if (isGoogleWorkspaceFile && mime_type) {
      const extensionMap: Record<string, string> = {
        "application/vnd.google-apps.document": ".docx",
        "application/vnd.google-apps.spreadsheet": ".xlsx",
        "application/vnd.google-apps.presentation": ".pptx",
        "application/vnd.google-apps.drawing": ".png",
      };
      const ext = extensionMap[mime_type] || ".pdf";
      if (!filename.endsWith(ext)) {
        filename = filename.replace(/\.[^/.]+$/, "") + ext;
      }
    }

    // Return file with proper headers
    return new Response(fileContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error("User Drive Download error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

