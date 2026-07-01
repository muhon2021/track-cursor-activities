import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  type EmailValidationState,
  useEmailValidation,
} from "@/lib/email-validator";

interface EmailValidationIndicatorProps {
  email: string;
  onValidationChange: (result: EmailValidationState) => void;
  className?: string;
}

type BadgeStatus = "pass" | "fail" | "pending" | "idle";

interface StatusBadgeProps {
  label: string;
  status: BadgeStatus;
}

function StatusBadge({ label, status }: StatusBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        status === "pass" && "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
        status === "fail" && "border-destructive/30 bg-destructive/10 text-destructive",
        status === "pending" && "border-muted bg-muted/50 text-muted-foreground",
        status === "idle" && "border-muted bg-muted/30 text-muted-foreground"
      )}
    >
      {status === "pass" ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : status === "fail" ? (
        <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : status === "pending" ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-muted-foreground/40" aria-hidden="true" />
      )}
      <span>{label}</span>
    </div>
  );
}

function getFormatBadgeStatus(formatValid: boolean): BadgeStatus {
  return formatValid ? "pass" : "fail";
}

function getDisposableBadgeStatus(isDisposable: boolean, formatValid: boolean): BadgeStatus {
  if (!formatValid) return "idle";
  return isDisposable ? "fail" : "pass";
}

function getMxBadgeStatus(
  mxValid: boolean | null,
  isPending: boolean,
  formatValid: boolean,
  isDisposable: boolean
): BadgeStatus {
  if (!formatValid || isDisposable) return "idle";
  if (isPending || mxValid === null) return "pending";
  return mxValid ? "pass" : "fail";
}

function shouldShowBlockingAlert(state: EmailValidationState): boolean {
  if (state.isPending) return false;
  return !state.formatValid || state.isDisposable || state.mxValid === false;
}

export function EmailValidationIndicator({
  email,
  onValidationChange,
  className,
}: EmailValidationIndicatorProps) {
  const validation = useEmailValidation(email);
  const onValidationChangeRef = useRef(onValidationChange);
  onValidationChangeRef.current = onValidationChange;

  useEffect(() => {
    onValidationChangeRef.current(validation);
  }, [
    validation.isValid,
    validation.formatValid,
    validation.isDisposable,
    validation.mxValid,
    validation.isPending,
    validation.error,
  ]);

  const trimmed = email.trim();
  if (trimmed.length < 3) {
    return null;
  }

  const formatStatus = getFormatBadgeStatus(validation.formatValid);
  const disposableStatus = getDisposableBadgeStatus(validation.isDisposable, validation.formatValid);
  const mxStatus = getMxBadgeStatus(
    validation.mxValid,
    validation.isPending,
    validation.formatValid,
    validation.isDisposable
  );
  const showAlert = shouldShowBlockingAlert(validation);

  return (
    <div className={cn("space-y-2", className)}>
      {showAlert && validation.error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Email cannot be used</AlertTitle>
          <AlertDescription>{validation.error}</AlertDescription>
        </Alert>
      ) : null}

      <div
        className="flex flex-wrap items-center gap-2"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        <StatusBadge label="Format" status={formatStatus} />
        <StatusBadge label="Disposable" status={disposableStatus} />
        <StatusBadge label="MX" status={mxStatus} />
      </div>
    </div>
  );
}
