/**
 * Zoom Integration Page
 * Allows users to connect their Zoom account for meeting integration
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Video, CheckCircle2, AlertCircle, Loader2, RefreshCw, Eye, Calendar, Settings, Copy, ExternalLink, Save, Plus, BookOpen, ArrowLeft, TrendingUp, Clock, Users, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSyncZoom } from "@/hooks/useSyncZoom";
import { useUserOAuthToken, useConnectOAuth, useDisconnectOAuth, useHasValidToken } from "@/hooks/useUserIntegrations";
import { useMeetings } from "@/hooks/useMeetings";
import { 
  useIntegrationProvider, 
  useIntegrationFields, 
  useOrganizationIntegration, 
  useUpdateIntegration 
} from "@/hooks/useIntegrations";
import { DynamicFormField } from "@/components/integrations/DynamicFormField";
import { CreateZoomMeetingDialog } from "@/components/meetings/CreateZoomMeetingDialog";

export default function ZoomIntegration() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [orgConfigValues, setOrgConfigValues] = useState<Record<string, string>>({});
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Organization-level integration hooks
  const { data: zoomProvider, isLoading: providerLoading } = useIntegrationProvider("zoom");
  const { data: integrationFields, isLoading: fieldsLoading } = useIntegrationFields(zoomProvider?.id || "");
  const { data: orgIntegrationData, isLoading: orgIntegrationLoading } = useOrganizationIntegration(zoomProvider?.id || "");
  const orgIntegration = orgIntegrationData?.integration;
  const updateIntegration = useUpdateIntegration();

  // Check if org-level integration is configured
  const isOrgConfigured = !!orgIntegration && orgIntegration.enabled && orgIntegration.connection_status === 'connected';

  // Check Zoom connection status (user-level)
  const { data: zoomToken } = useUserOAuthToken("zoom");
  const { hasValidToken, isExpired, hasError, errorMessage } = useHasValidToken("zoom");
  const isConnected = !!zoomToken && hasValidToken;

  // OAuth hooks
  const connectOAuth = useConnectOAuth();
  const disconnectOAuth = useDisconnectOAuth();

  // Zoom sync hook
  const syncZoom = useSyncZoom();

  // Get Zoom meetings count
  const { data: meetings } = useMeetings({ meetingType: "zoom" });

  // Get Supabase URL for redirect URL
  const supabaseUrl = "https://tjkqvbxtziheggurtvcz.supabase.co";
  const redirectUrl = `${supabaseUrl}/functions/v1/user-oauth-callback`;

  // Initialize org config values from existing integration
  useEffect(() => {
    if (orgIntegration?.config) {
      const config = orgIntegration.config as Record<string, string>;
      setOrgConfigValues(config);
    }
  }, [orgIntegration]);

  useEffect(() => {
    if (!providerLoading && !fieldsLoading && !orgIntegrationLoading) {
      setCheckingStatus(false);
    }
  }, [providerLoading, fieldsLoading, orgIntegrationLoading, zoomToken]);

  const copyRedirectUrl = () => {
    navigator.clipboard.writeText(redirectUrl);
    toast({
      title: "Copied!",
      description: "Redirect URL copied to clipboard",
    });
  };

  const handleConnect = async () => {
    setLoading(true);
    setError("");
    
    try {
      await connectOAuth.mutateAsync({ provider: "zoom" });
      // The hook will redirect to OAuth, so we don't need to do anything else here
    } catch (err: any) {
      console.error("Zoom connection error:", err);
      setError(err.message || "Failed to connect to Zoom");
      toast({
        title: "Connection failed",
        description: err.message || "Failed to connect to Zoom",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await disconnectOAuth.mutateAsync({ provider: "zoom" });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['zoom-files'] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['user-oauth-tokens'] });
      
      toast({
        title: "Disconnected",
        description: "Your Zoom account has been disconnected.",
      });
    } catch (err: any) {
      console.error("Disconnect error:", err);
      toast({
        title: "Disconnect failed",
        description: err.message || "Failed to disconnect",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncMeetings = async () => {
    try {
      await syncZoom.mutateAsync({
        sync_recordings: true,
        sync_transcripts: true,
      });
    } catch (err) {
      console.error("Sync error:", err);
    }
  };

  const handleSaveOrgConfig = async () => {
    if (!zoomProvider) return;
    
    setIsSavingConfig(true);
    try {
      await updateIntegration.mutateAsync({
        providerId: zoomProvider.id,
        config: orgConfigValues,
        enabled: true,
      });
      
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      
      toast({
        title: "Configuration saved",
        description: "Zoom organization configuration has been saved successfully.",
      });
    } catch (err: any) {
      console.error("Save config error:", err);
      toast({
        title: "Save failed",
        description: err.message || "Failed to save configuration",
        variant: "destructive",
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleFieldChange = (fieldKey: string, value: string) => {
    setOrgConfigValues((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
  };

  // Check if all required fields are filled
  const hasRequiredFields = integrationFields?.every((field) => {
    if (!field.is_required) return true;
    return !!orgConfigValues[field.field_key];
  }) ?? false;

  // Calculate statistics
  const meetingsCount = meetings?.length || 0;
  const upcomingMeetings = meetings?.filter((m) => {
    if (!m.scheduled_at) return false;
    return new Date(m.scheduled_at) > new Date();
  }).length || 0;
  const completedMeetings = meetings?.filter((m) => m.status === 'completed').length || 0;

  if (checkingStatus) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <Link 
          to="/admin/integrations" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Integrations
        </Link>
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 shadow-lg">
              <Video className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent">
                Zoom Integration
              </h1>
              <p className="text-muted-foreground mt-2 text-base">
                Connect your Zoom account to sync meetings, recordings, and transcripts
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="flex items-center gap-2"
          >
            <Link to="/admin/integrations/zoom/documentation">
              <BookOpen className="h-4 w-4" />
              Documentation
            </Link>
          </Button>
        </div>

        {/* Statistics Cards */}
        {isConnected && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="border-2 hover:shadow-lg transition-all duration-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10">
                    <Video className="h-6 w-6 text-info dark:text-blue-400" />
                  </div>
                  <TrendingUp className="h-4 w-4 text-success opacity-60" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-foreground">{meetingsCount}</p>
                  <p className="text-sm text-muted-foreground mt-1">Total Meetings</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-all duration-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/10">
                    <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <TrendingUp className="h-4 w-4 text-success opacity-60" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-foreground">{upcomingMeetings}</p>
                  <p className="text-sm text-muted-foreground mt-1">Upcoming</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-all duration-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/10">
                    <CheckCircle2 className="h-6 w-6 text-success dark:text-green-400" />
                  </div>
                  <TrendingUp className="h-4 w-4 text-success opacity-60" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-foreground">{completedMeetings}</p>
                  <p className="text-sm text-muted-foreground mt-1">Completed</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-all duration-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-indigo-600/10">
                    <Zap className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <Badge variant="outline" className="border-success/30 text-success dark:border-green-800 dark:text-green-300">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-foreground">
                    {isOrgConfigured ? "✓" : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Org Config</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="grid gap-6">
        {/* Configuration Card */}
        <Card className="border-2 border-info/30 dark:border-blue-800 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/10">
                    <Video className="h-5 w-5 text-info dark:text-blue-400" />
                  </div>
                  OAuth Configuration
                </CardTitle>
                <CardDescription className="mt-2 text-base">
                  Configure your Zoom OAuth app with these settings
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-2 border-info/30 dark:border-blue-800 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-md bg-blue-200 dark:bg-blue-900/50">
                      <ExternalLink className="h-4 w-4 text-info dark:text-blue-300" />
                    </div>
                    <p className="text-sm font-bold text-info dark:text-blue-100">
                      Redirect URL (OAuth Callback)
                    </p>
                  </div>
                  <p className="text-sm text-info dark:text-blue-300 mb-3 ml-7">
                    Add this URL to your Zoom OAuth app settings in the Zoom Marketplace
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-card dark:bg-gray-900 rounded-lg border-2 border-info/30 dark:border-blue-800 shadow-sm">
                    <code className="text-xs font-mono text-info dark:text-blue-100 flex-1 break-all">
                      {redirectUrl}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyRedirectUrl}
                      className="h-9 w-9 p-0 hover:bg-info/10 dark:hover:bg-blue-950/30"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                Setup Steps:
              </p>
              <ol className="text-sm text-muted-foreground space-y-2.5 list-decimal list-inside ml-2">
                <li className="pl-2">Go to <a href="https://marketplace.zoom.us/develop/create" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 font-medium">Zoom Marketplace <ExternalLink className="h-3 w-3" /></a></li>
                <li className="pl-2">Create or edit your OAuth app</li>
                <li className="pl-2">Add the Redirect URL above to your app settings</li>
                <li className="pl-2">Copy your Client ID and Client Secret</li>
                <li className="pl-2">Go to <Link to="/admin/integrations/zoom" className="text-primary hover:underline font-medium">Zoom Integration Settings</Link> and enter your credentials</li>
              </ol>
            </div>

            <Separator />

            <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-2 border-amber-200 dark:border-amber-800 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                    Required Scopes
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Make sure to request these scopes in your Zoom app: <code className="bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded font-mono text-xs">meeting:read</code>, <code className="bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded font-mono text-xs">recording:read</code>, and <code className="bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded font-mono text-xs">user:read</code>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organization Configuration Card */}
        <Card className={`border-2 shadow-lg hover:shadow-xl transition-shadow ${isOrgConfigured ? 'border-success/30 dark:border-green-800' : 'border-amber-200 dark:border-amber-800'}`}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-3 text-xl mb-2">
                  <div className={`p-2 rounded-lg ${isOrgConfigured ? 'bg-gradient-to-br from-green-500/10 to-green-600/10' : 'bg-gradient-to-br from-amber-500/10 to-amber-600/10'}`}>
                    <Settings className={`h-5 w-5 ${isOrgConfigured ? 'text-success dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`} />
                  </div>
                  Organization Configuration
                  {isOrgConfigured ? (
                    <Badge variant="outline" className="ml-3 border-success/30 text-success dark:border-green-800 dark:text-green-300 bg-success/10 dark:bg-green-950/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Configured
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="ml-3 border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Setup Required
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-base">
                  {isOrgConfigured 
                    ? "Zoom OAuth credentials are configured. Users can now connect their accounts."
                    : "Enter your Zoom OAuth credentials to enable user connections."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {!isOrgConfigured && (
              <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-2 border-amber-200 dark:border-amber-800 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-amber-200 dark:bg-amber-900/50">
                    <AlertCircle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-amber-900 dark:text-amber-100 text-base mb-2">Configuration Required</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                      You must configure the Zoom OAuth credentials before users can connect their Zoom accounts. 
                      Get your Client ID and Client Secret from the{" "}
                      <a href="https://marketplace.zoom.us/develop/apps" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100">
                        Zoom Marketplace
                      </a>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Credential Fields */}
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
              <div className="text-sm text-muted-foreground">
                Loading configuration fields...
              </div>
            )}

            <Separator />

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleSaveOrgConfig}
                disabled={isSavingConfig || !hasRequiredFields}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-primary-foreground shadow-md hover:shadow-lg transition-all"
              >
                {isSavingConfig ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>

            {isOrgConfigured && (
              <div className="rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-2 border-success/30 dark:border-green-800 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-green-200 dark:bg-green-900/50">
                    <CheckCircle2 className="h-5 w-5 text-success dark:text-green-300" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-success dark:text-green-100 text-base mb-2">Configuration Active</p>
                    <p className="text-sm text-success dark:text-green-300 leading-relaxed">
                      Users can now connect their personal Zoom accounts using the connection section below.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection Status Card */}
        <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/20">
                <Video className="h-5 w-5 text-primary" />
              </div>
              Connection Status
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Current Zoom account connection status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-2 border-success/30 dark:border-green-800 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-green-200 dark:bg-green-900/50 shadow-sm">
                      <CheckCircle2 className="h-6 w-6 text-success dark:text-green-300" />
                    </div>
                    <div>
                      <p className="font-bold text-success dark:text-green-100 text-base">Connected</p>
                      <p className="text-sm text-success dark:text-green-300 mt-1">
                        {zoomToken?.account_email || zoomToken?.account_name || 'Zoom account'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleDisconnect}
                    disabled={loading || disconnectOAuth.isPending}
                    className="border-destructive/30 hover:bg-destructive/10 dark:border-red-800 dark:hover:bg-red-950/30 hover:border-destructive/30 transition-colors"
                  >
                    {disconnectOAuth.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Disconnecting...
                      </>
                    ) : (
                      "Disconnect"
                    )}
                  </Button>
                </div>

                {/* Token Status Warnings */}
                {isExpired && (
                  <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-2 border-amber-200 dark:border-amber-800 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-amber-200 dark:bg-amber-900/50 shadow-sm">
                        <AlertCircle className="h-6 w-6 text-amber-700 dark:text-amber-300" />
                      </div>
                      <div>
                        <p className="font-bold text-amber-900 dark:text-amber-100 text-base">Token Expired</p>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          Please disconnect and reconnect to refresh your connection
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {hasError && errorMessage && (
                  <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border-2 border-destructive/30 dark:border-red-800 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-red-200 dark:bg-red-900/50 shadow-sm">
                        <AlertCircle className="h-6 w-6 text-destructive dark:text-red-300" />
                      </div>
                      <div>
                        <p className="font-bold text-destructive dark:text-red-100 text-base">Connection Error</p>
                        <p className="text-sm text-destructive dark:text-red-300 mt-1">
                          {errorMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {!isOrgConfigured && (
                  <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-2 border-amber-200 dark:border-amber-800 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-amber-200 dark:bg-amber-900/50 shadow-sm">
                        <AlertCircle className="h-6 w-6 text-amber-700 dark:text-amber-300" />
                      </div>
                      <div>
                        <p className="font-bold text-amber-900 dark:text-amber-100 text-base">Organization Setup Required</p>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          An administrator must configure the Zoom OAuth credentials above before you can connect.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border-2 border-muted shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-muted shadow-sm">
                      <AlertCircle className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-bold text-base">Not connected</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {isOrgConfigured 
                          ? "Connect to enable Zoom features"
                          : "Configure organization credentials first"}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleConnect}
                    disabled={loading || connectOAuth.isPending || !isOrgConfigured}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-primary-foreground shadow-md hover:shadow-lg transition-all"
                  >
                    {loading || connectOAuth.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Video className="mr-2 h-4 w-4" />
                        Connect with Zoom
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
            
            {error && (
              <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-destructive">{error}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sync Zoom Meetings Card */}
        {isConnected && hasValidToken && (
          <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-600/10">
                  <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                Sync Zoom Meetings
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Import your Zoom meetings, recordings, and transcripts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Button
                onClick={handleSyncMeetings}
                disabled={syncZoom.isPending || !hasValidToken}
                variant="secondary"
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-primary-foreground shadow-md hover:shadow-lg transition-all"
              >
                {syncZoom.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync All Meetings
                  </>
                )}
              </Button>
              
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sync and refresh your Zoom meetings, recordings, and transcripts.
              </p>

              {syncZoom.isSuccess && (
                <div className="rounded-xl border-2 border-success/30 bg-gradient-to-br from-green-50 to-emerald-50 dark:border-green-800 dark:from-green-950/50 dark:to-emerald-950/30 p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-200 dark:bg-green-900/50">
                      <CheckCircle2 className="h-5 w-5 text-success dark:text-green-300" />
                    </div>
                    <span className="text-success dark:text-green-100 font-bold text-base">
                      Meetings synced successfully
                    </span>
                  </div>
                </div>
              )}

              {meetings && meetings.length > 0 && (
                <Button variant="outline" size="lg" asChild className="w-full sm:w-auto border-2 hover:bg-muted/50 transition-colors">
                  <Link to="/admin/integrations/zoom/meetings">
                    <Eye className="mr-2 h-4 w-4" />
                    View All Synced Meetings ({meetings.length})
                  </Link>
                </Button>
              )}

              <Separator />

              <div className="rounded-lg bg-muted/50 p-4 border border-muted">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="font-semibold">Note:</strong> Requires Zoom OAuth permissions for meeting:read and recording:read.
                  If you see a permission error, disconnect and reconnect your Zoom account.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Zoom Meeting Card */}
        {isConnected && hasValidToken && (
          <Card className="border-2 hover:border-primary/50 transition-all shadow-lg hover:shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/10">
                  <Video className="h-5 w-5 text-info dark:text-blue-400" />
                </div>
                Create Zoom Meeting
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Schedule a new Zoom meeting directly from the app
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <CreateZoomMeetingDialog 
                trigger={
                  <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-primary-foreground shadow-md hover:shadow-lg transition-all">
                    <Plus className="mr-2 h-4 w-4" />
                    New Zoom Meeting
                  </Button>
                }
              />
              
              <div className="rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 p-4 border-2 border-muted shadow-sm">
                <p className="text-sm text-muted-foreground flex items-start gap-3 leading-relaxed">
                  <Video className="h-5 w-5 mt-0.5 flex-shrink-0 text-info dark:text-blue-400" />
                  <span>
                    Create meetings with title, time, agenda, and optional attendees. The meeting will be saved locally and attendees will receive email invites.
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Account Information Card */}
        {isConnected && zoomToken && (
          <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/10 to-indigo-600/10">
                  <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                Account Information
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Details about your connected Zoom account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {zoomToken.account_name && (
                <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-muted shadow-sm">
                  <span className="text-sm font-semibold">Name</span>
                  <span className="text-sm text-muted-foreground font-medium">{zoomToken.account_name}</span>
                </div>
              )}
              {zoomToken.account_email && (
                <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-muted shadow-sm">
                  <span className="text-sm font-semibold">Email</span>
                  <span className="text-sm text-muted-foreground font-medium">{zoomToken.account_email}</span>
                </div>
              )}
              {zoomToken.scopes && zoomToken.scopes.length > 0 && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-muted shadow-sm">
                  <span className="text-sm font-semibold block mb-3">Scopes</span>
                  <div className="flex flex-wrap gap-2">
                    {zoomToken.scopes.map((scope) => (
                      <Badge key={scope} variant="secondary" className="text-xs font-mono">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {zoomToken.last_used_at && (
                <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-muted shadow-sm">
                  <span className="text-sm font-semibold">Last Used</span>
                  <span className="text-sm text-muted-foreground font-medium">
                    {new Date(zoomToken.last_used_at).toLocaleString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

