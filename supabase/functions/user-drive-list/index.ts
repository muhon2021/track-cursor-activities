/**
 * User Drive List Edge Function
 * Lists files and folders from user's Google Drive
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

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
}

/** List files from Google Drive (root or specific folder) */
async function listDriveFiles(
  accessToken: string,
  folderId?: string,
): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    // Build query: if folderId is provided, list files in that folder; otherwise list root files
    const query = folderId
      ? `'${folderId}' in parents and trashed = false`
      : "trashed = false and 'root' in parents";

    const params = new URLSearchParams({
      q: query,
      fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink,thumbnailLink)",
      pageSize: "100",
      orderBy: "modifiedTime desc",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(`${DRIVE_FILES_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Drive list failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    allFiles.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allFiles;
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
    const { folder_id } = await req.json().catch(() => ({}));

    // Get valid access token
    const accessToken = await getValidAccessToken(supabase, user.id);

    // List files
    const files = await listDriveFiles(accessToken, folder_id);

    // Separate folders and files
    const folders = files.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
    const regularFiles = files.filter((f) => f.mimeType !== "application/vnd.google-apps.folder");

    return new Response(
      JSON.stringify({
        success: true,
        files: regularFiles,
        folders: folders,
        total: files.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("User Drive List error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

