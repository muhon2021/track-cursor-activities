import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";
import { invokeEdgeFunction } from "@/lib/edge-functions";

export interface SignupDomain {
  id: string;
  domain: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export function useSignupDomainWhitelist() {
  return useQuery({
    queryKey: queryKeys.signupWhitelist.domains,
    queryFn: async () => {
      const result = await invokeEdgeFunction<{ domains: SignupDomain[] }>("signup-domain-whitelist", {
        action: "list",
      });
      return result.domains;
    },
  });
}

export function useAddSignupDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (domain: string) => {
      const result = await invokeEdgeFunction<{ domain: SignupDomain }>("signup-domain-whitelist", {
        action: "add",
        domain,
      });
      return result.domain;
    },
    onSuccess: () => {
      invalidateKeys.signupWhitelist(queryClient);
      toast.success("Domain added");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add domain");
    },
  });
}

export function useToggleSignupDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const result = await invokeEdgeFunction<{ domain: SignupDomain }>("signup-domain-whitelist", {
        action: "toggle",
        id,
        is_active,
      });
      return result.domain;
    },
    onSuccess: () => {
      invalidateKeys.signupWhitelist(queryClient);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update domain");
    },
  });
}

export function useRemoveSignupDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await invokeEdgeFunction("signup-domain-whitelist", { action: "remove", id });
    },
    onSuccess: () => {
      invalidateKeys.signupWhitelist(queryClient);
      toast.success("Domain removed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove domain");
    },
  });
}

/** Public pre-check used by the signup form (no auth required). */
export async function checkSignupDomainAllowed(email: string): Promise<boolean> {
  try {
    const result = await invokeEdgeFunction<{ allowed: boolean }>("signup-domain-whitelist", {
      action: "check",
      email,
    });
    return result.allowed;
  } catch {
    // Fail open on the client-side pre-check; the DB trigger is the authoritative gate.
    return true;
  }
}
