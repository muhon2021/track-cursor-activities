import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMfaPolicy } from "@/hooks/useMfa";

interface MfaEnrollmentSelf {
  enrolled: boolean;
  grace_period_ends_at: string | null;
}

function useOwnMfaStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["mfa", "self-status", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mfa_enrollment_status")
        .select("enrolled, grace_period_ends_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as MfaEnrollmentSelf | null) ?? { enrolled: false, grace_period_ends_at: null };
    },
    enabled: !!user,
  });
}

export function useMfaGate() {
  const { data: policy, isLoading: policyLoading, isError: policyError } = useMfaPolicy();
  const { data: status, isLoading: statusLoading, isError: statusError } = useOwnMfaStatus();

  const isLoading = policyLoading || statusLoading;
  const required = policyError ? false : !!policy?.required;
  const enrolled = statusError ? false : !!status?.enrolled;
  const graceEndsAt = status?.grace_period_ends_at ? new Date(status.grace_period_ends_at) : null;
  const graceExpired = !!graceEndsAt && graceEndsAt.getTime() < Date.now();
  const mustEnrollNow = required && !enrolled && graceExpired;
  const inGracePeriod = required && !enrolled && !mustEnrollNow;

  return { isLoading, required, enrolled, graceEndsAt, inGracePeriod, mustEnrollNow };
}
