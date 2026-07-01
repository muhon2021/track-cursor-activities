/**
 * ClickUp Integration Page
 * Org-level config + user OAuth connect + project sync
 */

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Kanban,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Settings,
  ArrowLeft,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { syncClickupLocal } from "@/lib/clickupLocalSync";
import {
  useIntegrationProvider,
  useIntegrationFields,
  useOrganizationIntegration,
  useUpdateIntegration,
} from "@/hooks/useIntegrations";
import { DynamicFormField } from "@/components/integrations/DynamicFormField";
import { useUserOAuthToken, useDisconnectOAuth } from "@/hooks/useUserIntegrations";

interface SyncResult {
  success: boolean;
  projects_synced: number;
  projects_created: number;
  projects_updated: number;
  tasks_synced: number;
  duration_ms: number;
  errors: string[];
}

const OAUTH_STATE_KEY = "clickup_oauth_state";

export default function ClickUpIntegration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const [orgConfigValues, setOrgConfigValues] = useState<Record<string, string>>({});
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusVariant, setStatusVariant] = useState<"default" | "success" | "error">("default");

  // Integration metadata
  const { data: provider, isLoading: providerLoading } = useIntegrationProvider("clickup");
  const { data: integrationFields, isLoading: fieldsLoading } = useIntegrationFields(provider?.id || "");
  const { data: orgIntegrationData, isLoading: orgIntegrationLoading } = useOrganizationIntegration(provider?.id || "");
  const orgIntegration = orgIntegrationData?.integration;
  const updateIntegration = useUpdateIntegration();

  // User-level connection
  const { data: clickupToken } = useUserOAuthToken("clickup");
  const disconnectOAuth = useDisconnectOAuth();
  const isUserConnected = !!clickupToken;

  const isOrgConfigured =
    !!orgIntegration && orgIntegration.enabled && orgIntegration.connection_status === "connected";

  // Initialize org config
  useEffect(() => {
    if (orgIntegration?.config) {
      const config = orgIntegration.config as Record<string, string>;
      setOrgConfigValues(config);
    }
  }, [orgIntegration]);

  const handleFieldChange = (fieldKey: string, value: string) => {
    setOrgConfigValues((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
  };

  const hasRequiredFields =
    integrationFields?.every((field) => {
      if (!field.is_required) return true;
      return !!orgConfigValues[field.field_key];
    }) ?? false;

  const handleSaveOrgConfig = async () => {
    if (!provider) return;
    setIsSavingConfig(true);
    try {
      await updateIntegration.mutateAsync({
        providerId: provider.id,
        config: orgConfigValues,
        enabled: true,
      });
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast({
        title: "Configuration saved",
        description: "ClickUp organization configuration has been saved successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err?.message || "Failed to save configuration",
        variant: "destructive",
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // ---------- OAuth Connect ----------

  const connectClickUp = () => {
    const clientId = orgConfigValues["client_id"];
    if (!clientId) {
      toast({
        title: "Client ID required",
        description: "Enter and save ClickUp Client ID before connecting.",
        variant: "destructive",
      });
      return;
    }

    const state = crypto.randomUUID();
    sessionStorage.setItem(OAUTH_STATE_KEY, state);
    const redirectUri = `${window.location.origin}/admin/integrations/clickup`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
    });

    const authUrl = `https://app.clickup.com/api?${params.toString()}`;
    window.location.href = authUrl;
  };

  // ---------- Token exchange + sync ----------

  const exchangeAndSyncMutation = useMutation({
    mutationFn: async ({ code, redirectUri }: { code: string; redirectUri: string }) => {
      // 1) Exchange code for token
      const { data: exchangeData, error: exchangeError } = await supabase.functions.invoke(
        "clickup-oauth-exchange",
        {
          body: { code, redirect_uri: redirectUri },
        },
      );

      if (exchangeError || exchangeData?.error) {
        throw new Error(exchangeError?.message || exchangeData?.error || "Failed to exchange ClickUp code");
      }

      // 2) Trigger sync
      const syncData = await syncClickupLocal();
      return syncData as SyncResult;
    },
    onMutate: () => {
      setStatusVariant("default");
      setStatusMessage("Syncing your data...");
    },
    onSuccess: (result) => {
      const projects = result.projects_synced ?? 0;
      const tasks = result.tasks_synced ?? 0;
      setStatusVariant("success");
      setStatusMessage(`ClickUp connected! You have ${projects} projects and ${tasks} tasks synced.`);
      toast({
        title: "ClickUp connected",
        description: `You have ${projects} projects and ${tasks} tasks synced.`,
      });
      // Refresh integration-related queries and the main projects list
      queryClient.invalidateQueries({ queryKey: ["user-oauth-tokens"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: any) => {
      setStatusVariant("error");
      setStatusMessage(error?.message || "Failed to connect and sync ClickUp");
      toast({
        title: "ClickUp connection failed",
        description: error?.message || "Failed to connect and sync ClickUp",
        variant: "destructive",
      });
    },
  });

  // Manual "Sync Now" without re-running OAuth
  const syncOnlyMutation = useMutation({
    mutationFn: async () => {
      const data = await syncClickupLocal();
      if (!data.success && data.errors.length > 0) {
        throw new Error(data.errors[0] || "Failed to sync ClickUp data");
      }
      return data as SyncResult;
    },
    onMutate: () => {
      setStatusVariant("default");
      setStatusMessage("Syncing your data...");
    },
    onSuccess: (result) => {
      const projects = result.projects_synced ?? 0;
      const tasks = result.tasks_synced ?? 0;
      setStatusVariant("success");
      setStatusMessage(`ClickUp connected! You have ${projects} projects and ${tasks} tasks synced.`);
      toast({
        title: "ClickUp synced",
        description: `You have ${projects} projects and ${tasks} tasks synced.`,
      });
      // Ensure both integration token state and projects list are refreshed
      queryClient.invalidateQueries({ queryKey: ["user-oauth-tokens"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: any) => {
      setStatusVariant("error");
      setStatusMessage(error?.message || "Failed to sync ClickUp data");
      toast({
        title: "Sync failed",
        description: error?.message || "Failed to sync ClickUp data",
        variant: "destructive",
      });
    },
  });

  // Parse code/state from URL and kick off exchange+sync once
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const code = searchParams.get("code");
    const returnedState = searchParams.get("state");

    if (!code) return;

    const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    if (expectedState && returnedState && expectedState !== returnedState) {
      setStatusVariant("error");
      setStatusMessage("Invalid OAuth state. Please try connecting again.");
      return;
    }

    // Clear stored state
    sessionStorage.removeItem(OAUTH_STATE_KEY);

    // Remove query params from URL to avoid re-processing on refresh
    searchParams.delete("code");
    searchParams.delete("state");
    navigate({ pathname: location.pathname, search: searchParams.toString() }, { replace: true });

    const redirectUri = `${window.location.origin}/admin/integrations/clickup`;
    exchangeAndSyncMutation.mutate({ code, redirectUri });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  const isLoading = providerLoading || fieldsLoading || orgIntegrationLoading;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div>
        <Link
          to="/admin/integrations"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Integrations
        </Link>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 shadow-lg">
              <Kanban className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">ClickUp Integration</h1>
              <p className="text-muted-foreground mt-1">
                Connect ClickUp to sync your projects into Control Tower.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Org configuration */}
      <Card className="border-2 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-muted-foreground" />
            Organization Configuration
            {isOrgConfigured ? (
              <Badge variant="outline" className="ml-2 border-success/30 text-success dark:border-green-800 dark:text-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Configured
              </Badge>
            ) : (
              <Badge variant="outline" className="ml-2 border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-300">
                <AlertCircle className="h-3 w-3 mr-1" />
                Setup Required
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Enter your ClickUp OAuth app Client ID and Client Secret. These stay on the server; the browser only
            ever sees the auth code from ClickUp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {integrationFields && integrationFields.length > 0 ? (
            <div className="space-y-4">
              {integrationFields.map((field) => (
                <DynamicFormField
                  key={field.id}
                  field={field}
                  value={orgConfigValues[field.field_key] || ""}
                  onChange={(value) => handleFieldChange(field.field_key, value)}
                  showMasked={isOrgConfigured}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading configuration fields…</p>
          )}

          <Separator />

          <Button
            onClick={handleSaveOrgConfig}
            disabled={isSavingConfig || !hasRequiredFields}
          >
            {isSavingConfig ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Configuration"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Connect + Sync section */}
      <Card className="border-2 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Kanban className="h-5 w-5 text-primary" />
            Connect &amp; Sync
          </CardTitle>
          <CardDescription>
            Connect your ClickUp workspace and sync projects. After connecting, we’ll automatically start syncing
            and show you how many projects and tasks were imported.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              onClick={connectClickUp}
              disabled={!isOrgConfigured || exchangeAndSyncMutation.isPending}
            >
              {exchangeAndSyncMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  <Kanban className="mr-2 h-4 w-4" />
                  Connect with ClickUp
                </>
              )}
            </Button>
            {!isOrgConfigured && (
              <p className="text-sm text-muted-foreground">
                Configure Client ID and Secret above before connecting.
              </p>
            )}
          </div>

          {isUserConnected && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  disconnectOAuth.mutate(
                    { provider: "clickup" },
                    {
                      onSuccess: () => {
                        toast({
                          title: "Disconnected",
                          description: "Your ClickUp account has been disconnected.",
                        });
                        queryClient.invalidateQueries({ queryKey: ["user-oauth-tokens"] });
                      },
                    },
                  )
                }
                disabled={disconnectOAuth.isPending}
              >
                {disconnectOAuth.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disconnecting…
                  </>
                ) : (
                  "Disconnect"
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={() => syncOnlyMutation.mutate()}
                disabled={syncOnlyMutation.isPending}
              >
                {syncOnlyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing…
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>
          )}

          {statusMessage && (
            <div
              className={`mt-2 rounded-md border px-3 py-2 text-sm flex items-start gap-2 ${
                statusVariant === "success"
                  ? "border-success/30 bg-success/10 text-success"
                  : statusVariant === "error"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-info/30 bg-info/10 text-info"
              }`}
            >
              {statusVariant === "success" && (
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              {statusVariant === "error" && (
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              {statusVariant === "default" && (
                <RefreshCw className="h-4 w-4 mt-0.5 flex-shrink-0 animate-spin" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}

          <Separator />

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <p>
              OAuth redirect goes directly between this app and ClickUp (
              <code>https://app.clickup.com/api</code>), and the backend only handles secure token storage and
              syncing. No secrets are ever exposed to the browser.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

