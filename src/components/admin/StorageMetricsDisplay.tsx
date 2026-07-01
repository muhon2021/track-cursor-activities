import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { StorageMetrics } from "@/types/storage";
import { Loader2, RefreshCw } from "lucide-react";

interface StorageMetricsDisplayProps {
  metrics?: StorageMetrics;
  providerLabel: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 Bytes";
  }

  const unit = 1024;
  const labels = ["Bytes", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(unit)), labels.length - 1);
  return `${Number((bytes / unit ** index).toFixed(2))} ${labels[index]}`;
}

export function StorageMetricsDisplay({
  metrics,
  providerLabel,
  onRefresh,
  isRefreshing = false,
  className,
}: StorageMetricsDisplayProps): JSX.Element {
  const usedBytes = metrics?.usedBytes ?? 0;
  const totalBytes = metrics?.totalBytes;
  const percentage = totalBytes ? Math.min((usedBytes / totalBytes) * 100, 100) : null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        {percentage !== null ? (
          <>
            <Progress value={percentage} className="h-2" />
            <p className="text-sm text-muted-foreground">
              {formatBytes(usedBytes)} used of {formatBytes(totalBytes)} ({percentage.toFixed(1)}%)
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {formatBytes(usedBytes)} used — No quota limit
          </p>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
        <span>
          {metrics?.lastUpdated
            ? `Last updated: ${new Date(metrics.lastUpdated).toLocaleString()}`
            : `${providerLabel} metrics unavailable`}
        </span>
      </div>
    </div>
  );
}
