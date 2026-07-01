/**
 * Toast helpers - per PROJECTS-EXACT-FILE-LIST. Thin wrapper around sonner if needed.
 */
import { toast } from "sonner";

export function toastSuccess(message: string, description?: string) {
  toast.success(message, { description });
}

export function toastError(message: string, description?: string) {
  toast.error(message, { description });
}
