import type { StorageMetricsBundle, StorageProvider } from "@/types/storage";

export function maskSecret(value: string | null | undefined, visibleChars = 2): string {
  if (!value || value.length <= visibleChars * 2) {
    return value ? "*".repeat(Math.max(value.length, 4)) : "";
  }

  const start = value.slice(0, visibleChars);
  const end = value.slice(-visibleChars);
  const maskedLength = Math.max(value.length - visibleChars * 2, 4);
  return `${start}${"*".repeat(maskedLength)}${end}`;
}

export function emptyStorageMetrics(): StorageMetricsBundle {
  const now = new Date().toISOString();
  const base = (provider: StorageProvider) => ({
    provider,
    usedBytes: 0,
    totalBytes: null,
    lastUpdated: now,
    isStale: false,
  });

  return {
    root: base("local"),
    s3: base("s3"),
    supabase: base("supabase"),
  };
}

export function parseStorageMetrics(value: unknown): StorageMetricsBundle {
  if (!value || typeof value !== "object") {
    return emptyStorageMetrics();
  }

  const record = value as Record<string, unknown>;
  const readMetric = (key: string, provider: StorageProvider) => {
    const metric = record[key];
    if (!metric || typeof metric !== "object") {
      return {
        provider,
        usedBytes: 0,
        totalBytes: null,
        lastUpdated: new Date().toISOString(),
        isStale: false,
      };
    }

    const metricRecord = metric as Record<string, unknown>;
    return {
      provider,
      usedBytes: typeof metricRecord.usedBytes === "number" ? metricRecord.usedBytes : 0,
      totalBytes: typeof metricRecord.totalBytes === "number" ? metricRecord.totalBytes : null,
      lastUpdated: typeof metricRecord.lastUpdated === "string"
        ? metricRecord.lastUpdated
        : new Date().toISOString(),
      isStale: Boolean(metricRecord.isStale),
    };
  };

  return {
    root: readMetric("root", "local"),
    s3: readMetric("s3", "s3"),
    supabase: readMetric("supabase", "supabase"),
  };
}
