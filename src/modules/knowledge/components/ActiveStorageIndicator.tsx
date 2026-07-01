import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Cloud, Database, HardDrive, Loader2 } from "lucide-react";
import {
  STORAGE_PROVIDER_DESCRIPTIONS,
  STORAGE_PROVIDER_LABELS,
  useActiveStorageType,
} from "../hooks/useActiveStorageType";
import type { StorageProvider } from "@/types/storage";

interface ActiveStorageIndicatorProps {
  compact?: boolean;
  className?: string;
}

function ProviderIcon({ provider, className }: { provider: StorageProvider; className?: string }): JSX.Element {
  if (provider === "s3") {
    return <Cloud className={className} />;
  }

  if (provider === "supabase") {
    return <Database className={className} />;
  }

  return <HardDrive className={className} />;
}

function getProviderDetail(
  provider: StorageProvider,
  supabaseStorageBucket: string,
): string {
  if (provider === "supabase") {
    return `${STORAGE_PROVIDER_DESCRIPTIONS.supabase} (${supabaseStorageBucket})`;
  }

  return STORAGE_PROVIDER_DESCRIPTIONS[provider];
}

export function ActiveStorageIndicator({
  compact = false,
  className,
}: ActiveStorageIndicatorProps): JSX.Element {
  const { data, isLoading, isError } = useActiveStorageType();

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking active storage...</span>
      </div>
    );
  }

  const storageType = data?.storageType ?? "local";
  const label = STORAGE_PROVIDER_LABELS[storageType];
  const detail = getProviderDetail(storageType, data?.supabaseStorageBucket ?? "knowledgebase");

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <ProviderIcon provider={storageType} className="h-4 w-4 shrink-0" />
        <span>
          Uploads stored in{" "}
          <Badge variant="secondary" className="ml-1">
            {label}
          </Badge>
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-primary/15 bg-primary/5 px-4 py-3",
        className,
      )}
    >
      <ProviderIcon provider={storageType} className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Active storage</span>
          <Badge variant="secondary">{label}</Badge>
          {isError && (
            <Badge variant="outline" className="text-muted-foreground">
              Using default
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
