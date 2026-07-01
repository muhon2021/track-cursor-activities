import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useValidatePassword } from "@/hooks/useSecurityHardening";
import { Loader2 } from "lucide-react";

interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
  onValidationChange?: (valid: boolean) => void;
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  if (score > 0) return "Weak";
  return "Enter a password";
}

function scoreColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-emerald-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-destructive";
}

export function PasswordStrengthMeter({
  password,
  className,
  onValidationChange,
}: PasswordStrengthMeterProps) {
  const validate = useValidatePassword();
  const [debouncedPassword, setDebouncedPassword] = useState(password);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPassword(password), 400);
    return () => clearTimeout(timer);
  }, [password]);

  useEffect(() => {
    if (!debouncedPassword) {
      onValidationChange?.(false);
      return;
    }

    validate.mutate(debouncedPassword, {
      onSuccess: (result) => {
        onValidationChange?.(result.valid);
      },
      onError: () => {
        onValidationChange?.(false);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedPassword]);

  const result = validate.data;
  const score = result?.score ?? 0;
  const label = useMemo(() => scoreLabel(score), [score]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Password strength</span>
        <span className="flex items-center gap-1">
          {validate.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          {label}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all duration-300", scoreColor(score))}
          style={{ width: `${Math.max(score, password ? 8 : 0)}%` }}
        />
      </div>

      {result?.errors?.length ? (
        <ul className="space-y-1 text-xs text-destructive">
          {result.errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}

      {result?.warnings?.length ? (
        <ul className="space-y-1 text-xs text-amber-600 dark:text-amber-400">
          {result.warnings.map((warn) => (
            <li key={warn}>{warn}</li>
          ))}
        </ul>
      ) : null}

      {result?.hibpCompromised ? (
        <p className="text-xs text-destructive">
          This password appears in {result.hibpCount?.toLocaleString() ?? "known"} data breaches.
        </p>
      ) : null}
    </div>
  );
}
