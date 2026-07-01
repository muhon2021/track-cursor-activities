/**
 * CrmConnectionBanner - Displays CRM connection status at the top of CRM-related pages.
 * Shows connected provider name + last sync time, or a prompt to connect.
 * Dismissible via localStorage.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2, Package, X, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useCRMIntegrationDisplay } from "@/hooks/useCRMIntegrationDisplay";
import { useCrmSync } from "@/hooks/useCrmSync";
import { isCrmSyncProvider } from "@/lib/integration-preferences";

const CRM_SLUGS = ["hubspot", "salesforce", "zoho", "zoho-crm", "pipedrive"] as const;

const DISMISS_KEY = "hide-crm-banner";

interface CrmIntegrationRow {
  id: string;
  connection_status: string | null;
  last_sync_at: string | null;
  integration_providers: {
    slug: string;
    name: string;
    logo_url: string | null;
  };
}

async function fetchCrmConnection(): Promise<CrmIntegrationRow | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("organization_integrations")
    .select(
      `id, connection_status, last_sync_at,
       integration_providers!inner(slug, name, logo_url)`
    )
    .eq("user_id", user.id)
    .in("integration_providers.slug", CRM_SLUGS as unknown as string[])
    .eq("connection_status", "connected")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as CrmIntegrationRow | null;
}

export function CrmConnectionBanner() {
  const [dismissed, setDismissed] = useState<boolean>(
    () => !!localStorage.getItem(DISMISS_KEY)
  );
  const { primarySlug, destinations } = useCRMIntegrationDisplay();
  const crmSync = useCrmSync(primarySlug ?? "", destinations);

  const { data: crmConnection, isLoading } = useQuery({
    queryKey: ["crm-connection-status"],
    queryFn: fetchCrmConnection,
    staleTime: 5 * 60 * 1000,
  });

  if (dismissed || isLoading) return null;

  const isConnected =
    !!crmConnection && crmConnection.connection_status === "connected";

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  const syncSlug = primarySlug ?? crmConnection?.integration_providers.slug;
  const canSync = !!syncSlug && isCrmSyncProvider(syncSlug);

  if (isConnected) {
    const providerName = crmConnection.integration_providers.name;
    const lastSync = crmConnection.last_sync_at
      ? format(new Date(crmConnection.last_sync_at), "MMM d, yyyy")
      : null;

    return (
      <div className="flex items-center gap-3 w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
        <Link2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
        <span className="flex-1 text-blue-800">
          <span className="font-medium">Connected to {providerName}</span>
          {lastSync && (
            <span className="text-blue-600"> · Last sync: {lastSync}</span>
          )}
          {destinations.length > 0 && (
            <span className="text-blue-600">
              {" "}
              · Showing on: {destinations.join(", ")}
            </span>
          )}
        </span>
        {canSync && (
          <Button
            variant="outline"
            size="sm"
            className="border-blue-300 text-blue-700 hover:bg-blue-100"
            disabled={crmSync.isPending}
            onClick={() =>
              crmSync.mutate({
                providerSlug: syncSlug,
                destinations,
              })
            }
          >
            {crmSync.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Sync Now
          </Button>
        )}
        <button
          onClick={handleDismiss}
          className="text-blue-400 hover:text-blue-600 transition-colors flex-shrink-0"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm">
      <Package className="h-4 w-4 text-slate-500 flex-shrink-0" />
      <span className="flex-1 text-slate-600">
        <span className="font-medium">No CRM connected</span>
        <span className="text-slate-500"> · Data is managed manually</span>
      </span>
      <Button variant="outline" size="sm" asChild>
        <a href="/admin/integrations">Connect CRM</a>
      </Button>
      <button
        onClick={handleDismiss}
        className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
