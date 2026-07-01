import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

const SUPPORTED_EXPORTS: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.presentation": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/plain",
  "application/pdf": "text/plain",
  "text/plain": "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "text/plain",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "text/plain",
};

/**
 * Get Google Drive access token from service account JSON
 */
export async function getAccessTokenFromServiceAccount(serviceAccountJson: string): Promise<string> {
  let jsonStr = serviceAccountJson.trim();

  // Try base64 decode if it doesn't look like JSON
  if (!jsonStr.startsWith('{') && !jsonStr.startsWith('"')) {
    try {
      jsonStr = atob(jsonStr);
    } catch {
      // Not base64 encoded
    }
  }

  // Handle double-encoded JSON
  if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
    try {
      jsonStr = JSON.parse(jsonStr);
    } catch {
      // Not double-encoded
    }
  }

  // Remove BOM and invisible characters
  jsonStr = jsonStr.replace(/^\uFEFF/, '').replace(/^\u200B/, '');

  const serviceAccount = JSON.parse(jsonStr);

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("Service account JSON missing client_email or private_key");
  }

  // Convert PEM private key to CryptoKey (proper base64 decoding)
  const pemKey = serviceAccount.private_key;
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: getNumericDate(3600),
      iat: getNumericDate(0),
    },
    cryptoKey,
  );

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Download file content from Google Drive
 * @param fileId - Google Drive file ID
 * @param fileName - File name for logging
 * @param mimeType - File MIME type
 * @param accessToken - Google Drive access token
 * @returns File content as string, or null if unsupported format
 */
export async function downloadFileContent(
  fileId: string,
  fileName: string,
  mimeType: string,
  accessToken: string
): Promise<string | null> {
  const exportMime = SUPPORTED_EXPORTS[mimeType];
  if (!exportMime) {
    console.log(`[google-drive] Unsupported MIME type for ${fileName}: ${mimeType}`);
    return null;
  }

  const baseUrl = "https://www.googleapis.com/drive/v3/files";

  // Google Workspace files need to be exported
  const isGoogleWorkspaceFile = mimeType.startsWith("application/vnd.google-apps");

  const endpoint = isGoogleWorkspaceFile
    ? `${baseUrl}/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`
    : `${baseUrl}/${fileId}?alt=media`;

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error(`[google-drive] Failed to download ${fileName} (${fileId}): ${response.status}`);
    return null;
  }

  const content = await response.text();
  console.log(`[google-drive] Downloaded ${fileName}: ${content.length} characters`);

  return content;
}

/**
 * Check if a MIME type is supported for content extraction
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return mimeType in SUPPORTED_EXPORTS;
}
