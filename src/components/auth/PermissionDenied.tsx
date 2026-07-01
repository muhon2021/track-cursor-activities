import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface PermissionDeniedProps {
  message?: string;
  title?: string;
}

export function PermissionDenied({
  title = "Access Denied",
  message = "You do not have permission to access this area.",
}: PermissionDeniedProps) {
  return (
    <div className="flex h-screen items-center justify-center p-4">
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </div>
  );
}
