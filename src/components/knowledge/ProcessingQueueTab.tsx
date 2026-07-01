import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

interface ProcessingStats {
  total_files: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total_size?: number;
}

interface ProcessingQueueTabProps {
  stats: ProcessingStats;
  onProcessPending?: () => void;
  isProcessing?: boolean;
  loading?: boolean;
}

export function ProcessingQueueTab({
  stats,
  onProcessPending,
  isProcessing = false,
  loading = false,
}: ProcessingQueueTabProps) {
  const getStatusBadge = (status: string, count: number) => {
    const config: Record<
      string,
      { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }
    > = {
      pending: { variant: "outline", icon: Loader2 },
      processing: { variant: "default", icon: Loader2 },
      completed: { variant: "secondary", icon: CheckCircle2 },
      failed: { variant: "destructive", icon: AlertCircle },
    };
    const { variant, icon: Icon } = config[status] || config.pending;

    return (
      <Badge variant={variant} className="flex items-center gap-1 w-fit">
        <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
        {count}
      </Badge>
    );
  };

  const completionPercentage = stats.total_files > 0
    ? Math.round((stats.completed / stats.total_files) * 100)
    : 0;

  const pendingCount = stats.pending + stats.processing;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Processing Queue</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Processing Queue</CardTitle>
            <CardDescription>
              {pendingCount} file{pendingCount !== 1 ? "s" : ""} waiting to be processed
            </CardDescription>
          </div>
          {onProcessPending && (
            <Button
              variant="outline"
              size="sm"
              onClick={onProcessPending}
              disabled={isProcessing || pendingCount === 0}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Process Pending
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Completion</span>
            <span className="font-medium">{completionPercentage}%</span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total_files}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Completed</p>
            <div className="flex items-center gap-2">
              {getStatusBadge("completed", stats.completed)}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Processing</p>
            <div className="flex items-center gap-2">
              {getStatusBadge("processing", stats.processing)}
              {stats.pending > 0 && (
                <span className="text-xs text-muted-foreground">
                  (+{stats.pending} pending)
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Failed</p>
            <div className="flex items-center gap-2">
              {getStatusBadge("failed", stats.failed)}
            </div>
          </div>
        </div>

        {/* Status Summary */}
        {pendingCount > 0 && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-900/20">
            <div className="flex items-start gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-yellow-600 dark:text-yellow-400" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Processing in Progress
                </h4>
                <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                  {pendingCount} file{pendingCount !== 1 ? "s are" : " is"} currently being
                  processed or waiting in queue. Embeddings will be generated automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {stats.failed > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Processing Errors
                </h4>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  {stats.failed} file{stats.failed !== 1 ? "s" : ""} failed to process. Check the
                  file list for error details.
                </p>
              </div>
            </div>
          </div>
        )}

        {stats.completed === stats.total_files && stats.total_files > 0 && (
          <div className="rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-green-800 dark:text-green-200">
                  All Files Processed
                </h4>
                <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                  All {stats.total_files} file{stats.total_files !== 1 ? "s have" : " has"} been
                  successfully processed and indexed for semantic search.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
