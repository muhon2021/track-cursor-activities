/**
 * SendGrid admin configuration and status
 * Uses sendgrid_config (singleton) and organization_integrations (Integration Hub)
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, invalidateKeys, cacheConfig } from "@/lib/cache";
import { integrationKeys } from "@/hooks/useIntegrations";
import { toast } from "sonner";

export interface SendGridConfig {
  id: string;
  from_email: string;
  from_name: string;
  is_enabled: boolean;
  enable_open_tracking: boolean;
  enable_click_tracking: boolean;
  created_at: string;
  updated_at: string;
}

export interface IntegrationRow {
  id: string;
  slug: string;
  name: string;
  status: "connected" | "disconnected" | "error";
  last_sync: string | null;
}

export function useSendGridConfig() {
  return useQuery({
    queryKey: queryKeys.sendgrid.config,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sendgrid_config")
        .select("id, from_email, from_name, is_enabled, enable_open_tracking, enable_click_tracking, created_at, updated_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as SendGridConfig | null;
    },
    staleTime: cacheConfig.staleTime.medium,
  });
}

export function useIntegrationStatus(slug: string) {
  return useQuery({
    queryKey: [...queryKeys.sendgrid.integration, slug],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("integrations")
        .select("id, slug, name, status, last_sync")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as IntegrationRow | null;
    },
    enabled: !!slug,
    staleTime: cacheConfig.staleTime.medium,
  });
}

export interface UpdateSendGridConfigInput {
  from_email: string;
  from_name: string;
  is_enabled: boolean;
  enable_open_tracking: boolean;
  enable_click_tracking: boolean;
  api_key?: string;
}

/** Keep Integration Hub in sync with sendgrid_config (hub reads organization_integrations). */
export async function syncSendGridOrganizationIntegration(
  connected: boolean,
  config?: Pick<SendGridConfig, "from_email" | "from_name" | "is_enabled">
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: provider, error: providerError } = await supabase
    .from("integration_providers")
    .select("id")
    .eq("slug", "sendgrid")
    .maybeSingle();

  if (providerError || !provider) {
    console.error("SendGrid provider not found for hub sync:", providerError);
    return;
  }

  const now = new Date().toISOString();

  if (!connected) {
    const { error } = await supabase
      .from("organization_integrations")
      .update({
        enabled: false,
        connection_status: "disconnected",
        connection_message: "SendGrid disabled",
        last_tested_at: now,
      })
      .eq("user_id", user.id)
      .eq("provider_id", provider.id);

    if (error) console.error("Failed to disconnect SendGrid in hub:", error);
    return;
  }

  const { error } = await supabase.from("organization_integrations").upsert(
    {
      user_id: user.id,
      provider_id: provider.id,
      enabled: true,
      connection_status: "connected",
      connection_message: "SendGrid configured",
      last_tested_at: now,
      config: config
        ? {
            from_email: config.from_email,
            from_name: config.from_name,
            is_enabled: config.is_enabled,
          }
        : {},
    },
    { onConflict: "user_id,provider_id" }
  );

  if (error) console.error("Failed to sync SendGrid to Integration Hub:", error);
}

export function useUpdateSendGridConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateSendGridConfigInput) => {
      const { data: config } = await supabase
        .from("sendgrid_config")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (!config) {
        const { data: inserted, error: insErr } = await supabase
          .from("sendgrid_config")
          .insert({
            from_email: input.from_email,
            from_name: input.from_name,
            is_enabled: input.is_enabled,
            enable_open_tracking: input.enable_open_tracking,
            enable_click_tracking: input.enable_click_tracking,
            ...(input.api_key && { api_key: input.api_key }),
          })
          .select()
          .single();
        if (insErr) throw insErr;
        return inserted;
      }

      const updatePayload: Record<string, unknown> = {
        from_email: input.from_email,
        from_name: input.from_name,
        is_enabled: input.is_enabled,
        enable_open_tracking: input.enable_open_tracking,
        enable_click_tracking: input.enable_click_tracking,
      };
      if (input.api_key !== undefined && input.api_key !== "") {
        updatePayload.api_key = input.api_key;
      }
      const { data, error } = await supabase
        .from("sendgrid_config")
        .update(updatePayload as any)
        .eq("id", config.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (_, variables) => {
      invalidateKeys.sendgrid(queryClient);

      await syncSendGridOrganizationIntegration(variables.is_enabled, {
        from_email: variables.from_email,
        from_name: variables.from_name,
        is_enabled: variables.is_enabled,
      });

      queryClient.invalidateQueries({ queryKey: integrationKeys.orgIntegrations() });
      queryClient.invalidateQueries({ queryKey: integrationKeys.all });

      toast.success("SendGrid configuration saved");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save configuration");
    },
  });
}
