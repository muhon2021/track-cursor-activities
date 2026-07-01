/**
 * Microsoft Teams Integration Page
 * Allows users to connect their Microsoft account for Teams integration and SSO
 */

import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2, AlertCircle, Loader2, Play, User, Clock, Key, Users, RefreshCw, ChevronDown, ChevronRight, Hash, Lock, Share2, Calendar, Video, Plus, MessageSquare, Eye, CalendarDays, ArrowLeft, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MicrosoftCalendarView } from "@/components/integrations/MicrosoftCalendarView";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  initiateAzureLoginRedirect, 
  getStoredMSALResponse, 
  completeAzureLoginFromRedirect,
  clearStoredGraphResponse,
} from "@/lib/azureAuth";
import { validateMSALConfig, getMSALInstance } from "@/lib/msalConfig";
import { supabase } from "@/integrations/supabase/client";
import { 
  testGraphConnection, 
  GraphUser, 
  TokenMetadata,
  GraphError,
  getAccessToken,
  getTokenMetadata,
} from "@/lib/microsoftGraphClient";
import { useMicrosoftTeams } from "@/hooks/useMicrosoftTeams";
import { useMicrosoftTeamsChannels } from "@/hooks/useMicrosoftTeamsChannels";
import { useSyncTeamsMeetings } from "@/hooks/useSyncTeamsMeetings";
import { CreateTeamsMeetingDialog } from "@/components/meetings/CreateTeamsMeetingDialog";
import { SendTeamsMessageDialog } from "@/components/integrations/SendTeamsMessageDialog";
import { ChannelMessagesSection } from "@/components/integrations/ChannelMessagesSection";
import { cn } from "@/lib/utils";
import { integrationKeys } from "@/hooks/useIntegrations";

interface GraphTestResult {
  success: boolean;
  user?: GraphUser;
  tokenMetadata?: TokenMetadata;
  error?: string;
  errorType?: string;
}

