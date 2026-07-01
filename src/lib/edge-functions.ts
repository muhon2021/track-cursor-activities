/**
 * Edge functions - per PROJECTS-EXACT-FILE-LIST. Invoke helpers if needed.
 */
import { supabase } from "@/integrations/supabase/client";

interface EdgeFunctionError {
  message?: string;
  context?: Response;
}

async function extractErrorMessage(error: EdgeFunctionError): Promise<string> {
  try {
    const body = await error.context?.clone().json();
    return body?.message || body?.error || error.message || "Request failed";
  } catch {
    return error.message || "Request failed";
  }
}

export async function invokeEdgeFunction<T = unknown>(name: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(await extractErrorMessage(error));
  if (data && typeof data === "object" && "error" in data && (data as { error?: unknown }).error) {
    const { message, error: errMessage } = data as { message?: string; error?: string };
    throw new Error(message || errMessage || "Request failed");
  }
  return data as T;
}
