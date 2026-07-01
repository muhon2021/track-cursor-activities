import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { StorageConfigRow } from "./storage-auth.ts";
import {
  createPresignedGetUrl,
  deleteS3Object,
  putS3Object,
  testS3ConnectionFast,
} from "./s3-sigv4.ts";

const LOCAL_BUCKET = "knowledgebase";

export interface UploadPayload {
  buffer: Uint8Array;
  storagePath: string;
  mimeType: string;
  fileName: string;
}

export interface UploadResult {
  path: string;
  url: string;
  storageType: "local" | "s3" | "supabase";
  s3Key?: string | null;
  storagePath?: string | null;
}

function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function requireS3Credentials(config: StorageConfigRow): {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
} {
  if (!config.aws_access_key_id || !config.aws_secret_access_key || !config.aws_region) {
    throw new Error("AWS credentials are not configured");
  }
  if (!config.s3_bucket_name) {
    throw new Error("S3 bucket name is not configured");
  }

  return {
    accessKeyId: config.aws_access_key_id,
    secretAccessKey: config.aws_secret_access_key,
    region: config.aws_region,
    bucketName: config.s3_bucket_name,
  };
}

export async function testS3Connection(config: StorageConfigRow): Promise<string> {
  const credentials = requireS3Credentials(config);
  return testS3ConnectionFast({
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    region: credentials.region,
    bucketName: credentials.bucketName,
  });
}

export async function testSupabaseConnection(config: StorageConfigRow): Promise<string> {
  const bucket = config.supabase_storage_bucket || LOCAL_BUCKET;
  const supabase = getSupabaseAdmin();
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

export async function uploadToActiveStorage(
  config: StorageConfigRow,
  payload: UploadPayload,
): Promise<UploadResult> {
  const storagePath = `knowledgebase/${payload.storagePath}`;

  if (config.storage_type === "s3") {
    const credentials = requireS3Credentials(config);
    const s3Key = storagePath;

    await putS3Object({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      region: credentials.region,
      bucketName: credentials.bucketName,
      key: s3Key,
      body: payload.buffer,
      mimeType: payload.mimeType,
    });

    const signedUrl = await createPresignedGetUrl({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      region: credentials.region,
      bucketName: credentials.bucketName,
      key: s3Key,
      expiresIn: 86400,
    });

    return {
      path: s3Key,
      url: signedUrl,
      storageType: "s3",
      s3Key,
      storagePath: null,
    };
  }

  if (config.storage_type === "supabase") {
    const bucket = config.supabase_storage_bucket || LOCAL_BUCKET;
    const supabase = getSupabaseAdmin();
    const remotePath = storagePath;

    const { error } = await supabase.storage.from(bucket).upload(remotePath, payload.buffer, {
      contentType: payload.mimeType,
      upsert: false,
    });

    if (error) {
      throw error;
    }

    const url = config.supabase_storage_public
      ? supabase.storage.from(bucket).getPublicUrl(remotePath).data.publicUrl
      : (await supabase.storage.from(bucket).createSignedUrl(remotePath, 86400)).data?.signedUrl ?? "";

    return {
      path: remotePath,
      url,
      storageType: "supabase",
      s3Key: null,
      storagePath: remotePath,
    };
  }

  const supabase = getSupabaseAdmin();
  const localPath = payload.storagePath;

  const { error } = await supabase.storage.from(LOCAL_BUCKET).upload(localPath, payload.buffer, {
    contentType: payload.mimeType,
    upsert: true,
  });

  if (error) {
    throw error;
  }

  const { data: publicUrlData } = supabase.storage.from(LOCAL_BUCKET).getPublicUrl(localPath);

  return {
    path: localPath,
    url: publicUrlData.publicUrl,
    storageType: "local",
    s3Key: null,
    storagePath: localPath,
  };
}

export async function deleteFromStorage(
  storageType: "local" | "s3" | "supabase",
  config: StorageConfigRow,
  path: string,
  s3Key?: string | null,
  storagePath?: string | null,
): Promise<void> {
  if (storageType === "s3") {
    if (!s3Key) {
      return;
    }

    const credentials = requireS3Credentials(config);
    await deleteS3Object({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      region: credentials.region,
      bucketName: credentials.bucketName,
      key: s3Key,
    });
    return;
  }

  const supabase = getSupabaseAdmin();
  const bucket = storageType === "supabase"
    ? (config.supabase_storage_bucket || LOCAL_BUCKET)
    : LOCAL_BUCKET;
  const objectPath = storagePath ?? path;

  if (objectPath) {
    await supabase.storage.from(bucket).remove([objectPath]);
  }
}

export async function getDownloadUrl(
  storageType: "local" | "s3" | "supabase",
  config: StorageConfigRow,
  path: string,
  s3Key?: string | null,
  storagePath?: string | null,
): Promise<string> {
  if (storageType === "s3" && s3Key) {
    const credentials = requireS3Credentials(config);
    return createPresignedGetUrl({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      region: credentials.region,
      bucketName: credentials.bucketName,
      key: s3Key,
      expiresIn: 3600,
    });
  }

  const supabase = getSupabaseAdmin();
  const bucket = storageType === "supabase"
    ? (config.supabase_storage_bucket || LOCAL_BUCKET)
    : LOCAL_BUCKET;
  const objectPath = storagePath ?? path;

  if (storageType === "supabase" && !config.supabase_storage_public) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 3600);
    if (error) {
      throw error;
    }
    return data.signedUrl;
  }

  return supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
}
