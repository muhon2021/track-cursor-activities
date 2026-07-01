/**
 * Project Integrations — real Supabase queries
 *
 * Fetches organization-level integration connections joined with provider
 * metadata to show which integrations are active and relevant for a project.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectIntegration {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  type: string;
  connected: boolean;
  enabled: boolean;
  last_sync_at: string | null;
  connection_status: string | null;
  logo_url: string | null;
}

export function useProjectIntegrations(projectId: string) {
  return useQuery({
    queryKey: ["project-integrations", projectId],
    queryFn: async (): Promise<ProjectIntegration[]> => {
      const { data, error } = await supabase
        .from("organization_integrations")
        .select(`
          id,
          enabled,
          connection_status,
          last_sync_at,
          integration_providers (
            name,
            slug,
            logo_url
          )
        `)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!data) return [];

      return data
        .filter((row) => row.integration_providers)
        .map((row) => {
          const provider = row.integration_providers as unknown as {
            name: string;
            slug: string;
            logo_url: string | null;
          };
          const isConnected =
            row.connection_status === "connected" ||
            row.connection_status === "active";

          return {
            id: row.id,
            project_id: projectId,
            name: provider.name,
            slug: provider.slug,
            type: provider.slug,
            connected: isConnected && (row.enabled ?? false),
            enabled: row.enabled ?? false,
            last_sync_at: row.last_sync_at,
            connection_status: row.connection_status,
            logo_url: provider.logo_url,
          };
        });
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
  });
}
