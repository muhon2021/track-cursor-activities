import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { toast } from "sonner";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export interface SecurityConfiguration {
  id: string;
  org_id: string;
  password_rotation_days: number;
  max_login_attempts: number;
  lockout_duration_minutes: number;
  hibp_check_enabled: boolean;
  disposable_email_blocked: boolean;
  smtp_check_enabled: boolean;
}

export interface EmailValidationResult {
  valid: boolean;
  steps: Array<{ step: string; passed: boolean; message?: string }>;
  domain?: string;
}

export interface PasswordValidationResult {
  valid: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  hibpCompromised?: boolean;
  hibpCount?: number;
}

export interface SecurityAnalyticsPayload {
  generated_at: string;
  period_days: number;
  metrics: {
    total_lockouts: number;
    blocked_signups: number;
    password_violations: number;
    failed_login_attempts: number;
    successful_logins: number;
    unique_failed_emails: number;
    audit_anomalies: number;
  };
  locked_accounts: Array<{
    id: string;
    email: string;
    full_name: string | null;
    failed_login_count: number;
    locked_until: string;
  }>;
  security_anomalies: Array<{
    id: string;
    anomaly_type: string;
    severity: string;
    message: string;
    detected_at: string;
    metadata: Record<string, unknown>;
  }>;
}

export function useSecurityConfiguration() {
  return useQuery({
    queryKey: ["security", "configuration", DEFAULT_ORG],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("security_configurations")
        .select("*")
        .eq("org_id", DEFAULT_ORG)
        .single();

      if (error) throw error;
      return data as SecurityConfiguration;
    },
  });
}

export function useUpdateSecurityConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<SecurityConfiguration>) => {
      const { data, error } = await (supabase as any)
        .from("security_configurations")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("org_id", DEFAULT_ORG)
        .select()
        .single();

      if (error) throw error;
      return data as SecurityConfiguration;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security", "configuration"] });
      toast.success("Security settings saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save security settings");
    },
  });
}

export function useValidateEmail() {
  return useMutation({
    mutationFn: (email: string) =>
      invokeEdgeFunction<EmailValidationResult>("validate-email", { email }),
  });
}

export function useValidatePassword() {
  return useMutation({
    mutationFn: (password: string) =>
      invokeEdgeFunction<PasswordValidationResult>("validate-password", { password }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (params: { current_password: string; new_password: string }) =>
      invokeEdgeFunction<{ success: boolean; password_expires_at: string }>("change-password", params),
    onSuccess: () => {
      toast.success("Password updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to change password");
    },
  });
}

export function useSecurityAnalytics(days = 30) {
  return useQuery({
    queryKey: ["security", "analytics", days],
    queryFn: () => invokeEdgeFunction<SecurityAnalyticsPayload>("security-analytics", { days }),
  });
}

export function useUnlockAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { user_id?: string; email?: string }) =>
      invokeEdgeFunction("unlock-account", params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security", "analytics"] });
      toast.success("Account unlocked");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to unlock account");
    },
  });
}

export async function recordLoginAttempt(email: string, wasSuccessful: boolean) {
  try {
    await invokeEdgeFunction("security-analytics", {
      action: "record_login_attempt",
      email,
      was_successful: wasSuccessful,
    });
  } catch (error) {
    console.warn("Failed to record login attempt:", error);
  }
}