export default function MicrosoftTeamsIntegration() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = searchParams.get("returnTo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  
  // Graph API test state
  const [testingGraph, setTestingGraph] = useState(false);
  const [graphResult, setGraphResult] = useState<GraphTestResult | null>(null);

  // Microsoft Teams hook
  const { 
    teams, 
    isLoading: teamsLoading, 
    syncTeams, 
    isSyncing,
    syncError,
    lastSynced 
  } = useMicrosoftTeams();

  // Microsoft Teams Channels hook
  const {
    channels,
    syncTeamChannels,
    isSyncingTeam,
    syncTeamError,
    getChannelsForTeam,
  } = useMicrosoftTeamsChannels();

  // Teams Meetings Sync hook
  const syncTeamsMeetings = useSyncTeamsMeetings();

  const [syncingTeamId, setSyncingTeamId] = useState<string | null>(null);
  const [hasValidToken, setHasValidToken] = useState<boolean | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [refreshingToken, setRefreshingToken] = useState(false);

  const toggleTeamExpanded = (teamId: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const handleSyncChannels = async (teamId: string) => {
    setSyncingTeamId(teamId);
    try {
      await syncTeamChannels(teamId);
      setExpandedTeams(prev => new Set(prev).add(teamId));
      toast({
        title: "Channels synced",
        description: "Team channels have been synced successfully.",
      });
    } catch (err) {
      console.error('Failed to sync channels:', err);
      toast({
        title: "Sync failed",
        description: err instanceof Error ? err.message : "Failed to sync channels",
        variant: "destructive",
      });
    } finally {
      setSyncingTeamId(null);
    }
  };

  // Check token validity when connected
  useEffect(() => {
    const validateToken = async () => {
      if (isConnected) {
        try {
          await getAccessToken();
          setHasValidToken(true);
        } catch {
          setHasValidToken(false);
        }
      }
    };
    validateToken();
  }, [isConnected]);

  useEffect(() => {
    const checkConnectionAndHandleRedirect = async () => {
      try {
        const storedResponse = getStoredMSALResponse();
        if (storedResponse && storedResponse.accessToken) {
          setLoading(true);
          try {
            const result = await completeAzureLoginFromRedirect();
            if (result?.user) {
              setIsConnected(true);
              setHasValidToken(true);
              localStorage.setItem('isAzureADUser', 'true');
              
              // Update organization_integrations table
              const { data: microsoftTeamsProvider } = await supabase
                .from('integration_providers')
                .select('id')
                .eq('slug', 'microsoft-teams')
                .single();
              
              if (microsoftTeamsProvider && user) {
                await supabase
                  .from('organization_integrations')
                  .upsert({
                    user_id: user.id,
                    provider_id: microsoftTeamsProvider.id,
                    enabled: true,
                    connection_status: 'connected',
                    last_tested_at: new Date().toISOString(),
                  }, {
                    onConflict: 'user_id,provider_id',
                  });
                
                // Invalidate queries to refresh the UI
                queryClient.invalidateQueries({ queryKey: integrationKeys.orgIntegrations() });
              }
              
              toast({
                title: "Connected successfully!",
                description: "Your Microsoft account has been connected.",
              });

              // If we were sent here from e.g. Create Meeting dialog, store token for user_oauth_tokens and redirect back
              if (returnTo && storedResponse?.accessToken) {
                try {
                  let { data: { session } } = await supabase.auth.getSession();
                  if (!session) {
                    await supabase.auth.refreshSession();
                    const next = await supabase.auth.getSession();
                    session = next.data.session;
                  }
                  if (session) {
                    const metadata = getTokenMetadata(storedResponse.accessToken);
                    const expires_in = metadata
                      ? Math.max(60, Math.round((metadata.expiresAt.getTime() - Date.now()) / 1000))
                      : 3600;
                    const { error: storeError } = await supabase.functions.invoke("user-oauth-store-token", {
                      body: {
                        provider: "microsoft-teams",
                        access_token: storedResponse.accessToken,
                        expires_in,
                        account_email: storedResponse.account?.username ?? undefined,
                        account_name: storedResponse.account?.name ?? undefined,
                      },
                    });
                    if (storeError) {
                      console.error("Failed to store token for return flow:", storeError);
                      toast({
                        title: "Connection saved",
                        description: "Redirecting you back.",
                      });
                    }
                  } else {
                    toast({
                      title: "Session expired",
                      description: "Please log in again. Redirecting you back.",
                      variant: "destructive",
                    });
                  }
                  navigate(returnTo, { replace: true });
                  return;
                } catch (storeErr) {
                  console.error("Error storing token:", storeErr);
                  navigate(returnTo, { replace: true });
                  return;
                }
              }
            }
          } catch (err: any) {
            console.error('Error completing redirect login:', err);
            setError(err.message || 'Failed to complete authentication');
          } finally {
            setLoading(false);
          }
        }
        
        const isAzureADUser = localStorage.getItem('isAzureADUser') === 'true';
        setIsConnected(isAzureADUser);
        
        // Also check and update org integration if connected via localStorage
        if (isAzureADUser && user) {
          const { data: microsoftTeamsProvider } = await supabase
            .from('integration_providers')
            .select('id')
            .eq('slug', 'microsoft-teams')
            .single();
          
          if (microsoftTeamsProvider) {
            const { data: existingIntegration } = await supabase
              .from('organization_integrations')
              .select('*')
              .eq('user_id', user.id)
              .eq('provider_id', microsoftTeamsProvider.id)
              .maybeSingle();
            
            // Only update if not already connected
            if (!existingIntegration || existingIntegration.connection_status !== 'connected') {
              await supabase
                .from('organization_integrations')
                .upsert({
                  user_id: user.id,
                  provider_id: microsoftTeamsProvider.id,
                  enabled: true,
                  connection_status: 'connected',
                  last_tested_at: new Date().toISOString(),
                }, {
                  onConflict: 'user_id,provider_id',
                });
              
              queryClient.invalidateQueries({ queryKey: integrationKeys.orgIntegrations() });
            }
          }
        }
      } catch (error) {
        console.error('Error checking connection status:', error);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkConnectionAndHandleRedirect();
  }, [user, toast, queryClient]);

  const handleRefreshConnection = async () => {
    setRefreshingToken(true);
    try {
      const authResult = await initiateAzureLoginRedirect();
      if (authResult) {
        const result = await completeAzureLoginFromRedirect();
        if (result?.user) {
          setHasValidToken(true);
          toast({
            title: "Connection Refreshed",
            description: "Your Microsoft session has been renewed.",
          });
        }
      }
    } catch (err: any) {
      console.error("Refresh connection error:", err);
      const isCancelled = err?.message === "Authentication window was closed";
      toast({
        title: isCancelled ? "Refresh cancelled" : "Refresh Failed",
        description: isCancelled ? "You closed the sign-in window. Try again when you're ready." : "Please try disconnecting and reconnecting your account.",
        variant: isCancelled ? "default" : "destructive",
      });
    } finally {
      setRefreshingToken(false);
    }
  };


  const handleConnect = async () => {
    setLoading(true);
    setError("");
    
    try {
      const configValidation = validateMSALConfig();
      if (!configValidation.valid) {
        throw new Error(`MSAL configuration error: ${configValidation.errors.join(', ')}. Please configure environment variables.`);
      }

      const authResult = await initiateAzureLoginRedirect();
      
      if (authResult) {
        const result = await completeAzureLoginFromRedirect();
        if (result?.user) {
          setIsConnected(true);
          localStorage.setItem('isAzureADUser', 'true');
          
          // Update organization_integrations table
          const { data: microsoftTeamsProvider } = await supabase
            .from('integration_providers')
            .select('id')
            .eq('slug', 'microsoft-teams')
            .single();
          
          if (microsoftTeamsProvider && user) {
            await supabase
              .from('organization_integrations')
              .upsert({
                user_id: user.id,
                provider_id: microsoftTeamsProvider.id,
                enabled: true,
                connection_status: 'connected',
                last_tested_at: new Date().toISOString(),
              }, {
                onConflict: 'user_id,provider_id',
              });
            
            // Invalidate queries to refresh the UI
            queryClient.invalidateQueries({ queryKey: integrationKeys.orgIntegrations() });
          }
          
          toast({
            title: "Connected successfully!",
            description: "Your Microsoft account has been connected.",
          });
        }
      }
    } catch (err: any) {
      console.error("Microsoft connection error:", err);
      const msg = err?.message || "Failed to connect to Microsoft";
      const isCancelled = msg === "Authentication window was closed";
      setError(isCancelled ? "" : msg);
      toast({
        title: isCancelled ? "Sign-in cancelled" : "Connection failed",
        description: isCancelled ? "You closed the sign-in window. Connect again when you're ready." : msg,
        variant: isCancelled ? "default" : "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      // 1. Clear MSAL cache and accounts (only MSAL-related, not main app session)
      try {
        const msalInstance = await getMSALInstance();
        const accounts = msalInstance.getAllAccounts();
        
        // Clear MSAL cache (removeAccount doesn't exist, use clearCache or logout)
        if (accounts.length > 0) {
          // Clear the MSAL cache to remove stored tokens
          await msalInstance.clearCache();
        }
      } catch (error) {
        console.error('Error clearing MSAL accounts:', error);
        // Continue even if MSAL cleanup fails
      }

      // 2. Clear only MSAL-related sessionStorage items (not all sessionStorage)
      sessionStorage.removeItem('msal_auth_response');
      clearStoredGraphResponse();
      sessionStorage.removeItem('msal_redirect_pending');
      sessionStorage.removeItem('msal_auth_window_pending');
      sessionStorage.removeItem('msal_code_verifier');
      sessionStorage.removeItem('msal_state');
      sessionStorage.removeItem('msal_auth_result');
      
      // Clear MSAL cache from sessionStorage (MSAL stores cache with specific keys)
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('msal.') || key.startsWith('msal-')) {
          sessionStorage.removeItem(key);
        }
      });

      // 3. Delete Microsoft Teams data from database
      if (user?.id) {
        // Delete Teams channels first (foreign key constraint)
        await supabase
          .from('user_microsoft_teams_channels')
          .delete()
          .eq('user_id', user.id);
        
        // Delete Teams
        await supabase
          .from('user_microsoft_teams')
          .delete()
          .eq('user_id', user.id);
      }

      // 4. Disconnect OAuth token if it exists in user_oauth_tokens
      try {
        await supabase.functions.invoke('user-oauth-disconnect', {
          body: { provider: 'microsoft' },
        });
      } catch (error) {
        // Log but don't fail - token might not exist
        console.log('No OAuth token to disconnect or error:', error);
      }

      // 5. Invalidate React Query cache to refresh UI
      queryClient.invalidateQueries({ queryKey: ['microsoft-teams'] });
      queryClient.invalidateQueries({ queryKey: ['microsoft-teams-channels'] });
      queryClient.invalidateQueries({ queryKey: ['user-oauth-tokens'] });
      queryClient.invalidateQueries({ queryKey: ['user-oauth-token', user?.id, 'microsoft'] });

      // 6. Update UI state
      setIsConnected(false);
      setGraphResult(null);
      
      toast({
        title: "Disconnected",
        description: "Your Microsoft Teams account has been disconnected. You remain logged in.",
      });
      
      // 7. DO NOT redirect to login - user should stay on the page
      
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

  const handleTestGraphAPI = async () => {
    setTestingGraph(true);
    setGraphResult(null);
    
    try {
      const result = await testGraphConnection();
      setGraphResult(result);
      
      if (result.success) {
        console.log('[Graph Test] Success:', result);
        toast({
          title: "Graph API Test Successful",
          description: `Connected as ${result.user?.displayName}`,
        });
      } else {
        console.error('[Graph Test] Failed:', result);
        toast({
          title: "Graph API Test Failed",
          description: result.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error('[Graph Test] Exception:', err);
      setGraphResult({
        success: false,
        error: err.message || "Test failed",
        errorType: err instanceof GraphError ? err.name : 'UnknownError',
      });
    } finally {
      setTestingGraph(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header Section */}
      <div className="mb-8">
        <Link 
          to="/admin/integrations" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Integrations
        </Link>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 shadow-lg">
              <Building2 className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
                Microsoft Teams Integration
              </h1>
              <p className="text-muted-foreground mt-1.5 text-base">
                Connect your Microsoft account to enable Teams integration and Single Sign-On (SSO)
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Connection Status Card */}
        <Card className="border-2 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10 dark:bg-blue-400/10">
                <Building2 className="h-5 w-5 text-info dark:text-blue-400" />
              </div>
              <span>Connection Status</span>
            </CardTitle>
            <CardDescription className="text-sm">
              Current Microsoft account connection status
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isConnected ? (
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950/50 dark:via-emerald-950/30 dark:to-teal-950/30 border-2 border-success/30 dark:border-green-800 p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-success dark:bg-success shadow-md">
                        <CheckCircle2 className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="font-bold text-lg text-success dark:text-green-100">Connected</p>
                        <p className="text-sm text-success dark:text-green-300 mt-0.5">
                          {user?.email || 'Microsoft user'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleDisconnect}
                      disabled={loading}
                      className="border-destructive/30 hover:bg-destructive/10 hover:border-red-400 dark:border-red-800 dark:hover:bg-red-950/50 text-destructive dark:text-red-400 font-medium"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Disconnecting...
                        </>
                      ) : (
                        'Disconnect'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 border-2 border-slate-200 dark:border-slate-800 p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-slate-200 dark:bg-slate-800">
                        <AlertCircle className="h-6 w-6 text-slate-500 dark:text-slate-400" />
                      </div>
                      <div>
                        <p className="font-bold text-lg">Not connected</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Connect to enable Teams features
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleConnect}
                      disabled={loading}
                      size="lg"
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-primary-foreground shadow-md font-medium"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Building2 className="mr-2 h-4 w-4" />
                          Connect with Microsoft
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {error && (
              <div className="mt-4 rounded-lg border-2 border-destructive/30 bg-destructive/10 dark:bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-destructive mb-1">Connection Error</p>
                    <p className="text-sm text-destructive/90">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Graph API Test Card */}
        {isConnected && (
          <Card className="border-2 shadow-md">
            <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 pb-4">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 dark:bg-cyan-400/10">
                  <Play className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                Test Graph API
              </CardTitle>
              <CardDescription className="text-sm">
                Validate your Microsoft Graph API connection by calling GET /me
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <Button
                onClick={handleTestGraphAPI}
                disabled={testingGraph}
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto font-medium"
              >
                {testingGraph ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Test GET /me
                  </>
                )}
              </Button>

              {graphResult && (
                <div className={`rounded-xl border-2 p-5 ${
                  graphResult.success 
                    ? 'border-success/30 bg-gradient-to-br from-green-50 to-emerald-50 dark:border-green-800 dark:from-green-950/50 dark:to-emerald-950/30' 
                    : 'border-destructive/30 bg-destructive/5'
                }`}>
                  {graphResult.success ? (
                    <div className="space-y-4">
                      {/* User Info */}
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-success/10 dark:bg-green-900/50">
                          <User className="h-5 w-5 text-success dark:text-green-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-success dark:text-green-100 text-base">
                            {graphResult.user?.displayName}
                          </p>
                          <p className="text-sm text-success dark:text-green-300 mt-0.5">
                            {graphResult.user?.mail || graphResult.user?.userPrincipalName}
                          </p>
                          <p className="text-xs text-success dark:text-green-400 font-mono mt-2 bg-success/10 dark:bg-green-900/50 px-2 py-1 rounded">
                            ID: {graphResult.user?.id}
                          </p>
                        </div>
                      </div>

                      {/* Token Info */}
                      {graphResult.tokenMetadata && (
                        <div className="border-t border-success/30 dark:border-green-800 pt-4 space-y-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-success dark:text-green-400" />
                            <span className="text-success dark:text-green-200 font-medium">
                              Token expires in {graphResult.tokenMetadata.expiresInMinutes} minutes
                            </span>
                          </div>
                          <div className="flex items-start gap-2 text-sm">
                            <Key className="h-4 w-4 text-success dark:text-green-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <span className="text-success dark:text-green-200 font-medium">Scopes: </span>
                              <span className="font-mono text-xs text-success dark:text-green-300 bg-success/10 dark:bg-green-900/50 px-2 py-1 rounded block mt-1">
                                {graphResult.tokenMetadata.scopes.join(', ')}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <p className="font-semibold text-destructive">
                          {graphResult.errorType || 'Error'}
                        </p>
                      </div>
                      <p className="text-sm text-destructive/90 pl-7">
                        {graphResult.error}
                      </p>
                      {graphResult.errorType === 'UnauthorizedError' && (
                        <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-muted">
                          <p className="text-xs text-muted-foreground">
                            💡 Try disconnecting and reconnecting your Microsoft account to refresh permissions.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Microsoft Calendar View Card */}
        {isConnected && (
          <Card className="border-2 shadow-md">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 pb-4">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10 dark:bg-indigo-400/10">
                  <CalendarDays className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                Microsoft Calendar
              </CardTitle>
              <CardDescription className="text-sm">
                View your Outlook calendar events in a weekly view
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <Button
                onClick={() => setShowCalendar(!showCalendar)}
                variant={showCalendar ? "secondary" : "default"}
                size="lg"
                className="w-full sm:w-auto font-medium"
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                {showCalendar ? 'Hide Calendar' : 'View Calendar'}
              </Button>
              
              {showCalendar && (
                <div className="mt-4">
                  <MicrosoftCalendarView onClose={() => setShowCalendar(false)} />
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Requires the <code className="bg-muted px-1 rounded">Calendars.Read</code> permission.
                Teams meetings you create will automatically appear here.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Sync Teams Meetings Card */}
        {isConnected && (
          <Card className="border-2 shadow-md">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 pb-4">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 dark:bg-purple-400/10">
                  <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                Sync Teams Meetings
              </CardTitle>
              <CardDescription className="text-sm">
                Import your Microsoft Teams online meetings to the app
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {/* Token expired warning */}
              {hasValidToken === false && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/50">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-amber-900 dark:text-amber-100">Session Expired</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Refresh your connection to sync meetings
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleRefreshConnection}
                    disabled={refreshingToken}
                    className="border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/30"
                  >
                    {refreshingToken ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh Connection
                      </>
                    )}
                  </Button>
                </div>
              )}

              <Button
                onClick={() => syncTeamsMeetings.mutate({ source: 'both' })}
                disabled={syncTeamsMeetings.isPending || hasValidToken === false}
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto font-medium"
              >
                {syncTeamsMeetings.isPending ? (
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
              
              <p className="text-sm text-muted-foreground">
                Sync and refresh your Teams meetings from Microsoft Graph.
              </p>

              {syncTeamsMeetings.data && (
                <div className="rounded-xl border-2 border-success/30 bg-gradient-to-br from-green-50 to-emerald-50 dark:border-green-800 dark:from-green-950/50 dark:to-emerald-950/30 p-5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-full bg-success/10 dark:bg-green-900/50">
                        <CheckCircle2 className="h-4 w-4 text-success dark:text-green-400" />
                      </div>
                      <span className="text-success dark:text-green-100 font-semibold">
                        {syncTeamsMeetings.data.updated > 0 
                          ? `${syncTeamsMeetings.data.updated} meeting${syncTeamsMeetings.data.updated !== 1 ? 's' : ''} refreshed`
                          : 'Meetings up to date'}
                      </span>
                    </div>
                    {syncTeamsMeetings.data.errors > 0 && (
                      <p className="text-amber-700 dark:text-amber-400 ml-8 text-sm font-medium">
                        {syncTeamsMeetings.data.errors} error{syncTeamsMeetings.data.errors !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <Button variant="outline" size="lg" asChild>
                <Link to="/admin/integrations/microsoft-teams/meetings">
                  <Eye className="mr-2 h-4 w-4" />
                  View All Synced Meetings
                </Link>
              </Button>

              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Requires the <code className="bg-muted px-1 rounded">OnlineMeetings.ReadWrite</code> permission.
                If you see a permission error, disconnect and reconnect your Microsoft account.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Create Teams Meeting Card */}
        {isConnected && (
          <Card className="border-2 shadow-md hover:shadow-lg transition-all hover:border-info/30 dark:hover:border-blue-700">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 pb-4">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10 dark:bg-blue-400/10">
                  <Video className="h-5 w-5 text-info dark:text-blue-400" />
                </div>
                Create Teams Meeting
              </CardTitle>
              <CardDescription className="text-sm">
                Schedule a new Microsoft Teams meeting directly from the app
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <CreateTeamsMeetingDialog 
                trigger={
                  <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-primary-foreground shadow-md font-medium">
                    <Plus className="mr-2 h-4 w-4" />
                    New Teams Meeting
                  </Button>
                }
              />
              
              <div className="rounded-lg bg-muted/50 p-3 border border-muted">
                <p className="text-sm text-muted-foreground flex items-start gap-2">
                  <Video className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Create meetings with title, time, and optional attendees. The meeting will be saved locally and attendees will receive email invites.
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Channel Messages Card */}
        {isConnected && (
          <ChannelMessagesSection 
            teams={teams}
            getChannelsForTeam={getChannelsForTeam}
          />
        )}

        {/* Your Teams Card */}
        {isConnected && (
          <Card className="border-2 shadow-md">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-indigo-500/10 dark:bg-indigo-400/10">
                      <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    Your Teams
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Teams you're a member of in Microsoft Teams
                    {lastSynced && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        · Last synced: {new Date(lastSynced).toLocaleString()}
                      </span>
                    )}
                  </CardDescription>
                </div>
                <Button
                  onClick={() => syncTeams().catch(console.error)}
                  disabled={isSyncing}
                  variant="secondary"
                  size="sm"
                  className="font-medium"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync Teams
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">

              {syncError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <p className="text-sm text-destructive">
                    {syncError instanceof Error ? syncError.message : 'Sync failed'}
                  </p>
                  {syncError instanceof Error && syncError.message?.includes('permission') && (
                    <p className="text-xs text-muted-foreground mt-1">
                      You may need to disconnect and reconnect to grant Teams access.
                    </p>
                  )}
                </div>
              )}

              {teamsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : teams.length > 0 ? (
                <div className="space-y-2">
                  {teams.map((team) => {
                    const teamChannels = getChannelsForTeam(team.team_id);
                    const isExpanded = expandedTeams.has(team.team_id);
                    const isSyncingThisTeam = syncingTeamId === team.team_id;
                    
                    return (
                      <Collapsible key={team.id} open={isExpanded}>
                        <div className="rounded-lg border bg-card hover:border-primary/50 transition-colors">
                          <div className="flex items-center justify-between p-4">
                            <CollapsibleTrigger 
                              onClick={() => toggleTeamExpanded(team.team_id)}
                              className="flex items-center gap-3 flex-1 text-left hover:bg-muted/50 -m-2 p-2 rounded transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div className="flex-1">
                                <p className="font-semibold text-base">{team.display_name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {teamChannels.length} channel{teamChannels.length !== 1 ? 's' : ''} synced
                                  {team.description && ` · ${team.description.slice(0, 50)}${team.description.length > 50 ? '...' : ''}`}
                                </p>
                              </div>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSyncChannels(team.team_id);
                                }}
                                disabled={isSyncingThisTeam}
                                title="Sync channels"
                                className="h-8 w-8 p-0"
                              >
                                <RefreshCw className={cn(
                                  "h-4 w-4",
                                  isSyncingThisTeam && "animate-spin"
                                )} />
                              </Button>
                              {team.visibility && (
                                <Badge variant="outline" className="text-xs">
                                  {team.visibility}
                                </Badge>
                              )}
                              {team.is_archived && (
                                <Badge variant="secondary" className="text-xs">Archived</Badge>
                              )}
                            </div>
                          </div>
                          
                          <CollapsibleContent>
                            <div className="border-t px-4 py-3 space-y-1.5 bg-muted/20">
                              {teamChannels.length > 0 ? (
                                teamChannels.map(channel => (
                                  <div 
                                    key={channel.id}
                                    className="flex items-center gap-2.5 py-2 px-3 rounded-md hover:bg-muted/70 transition-colors"
                                  >
                                    {channel.membership_type === 'private' ? (
                                      <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    ) : channel.membership_type === 'shared' ? (
                                      <Share2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    ) : (
                                      <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    )}
                                    <span className="text-sm font-medium flex-1">{channel.display_name}</span>
                                    {channel.is_favorite && (
                                      <Badge variant="secondary" className="text-xs">Favorite</Badge>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground py-3 text-center">
                                  Click the sync button to fetch channels
                                </p>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No teams synced yet. Click "Sync Teams" to fetch your teams.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* SharePoint → Knowledge (separate hub provider; same Microsoft ecosystem) */}
        <Card className="border-2 shadow-md">
          <CardHeader className="bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10 dark:bg-sky-400/10">
                <Share2 className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              SharePoint knowledge sync
            </CardTitle>
            <CardDescription className="text-sm">
              Sync document library files into the Knowledge Base using an Azure AD app registration
              (application permissions). Configure credentials and run sync on the SharePoint integration page.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button variant="outline" asChild>
              <Link to="/admin/integrations/sharepoint">Open SharePoint integration</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Features Card */}
        <Card className="border-2 shadow-md">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 dark:bg-emerald-400/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              Features
            </CardTitle>
            <CardDescription className="text-sm">
              What you'll get with Microsoft Teams integration
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="p-2 rounded-lg bg-success/10 dark:bg-green-900/50 mt-0.5">
                  <CheckCircle2 className="h-5 w-5 text-success dark:text-green-400 flex-shrink-0" />
                </div>
                <div>
                  <p className="font-semibold mb-1">Single Sign-On (SSO)</p>
                  <p className="text-sm text-muted-foreground">
                    Sign in once with your Microsoft account and access all integrated services
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="p-2 rounded-lg bg-success/10 dark:bg-green-900/50 mt-0.5">
                  <CheckCircle2 className="h-5 w-5 text-success dark:text-green-400 flex-shrink-0" />
                </div>
                <div>
                  <p className="font-semibold mb-1">Teams Channel Access</p>
                  <p className="text-sm text-muted-foreground">
                    Access and manage Teams channels and messages directly from Control Tower
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="p-2 rounded-lg bg-success/10 dark:bg-green-900/50 mt-0.5">
                  <CheckCircle2 className="h-5 w-5 text-success dark:text-green-400 flex-shrink-0" />
                </div>
                <div>
                  <p className="font-semibold mb-1">Meeting Management</p>
                  <p className="text-sm text-muted-foreground">
                    Schedule and manage Teams meetings, sync calendar events
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="p-2 rounded-lg bg-success/10 dark:bg-green-900/50 mt-0.5">
                  <CheckCircle2 className="h-5 w-5 text-success dark:text-green-400 flex-shrink-0" />
                </div>
                <div>
                  <p className="font-semibold mb-1">File Sharing</p>
                  <p className="text-sm text-muted-foreground">
                    Share and access files from OneDrive and SharePoint
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Card */}
        <Card className="border-2 shadow-md">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 dark:bg-amber-400/10">
                <Settings className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              Configuration
            </CardTitle>
            <CardDescription className="text-sm">
              Required environment variables for Microsoft integration
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
                import.meta.env.VITE_MICROSOFT_CLIENT_ID 
                  ? 'bg-success/10 dark:bg-green-950/30 border-success/30 dark:border-green-800' 
                  : 'bg-destructive/10 dark:bg-red-950/30 border-destructive/30 dark:border-red-800'
              }`}>
                <span className="font-mono text-sm font-medium">VITE_MICROSOFT_CLIENT_ID</span>
                <span className={`font-semibold ${import.meta.env.VITE_MICROSOFT_CLIENT_ID ? "text-success dark:text-green-400" : "text-destructive dark:text-red-400"}`}>
                  {import.meta.env.VITE_MICROSOFT_CLIENT_ID ? "✓ Set" : "✗ Missing"}
                </span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
                import.meta.env.VITE_MICROSOFT_DIRECTORY_ID 
                  ? 'bg-success/10 dark:bg-green-950/30 border-success/30 dark:border-green-800' 
                  : 'bg-destructive/10 dark:bg-red-950/30 border-destructive/30 dark:border-red-800'
              }`}>
                <span className="font-mono text-sm font-medium">VITE_MICROSOFT_DIRECTORY_ID</span>
                <span className={`font-semibold ${import.meta.env.VITE_MICROSOFT_DIRECTORY_ID ? "text-success dark:text-green-400" : "text-destructive dark:text-red-400"}`}>
                  {import.meta.env.VITE_MICROSOFT_DIRECTORY_ID ? "✓ Set" : "✗ Missing"}
                </span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
                import.meta.env.VITE_MICROSOFT_REDIRECT_URI 
                  ? 'bg-success/10 dark:bg-green-950/30 border-success/30 dark:border-green-800' 
                  : 'bg-destructive/10 dark:bg-red-950/30 border-destructive/30 dark:border-red-800'
              }`}>
                <span className="font-mono text-sm font-medium">VITE_MICROSOFT_REDIRECT_URI</span>
                <span className={`font-semibold ${import.meta.env.VITE_MICROSOFT_REDIRECT_URI ? "text-success dark:text-green-400" : "text-destructive dark:text-red-400"}`}>
                  {import.meta.env.VITE_MICROSOFT_REDIRECT_URI ? "✓ Set" : "✗ Missing"}
                </span>
              </div>
            </div>
            {!import.meta.env.VITE_MICROSOFT_CLIENT_ID && (
              <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                  ⚠️ Please configure the required environment variables to enable Microsoft integration.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

