import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatTimeoutAlertProps {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
}

export function ChatTimeoutAlert({
  message = "The request timed out or the network connection was interrupted. Your message was not delivered.",
  onRetry,
  retrying = false,
  className,
}: ChatTimeoutAlertProps) {
  return (
    <Alert
      className={cn(
        "border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100",
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900 dark:text-amber-50">
        Connection issue
      </AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <span className="text-sm text-amber-900/90 dark:text-amber-100/90">
          {message}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 border-amber-600/40 hover:bg-amber-500/20"
          onClick={onRetry}
          disabled={retrying}
        >
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", retrying && "animate-spin")} />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function isNetworkOrTimeoutError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: string }).message === "string"
        ? (error as { message: string }).message
        : String(error);

  const lower = message.toLowerCase();
  return (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("failed to fetch") ||
    lower.includes("connection") ||
    lower.includes("aborted") ||
    lower.includes("503") ||
    lower.includes("504")
  );
}
