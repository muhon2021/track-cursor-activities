import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, cacheConfig } from "@/lib/cache";
import { useAuth } from "@/contexts/AuthContext";

export interface DashboardPreferences {
  ai_digest_enabled: boolean;
  ai_digest_frequency: "weekly" | "daily";
  hide_completed_tasks: boolean;
  primary_pod_id: string | null;
}

const DEFAULTS: DashboardPreferences = {
  ai_digest_enabled: true,
  ai_digest_frequency: "weekly",
  hide_completed_tasks: false,
  primary_pod_id: null,
};

export function useDashboardPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const qKey = queryKeys.dashboard.agencyPreferences(user?.id ?? "");

  const query = useQuery<DashboardPreferences>({
    queryKey: qKey,
    queryFn: async (): Promise<DashboardPreferences> => {
      const { data, error } = await (supabase as any)
        .from("user_role_preferences")
        .select("ai_digest_enabled, ai_digest_frequency, hide_completed_tasks, primary_pod_id")
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return DEFAULTS;

      return {
        ai_digest_enabled: data.ai_digest_enabled ?? DEFAULTS.ai_digest_enabled,
        ai_digest_frequency: (data.ai_digest_frequency as "weekly" | "daily") ?? DEFAULTS.ai_digest_frequency,
        hide_completed_tasks: data.hide_completed_tasks ?? DEFAULTS.hide_completed_tasks,
        primary_pod_id: data.primary_pod_id ?? null,
      };
    },
    enabled: !!user,
    staleTime: cacheConfig.staleTime.long,
  });

  const mutation = useMutation({
    mutationFn: async (patch: Partial<DashboardPreferences>) => {
      const { error } = await (supabase as any)
        .from("user_role_preferences")
        .upsert(
          { user_id: user!.id, role: "user", ...patch },
          { onConflict: "user_id,role" }
        );
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: qKey });
      const prev = queryClient.getQueryData<DashboardPreferences>(qKey);
      queryClient.setQueryData<DashboardPreferences>(qKey, (old) => ({
        ...(old ?? DEFAULTS),
        ...patch,
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(qKey, ctx?.prev);
      toast.error("Failed to save preference.");
    },
    onSuccess: () => {
      toast.success("Preference saved.");
    },
  });

  return {
    preferences: query.data ?? DEFAULTS,
    isLoading: query.isLoading,
    updatePreference: (patch: Partial<DashboardPreferences>) => mutation.mutate(patch),
    isPending: mutation.isPending,
  };
}
