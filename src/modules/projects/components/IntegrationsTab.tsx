import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, Plug, Loader2, RefreshCw } from "lucide-react";
import type { ProjectIntegration } from "@/modules/projects/hooks/useProjectIntegrations";
import { useSyncProjects } from "@/hooks/useIntegrationSync";

interface IntegrationsTabProps {
  projectId: string;
  projectName: string;
  integrations?: ProjectIntegration[];
  isLoading?: boolean;
}

function ConnectionBadge({ connected, status }: { connected: boolean; status: string | null }) {
  if (connected) {
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Connected
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <XCircle className="h-3 w-3" />
      {status || "Not connected"}
    </Badge>
  );
}

function ProviderSyncButton({
  slug,
  connected,
}: {
  slug: string;
  connected: boolean;
}) {
  const isProjectProvider =
    slug === "activecollab" ||
    slug === "jira" ||
    slug === "clickup" ||
    slug === "workamajig";
  const { mutate, isPending } = useSyncProjects(slug);

  if (!isProjectProvider) {
    return null;
  }

  if (!connected) {
    return (
      <Button variant="outline" size="sm" disabled>
        Connect
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => mutate()}
      disabled={isPending}
      className="inline-flex items-center gap-1"
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <RefreshCw className="h-3 w-3" />
      )}
      <span>Sync projects</span>
    </Button>
  );
}

export function IntegrationsTab({
  projectId,
  projectName,
  integrations = [],
  isLoading,
}: IntegrationsTabProps) {
  const hasIntegrations = integrations.length > 0;
  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
          {hasIntegrations && (
            <CardDescription>
              {connectedCount} of {integrations.length} connected
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading integrations…</p>
          )}
          {!isLoading && hasIntegrations && (
            <ul className="space-y-2">
              {integrations.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    {i.logo_url ? (
                      <img
                        src={i.logo_url}
                        alt={i.name}
                        className="h-6 w-6 rounded object-contain"
                      />
                    ) : (
                      <Plug className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <span className="font-medium">{i.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{i.slug}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {i.last_sync_at && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(i.last_sync_at).toLocaleString()}
                      </span>
                    )}
                    <ConnectionBadge connected={i.connected} status={i.connection_status} />
                    <ProviderSyncButton slug={i.slug} connected={i.connected} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!isLoading && !hasIntegrations && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Plug className="h-10 w-10 mb-3" />
              <p className="text-sm font-medium">No integrations available</p>
              <p className="text-xs">
                Configure integrations in Admin &rarr; Integrations to connect tools
                for <span className="font-medium">{projectName}</span>.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
