import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { testS3ConnectionFast } from "../_shared/s3-sigv4.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface StorageConfigRow {
  storage_type: "local" | "s3" | "supabase";
  aws_access_key_id: string | null;
  aws_secret_access_key: string | null;
  aws_region: string;
  s3_bucket_name: string | null;
  supabase_storage_bucket: string;
  supabase_storage_public: boolean;
}

interface StorageSettingsRequestBody {
  action?: "test";
  provider?: "s3" | "supabase";
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  bucketName?: string;
  supabaseBucketName?: string;
  supabaseStoragePublic?: boolean;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

async function requireAdminUser(req: Request, supabase: ReturnType<typeof createServiceClient>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw jsonResponse({ success: false, message: "Missing authorization header" }, 401);
  }

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !user) {
    throw jsonResponse({ success: false, message: "Invalid token" }, 401);
  }

  const { data: adminRole, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError || !adminRole) {
    throw jsonResponse({ success: false, message: "Admin access required" }, 403);
  }

  return user;
}

async function getStorageConfig(supabase: ReturnType<typeof createServiceClient>): Promise<StorageConfigRow> {
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

async function testSupabaseConnection(config: StorageConfigRow): Promise<string> {
  const bucket = config.supabase_storage_bucket || "knowledgebase";
  const supabase = createServiceClient();
  const testPath = `.health-check/.test-${Date.now()}.txt`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(testPath, new TextEncoder().encode("storage health check"), {
      contentType: "text/plain",
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { error: deleteError } = await supabase.storage.from(bucket).remove([testPath]);
  if (deleteError) {
    throw deleteError;
  }

  return "Supabase storage connection successful";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  try {
    const supabase = createServiceClient();
    await requireAdminUser(req, supabase);

    const body = await req.json() as StorageSettingsRequestBody;
    if (body.action !== "test") {
      return jsonResponse({ success: false, message: "Unsupported action" }, 400);
    }

    const current = await getStorageConfig(supabase);

    if (body.provider === "s3") {
      const accessKeyId = body.accessKeyId || current.aws_access_key_id;
      const secretAccessKey = body.secretAccessKey || current.aws_secret_access_key;
      const region = body.region || current.aws_region || "us-east-1";
      const bucketName = body.bucketName || current.s3_bucket_name;

      if (!accessKeyId || !secretAccessKey) {
        return jsonResponse({ success: false, message: "AWS access key and secret access key are required" }, 400);
      }
      if (!bucketName) {
        return jsonResponse({ success: false, message: "S3 bucket name is required" }, 400);
      }

      const message = await testS3ConnectionFast({
        accessKeyId,
        secretAccessKey,
        region,
        bucketName,
      });
      return jsonResponse({ success: true, message });
    }

    if (body.provider === "supabase") {
      const testConfig: StorageConfigRow = {
        ...current,
        supabase_storage_bucket: body.supabaseBucketName || current.supabase_storage_bucket,
        supabase_storage_public: body.supabaseStoragePublic ?? current.supabase_storage_public,
      };

      const message = await testSupabaseConnection(testConfig);
      return jsonResponse({ success: true, message });
    }

    return jsonResponse({ success: false, message: "Provider is required" }, 400);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("storage-settings error:", error);
    return jsonResponse({ success: false, message }, 500);
  }
});
