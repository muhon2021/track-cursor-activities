import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StorageProvider } from "@/types/storage";
import type { KnowledgeStorageType } from "../api/file";

export interface ActiveStorageConfig {
  storageType: StorageProvider;
  supabaseStorageBucket: string;
}

export const STORAGE_PROVIDER_LABELS: Record<StorageProvider, string> = {
  local: "Local Storage",
  s3: "AWS S3",
  supabase: "Supabase Storage",
};

export const STORAGE_PROVIDER_DESCRIPTIONS: Record<StorageProvider, string> = {
  local: "New uploads are saved to the application's default local storage.",
  s3: "New uploads are saved to the configured AWS S3 bucket.",
  supabase: "New uploads are saved to the configured Supabase Storage bucket.",
};

function parseStorageType(value: unknown): StorageProvider {
  if (value === "s3" || value === "supabase" || value === "local") {
    return value;
  }

  return "local";
}

export function isFileOnActiveStorage(
  fileStorageType: KnowledgeStorageType | undefined,
  activeStorageType: StorageProvider,
): boolean {
  return (fileStorageType ?? "local") === activeStorageType;
}

export function useActiveStorageType() {
  return useQuery({
    queryKey: ["storage", "active-type"],
    queryFn: async (): Promise<ActiveStorageConfig> => {
      const { data, error } = await supabase
        .from("storage_config_public")
        .select("storage_type, supabase_storage_bucket")
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return {
        storageType: parseStorageType(data?.storage_type),
        supabaseStorageBucket: data?.supabase_storage_bucket ?? "knowledgebase",
      };
    },
    staleTime: 60_000,
  });
}
