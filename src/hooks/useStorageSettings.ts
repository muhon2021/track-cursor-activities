import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { cacheConfig } from "@/lib/cache";
import { emptyStorageMetrics, maskSecret, parseStorageMetrics } from "@/lib/storageMask";
import { toast } from "sonner";
import type {
  StorageMetricsBundle,
  StorageProvider,
  StorageSettingsResponse,
  TestS3ConnectionInput,
  TestSupabaseConnectionInput,
  UpdateStorageSettingsInput,
} from "@/types/storage";

const STORAGE_SETTINGS_KEY = ["storage", "settings"] as const;

interface StorageConfigRow {
  id: string;
  storage_type: StorageProvider;
  aws_access_key_id: string | null;
  aws_secret_access_key: string | null;
  aws_region: string;
  s3_bucket_name: string | null;
  supabase_storage_bucket: string;
  supabase_storage_public: boolean;
}

async function parseFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const json = await error.context.json() as { message?: string };
      return json.message ?? "Request failed";
    } catch {
      return "Request failed";
    }
  }

  return error instanceof Error ? error.message : "Unknown error";
}

async function ensureStorageConfigRow(): Promise<StorageConfigRow> {
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

async function fetchStorageMetrics(): Promise<StorageMetricsBundle> {
  const { data, error } = await supabase.rpc("get_storage_metrics");

  if (error) {
    console.warn("Storage metrics RPC unavailable:", error.message);
    return emptyStorageMetrics();
  }

  return parseStorageMetrics(data);
}

function mapConfigToResponse(
  config: StorageConfigRow,
  metrics: StorageMetricsBundle,
): StorageSettingsResponse {
  return {
    storageType: config.storage_type,
    s3: {
      accessKeyIdMasked: maskSecret(config.aws_access_key_id),
      secretAccessKeyMasked: maskSecret(config.aws_secret_access_key),
      bucketNameMasked: maskSecret(config.s3_bucket_name),
      secretAccessKeySet: Boolean(config.aws_secret_access_key),
      region: config.aws_region,
      storageType: config.storage_type,
    },
    supabase: {
      bucketNameMasked: maskSecret(config.supabase_storage_bucket),
      bucketName: config.supabase_storage_bucket,
      isPublic: config.supabase_storage_public,
      storageType: config.storage_type,
    },
    metrics,
  };
}

export function useStorageSettings() {
  return useQuery({
    queryKey: STORAGE_SETTINGS_KEY,
    queryFn: async (): Promise<StorageSettingsResponse> => {
      const [config, metrics] = await Promise.all([
        ensureStorageConfigRow(),
        fetchStorageMetrics(),
      ]);

      return mapConfigToResponse(config, metrics);
    },
    staleTime: cacheConfig.staleTime.medium,
  });
}

export function useUpdateStorageSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateStorageSettingsInput): Promise<StorageSettingsResponse> => {
      const current = await ensureStorageConfigRow();
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.storageType) {
        updatePayload.storage_type = input.storageType;
      }
      if (input.accessKeyId) {
        updatePayload.aws_access_key_id = input.accessKeyId;
      }
      if (input.secretAccessKey) {
        updatePayload.aws_secret_access_key = input.secretAccessKey;
      }
      if (input.region) {
        updatePayload.aws_region = input.region;
      }
      if (input.bucketName) {
        updatePayload.s3_bucket_name = input.bucketName;
      }
      if (input.supabaseBucketName) {
        updatePayload.supabase_storage_bucket = input.supabaseBucketName;
      }
      if (input.supabaseStoragePublic !== undefined) {
        updatePayload.supabase_storage_public = input.supabaseStoragePublic;
      }

      const { data, error } = await supabase
        .from("storage_config")
        .update(updatePayload)
        .eq("id", current.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const metrics = await fetchStorageMetrics();
      return mapConfigToResponse(data as StorageConfigRow, metrics);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STORAGE_SETTINGS_KEY });
      queryClient.invalidateQueries({ queryKey: ["storage", "active-type"] });
      toast.success("Storage configuration saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save storage configuration");
    },
  });
}

export function useTestS3Connection() {
  return useMutation({
    mutationFn: async (input: TestS3ConnectionInput): Promise<string> => {
      const { data, error } = await supabase.functions.invoke("storage-settings", {
        body: { action: "test", ...input },
      });

      if (error) {
        throw new Error(await parseFunctionError(error));
      }

      const result = data as { success?: boolean; message?: string };
      if (!result.success) {
        throw new Error(result.message ?? "S3 connection test failed");
      }

      return result.message ?? "AWS S3 connection successful";
    },
    onSuccess: (message) => {
      toast.success(message);
    },
    onError: (error: Error) => {
      toast.error(error.message || "S3 connection test failed");
    },
  });
}

export function useTestSupabaseConnection() {
  return useMutation({
    mutationFn: async (input: TestSupabaseConnectionInput): Promise<string> => {
      const { data, error } = await supabase.functions.invoke("storage-settings", {
        body: { action: "test", ...input },
      });

      if (error) {
        throw new Error(await parseFunctionError(error));
      }

      const result = data as { success?: boolean; message?: string };
      if (!result.success) {
        throw new Error(result.message ?? "Supabase connection test failed");
      }

      return result.message ?? "Supabase storage connection successful";
    },
    onSuccess: (message) => {
      toast.success(message);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Supabase connection test failed");
    },
  });
}

export function useRefreshStorageMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<StorageMetricsBundle> => fetchStorageMetrics(),
    onSuccess: (metrics) => {
      queryClient.setQueryData<StorageSettingsResponse | undefined>(STORAGE_SETTINGS_KEY, (current) => {
        if (!current) {
          return current;
        }

        return { ...current, metrics };
      });
      toast.success("Storage metrics refreshed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to refresh storage metrics");
    },
  });
}
