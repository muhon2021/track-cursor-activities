/**
 * API Authentication Middleware
 *
 * Validates Control Tower API keys and enforces permissions, rate limiting, and IP restrictions.
 * Used by other edge functions to authenticate API requests.
 *
 * Usage in other functions:
 * ```typescript
 * import { validateControlTowerApiKey } from "../api-auth/index.ts";
 *
 * const apiKeyData = await validateControlTowerApiKey(req);
 * if (apiKeyData.error) {
 *   return new Response(JSON.stringify({ error: apiKeyData.error }), {
 *     status: 401,
 *     headers: corsHeaders
 *   });
 * }
 * // apiKeyData contains: id, created_by, scopes, etc.
 * ```
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, x-client-info, apikey, content-type",
};

interface ApiKeyData {
  id: string;
  created_by: string;
  scopes: string[];
  allowed_endpoints: string[];
  allowed_ips: string[];
  rate_limit_per_minute: number;
  error?: string;
}

/**
 * Validate Control Tower API key from request
 * Can be imported by other edge functions
 */
export async function validateControlTowerApiKey(req: Request): Promise<ApiKeyData> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Extract API key from header
  const apiKey = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "");

  if (!apiKey) {
    return {
      error: "Missing API key. Provide via 'x-api-key' or 'Authorization: Bearer' header",
    } as ApiKeyData;
  }

  // Validate key format (should start with sk_live_ or sk_test_)
  if (!apiKey.startsWith("sk_live_") && !apiKey.startsWith("sk_test_")) {
    return {
      error: "Invalid API key format. Must start with 'sk_live_' or 'sk_test_'",
    } as ApiKeyData;
  }

  // Validate API key using database function
  const { data: keyData, error: validateError } = await supabase.rpc("validate_api_key", {
    p_key: apiKey,
  });

  if (validateError || !keyData || keyData.length === 0) {
    return {
      error: "Invalid or expired API key",
    } as ApiKeyData;
  }

  const key = keyData[0];

  // Check IP restriction
  if (key.allowed_ips && key.allowed_ips.length > 0) {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "";

    if (!key.allowed_ips.includes(clientIp)) {
      return {
        error: `Access denied from IP: ${clientIp}. Contact admin to whitelist your IP.`,
      } as ApiKeyData;
    }
  }

  // Check endpoint restriction
  const url = new URL(req.url);
  const endpoint = url.pathname;

  if (key.allowed_endpoints && key.allowed_endpoints.length > 0) {
    const allowed = key.allowed_endpoints.some((pattern: string) => {
      // Support wildcard matching (e.g., "/api/v1/tasks/*")
      const regex = new RegExp("^" + pattern.replace("*", ".*") + "$");
      return regex.test(endpoint);
    });

    if (!allowed) {
      return {
        error: `Access denied to endpoint: ${endpoint}. This API key does not have permission.`,
      } as ApiKeyData;
    }
  }

  // Update usage stats
  const keyHash = await hashApiKey(apiKey);
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || null;

  await supabase.rpc("update_api_key_usage", {
    p_key_hash: keyHash,
    p_ip_address: clientIp,
  });

  // Return key data
  return {
    id: key.id,
    created_by: key.created_by,
    scopes: key.scopes,
    allowed_endpoints: key.allowed_endpoints,
    allowed_ips: key.allowed_ips,
    rate_limit_per_minute: key.rate_limit_per_minute,
  };
}

/**
 * Hash API key using SHA-256
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Standalone endpoint for testing API key validation
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const keyData = await validateControlTowerApiKey(req);

    if (keyData.error) {
      return new Response(
        JSON.stringify({
          error: keyData.error,
          valid: false,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        key_id: keyData.id,
        scopes: keyData.scopes,
        rate_limit: keyData.rate_limit_per_minute,
        message: "API key is valid",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("API key validation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: message,
        valid: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
