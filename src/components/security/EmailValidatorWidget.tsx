import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useValidateEmail } from "@/hooks/useSecurityHardening";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

interface EmailValidatorWidgetProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onValidChange?: (valid: boolean) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function EmailValidatorWidget({
  id = "email",
  label = "Email",
  value,
  onChange,
  onValidChange,
  className,
  disabled,
  placeholder = "you@company.com",
}: EmailValidatorWidgetProps) {
  const validate = useValidateEmail();
  const [touched, setTouched] = useState(false);
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), 500);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    if (!debouncedValue) {
      onValidChange?.(false);
      return;
    }

    validate.mutate(debouncedValue, {
      onSuccess: (result) => onValidChange?.(result.valid),
      onError: () => onValidChange?.(false),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  const result = validate.data;
  const showFeedback = debouncedValue.length > 0 && (touched || !!result);

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            showFeedback &&
              (result?.valid
                ? "border-green-500 focus-visible:ring-green-500"
                : "border-destructive focus-visible:ring-destructive")
          )}
        />
        {validate.isPending && touched ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
        {showFeedback && !validate.isPending && result ? (
          result.valid ? (
            <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-600" />
          ) : (
            <XCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
          )
        ) : null}
      </div>

      {showFeedback && result?.steps?.length ? (
        <ul className="space-y-1 text-xs">
          {result.steps.map((step) => (
            <li
              key={step.step}
              className={cn(
                "flex items-center gap-1",
                step.passed ? "text-green-600 dark:text-green-400" : "text-destructive"
              )}
            >
              {step.passed ? (
                <CheckCircle2 className="h-3 w-3 shrink-0" />
              ) : (
                <XCircle className="h-3 w-3 shrink-0" />
              )}
              <span>{step.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
