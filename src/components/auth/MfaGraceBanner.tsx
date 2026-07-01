import { Link } from "react-router-dom";
import { useMfaGate } from "@/hooks/useMfaGate";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export function MfaGraceBanner() {
  const { inGracePeriod, graceEndsAt } = useMfaGate();

  if (!inGracePeriod) return null;

  const daysLeft = graceEndsAt
    ? Math.max(0, Math.ceil((graceEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/50">
      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>
          Two-factor authentication is required for your account.{" "}
          {daysLeft !== null ? `You have ${daysLeft} day(s) left to set it up.` : ""}
        </span>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link to="/mfa/enroll">Set up now</Link>
      </Button>
    </div>
  );
}
