export type StorageProvider = "local" | "s3" | "supabase";

export interface StorageMetrics {
  provider: StorageProvider;
  usedBytes: number;
  totalBytes: number | null;
  lastUpdated: string;
  isStale: boolean;
}

export interface StorageMetricsBundle {
  root?: StorageMetrics;
  s3?: StorageMetrics;
  supabase?: StorageMetrics;
}

export interface S3StorageSettings {
  accessKeyIdMasked: string;
  secretAccessKeyMasked: string;
  bucketNameMasked: string;
  secretAccessKeySet: boolean;
  region: string;
  storageType: StorageProvider;
}

export interface SupabaseStorageSettings {
  bucketNameMasked: string;
  bucketName: string;
  isPublic: boolean;
  storageType: StorageProvider;
}

export interface StorageSettingsResponse {
  storageType: StorageProvider;
  s3: S3StorageSettings;
  supabase: SupabaseStorageSettings;
  metrics: StorageMetricsBundle;
}

export interface UpdateStorageSettingsInput {
  storageType?: StorageProvider;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  bucketName?: string;
  supabaseBucketName?: string;
  supabaseStoragePublic?: boolean;
}

export interface TestS3ConnectionInput {
  provider: "s3";
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  bucketName?: string;
}

export interface TestSupabaseConnectionInput {
  provider: "supabase";
  supabaseBucketName?: string;
  supabaseStoragePublic?: boolean;
}
