import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";
import { invokeEdgeFunction } from "@/lib/edge-functions";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

export interface MfaPolicy {
  id: string;
  tenant_id: string;
  required: boolean;
  grace_period_days: number;
  allowed_factors: string[];
  trust_idp_mfa: boolean;
  updated_at: string;
}

const DEFAULT_MFA_POLICY: MfaPolicy = {
  id: "",
  tenant_id: DEFAULT_TENANT_ID,
  required: false,
  grace_period_days: 7,
  allowed_factors: ["totp"],
  trust_idp_mfa: false,
  updated_at: new Date().toISOString(),
};

export interface MfaEnrollmentRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  enrolled: boolean;
  enrolled_at: string | null;
  grace_period_ends_at: string | null;
  last_reminded_at: string | null;
}

export function useMfaPolicy() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.mfa.policy,
    queryFn: async () => {
      // Direct read — RLS allows authenticated SELECT (mfa_enforcement migration).
      // Avoids edge function CORS failures when mfa-policy is not deployed locally.
      const { data, error } = await supabase
        .from("mfa_policies")
        .select("*")
        .eq("tenant_id", DEFAULT_TENANT_ID)
        .maybeSingle();

      if (error) {
        console.warn("MFA policy read failed, using defaults:", error.message);
        return DEFAULT_MFA_POLICY;
      }

      return (data as MfaPolicy | null) ?? DEFAULT_MFA_POLICY;
    },
    enabled: !!user,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateMfaPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      required: boolean;
      grace_period_days?: number;
      allowed_factors?: string[];
      trust_idp_mfa?: boolean;
    }) => {
      const result = await invokeEdgeFunction<{ policy: MfaPolicy }>("mfa-policy", {
        action: "update_policy",
        ...data,
      });
      return result.policy;
    },
    onSuccess: () => {
      invalidateKeys.mfa(queryClient);
      toast.success("MFA policy updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update MFA policy");
    },
  });
}

export function useMfaEnrollment() {
  return useQuery({
    queryKey: queryKeys.mfa.enrollment,
    queryFn: async () => {
      const result = await invokeEdgeFunction<{ enrollment: MfaEnrollmentRow[] }>("mfa-enrollment", {
        action: "list",
      });
      return result.enrollment;
    },
  });
}

export function useRemindMfaEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetUserId?: string) => {
      return invokeEdgeFunction<{ success: boolean; reminded_count: number }>("mfa-enrollment", {
        action: "remind",
        target_user_id: targetUserId,
      });
    },
    onSuccess: (result) => {
      invalidateKeys.mfa(queryClient);
      toast.success(`Reminder sent to ${result.reminded_count} user(s)`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send reminder");
    },
  });
}

export function useResetMfaEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetUserId: string) => {
      return invokeEdgeFunction("mfa-enrollment", { action: "reset", target_user_id: targetUserId });
    },
    onSuccess: () => {
      invalidateKeys.mfa(queryClient);
      toast.success("MFA reset for user");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reset MFA");
    },
  });
}

export function useMfaFactors() {
  return useQuery({
    queryKey: queryKeys.mfa.factors,
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data.totp ?? [];
    },
  });
}

export function useEnrollMfaFactor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateKeys.mfa(queryClient);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to start MFA enrollment");
    },
  });
}

export function useVerifyMfaFactor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ factorId, code }: { factorId: string; code: string }) => {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase.from("mfa_enrollment_status").upsert(
          {
            user_id: userData.user.id,
            enrolled: true,
            enrolled_at: new Date().toISOString(),
            grace_period_ends_at: null,
          },
          { onConflict: "user_id" }
        );
      }
      invalidateKeys.mfa(queryClient);
      toast.success("Two-factor authentication enabled");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Invalid verification code");
    },
  });
}

export function useUnenrollMfaFactor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (factorId: string) => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
    },
    onSuccess: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        if (!factors?.totp?.length) {
          await supabase
            .from("mfa_enrollment_status")
            .upsert(
              { user_id: userData.user.id, enrolled: false, enrolled_at: null },
              { onConflict: "user_id" }
            );
        }
      }
      invalidateKeys.mfa(queryClient);
      toast.success("Two-factor method removed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove MFA factor");
    },
  });
}
