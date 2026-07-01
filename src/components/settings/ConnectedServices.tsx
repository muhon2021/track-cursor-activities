/**
 * Connected Services Component
 * Sprint 10: User Integration Connections
 * Displays and manages user's connected external services
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Loader2,
  Link2,
  Unlink,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  useUserOAuthTokens,
  useAvailableUserProviders,
  useConnectOAuth,
  useConnectActiveCollabToken,
  useDisconnectOAuth,
  useRefreshOAuthToken,
  UserOAuthToken,
  AvailableProvider,
} from '@/hooks/useUserIntegrations';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { syncClickupLocal, LocalClickupSyncResult } from '@/lib/clickupLocalSync';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Provider icons/logos
const providerIcons: Record<string, string> = {
  google: '🔵',
  zoom: '📹',
  microsoft: '🔷',
  activecollab: '🗂️',
  clickup: '📌',
};

interface ServiceCardProps {
  provider: AvailableProvider;
  connection?: UserOAuthToken;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  /** For providers without OAuth refresh (e.g. ActiveCollab issue-token). */
  onReconnect?: () => void;
  isConnecting: boolean;
  isDisconnecting: boolean;
  isRefreshing: boolean;
  onSync?: () => void;
  isSyncing?: boolean;
}

function ServiceCard({
  provider,
  connection,
  onConnect,
  onDisconnect,
  onRefresh,
  onReconnect,
  isConnecting,
  isDisconnecting,
  isRefreshing,
  onSync,
  isSyncing,
}: ServiceCardProps) {
  const isConnected = connection?.is_active;
  const isExpired = connection?.expires_at && new Date(connection.expires_at) <= new Date();
  const hasError = !!connection?.error_message;
  const isAnyActionPending = isConnecting || isDisconnecting || isRefreshing;

  return (
    <div
      className={`p-4 border-2 rounded-lg ${
        isConnected && !hasError ? 'border-green-500/50 bg-green-500/5' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="text-3xl">
            {providerIcons[provider.provider_slug] || '🔗'}
          </div>
          <div>
            <h4 className="font-semibold">{provider.provider_name}</h4>
            <p className="text-sm text-muted-foreground">{provider.description}</p>

            {isConnected && connection && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  {connection.account_avatar_url ? (
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={connection.account_avatar_url} />
                      <AvatarFallback>{connection.account_name?.[0]}</AvatarFallback>
                    </Avatar>
                  ) : null}
                  <span className="text-sm">
                    {connection.account_email || connection.account_name || 'Connected'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Connected{' '}
                  {formatDistanceToNow(new Date(connection.created_at), { addSuffix: true })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Badge */}
          {isConnected ? (
            hasError ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Error
              </Badge>
            ) : isExpired ? (
              <Badge variant="secondary" className="gap-1 bg-yellow-500/10 text-yellow-600">
                <Clock className="h-3 w-3" />
                Expired
              </Badge>
            ) : (
              <Badge variant="default" className="gap-1 bg-green-500">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            )
          ) : (
            <Badge variant="outline">Not Connected</Badge>
          )}
        </div>
      </div>

      {/* Error Message */}
      {hasError && connection?.error_message && (
        <div className="mt-3 p-2 bg-destructive/10 text-destructive text-sm rounded">
          {connection.error_message}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {isConnected ? (
          <>
            {(isExpired || hasError) && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReconnect ?? onRefresh}
                disabled={isAnyActionPending}
              >
                {isRefreshing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Reconnect
              </Button>
            )}
            {onSync && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSync}
                disabled={isAnyActionPending || !!isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync data
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onDisconnect}
              disabled={isAnyActionPending}
              className="text-destructive hover:text-destructive"
            >
              {isDisconnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="mr-2 h-4 w-4" />
              )}
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={onConnect}
            disabled={isAnyActionPending}
          >
            {isConnecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" />
            )}
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}

// Track pending state per provider
type PendingAction = 'connect' | 'disconnect' | 'refresh';
type PendingState = Record<string, PendingAction | null>;

export function ConnectedServices() {
  const {
    data: connections = [],
    isLoading: connectionsLoading,
    error: connectionsError,
    refetch: refetchConnections,
  } = useUserOAuthTokens();
  const {
    data: availableProviders = [],
    isLoading: providersLoading,
    error: providersError,
    refetch: refetchProviders,
  } = useAvailableUserProviders();

  const connectOAuth = useConnectOAuth();
  const connectActiveCollab = useConnectActiveCollabToken();
  const disconnectOAuth = useDisconnectOAuth();
  const refreshToken = useRefreshOAuthToken();

  const [activeCollabDialogOpen, setActiveCollabDialogOpen] = useState(false);
  const [activeCollabBaseUrl, setActiveCollabBaseUrl] = useState('');
  const [activeCollabClientName, setActiveCollabClientName] = useState('Control Tower');
  const [activeCollabClientVendor, setActiveCollabClientVendor] = useState('');
  const [activeCollabEmail, setActiveCollabEmail] = useState('');
  const [activeCollabPassword, setActiveCollabPassword] = useState('');

  const resetActiveCollabDialogFields = (): void => {
    setActiveCollabBaseUrl('');
    setActiveCollabClientName('Control Tower');
    setActiveCollabClientVendor('');
    setActiveCollabEmail('');
    setActiveCollabPassword('');
  };

  const syncClickup = useMutation({
    mutationFn: async (): Promise<LocalClickupSyncResult> => {
      return syncClickupLocal();
    },
    onSuccess: (res) => {
      toast.success(
        `ClickUp synced: ${res.projects_synced} projects, ${res.tasks_synced} tasks.`
      );
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to sync ClickUp');
    },
  });

  const syncActiveCollab = useMutation({
    mutationFn: async (): Promise<{
      success: boolean;
      projects_synced: number;
      projects_created: number;
      projects_updated: number;
      tasks_synced: number;
      errors: string[];
    }> => {
      const { data, error } = await supabase.functions.invoke('sync-projects-activecollab');
      if (error) {
        throw error;
      }
      return data as {
        success: boolean;
        projects_synced: number;
        projects_created: number;
        projects_updated: number;
        tasks_synced: number;
        errors: string[];
      };
    },
    onSuccess: (res) => {
      toast.success(
        `ActiveCollab synced: ${res.projects_synced} projects, ${res.tasks_synced} tasks.`
      );
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to sync ActiveCollab');
    },
  });

  const [disconnectProvider, setDisconnectProvider] = useState<string | null>(null);
  // Track which provider has a pending action
  const [pendingActions, setPendingActions] = useState<PendingState>({});

  const isLoading = connectionsLoading || providersLoading;
  const hasError = connectionsError || providersError;

  const handleRetry = () => {
    if (connectionsError) refetchConnections();
    if (providersError) refetchProviders();
  };

  const handleConnect = (provider: AvailableProvider) => {
    if (provider.connection_method === 'activecollab_issue_token') {
      resetActiveCollabDialogFields();
      setActiveCollabDialogOpen(true);
      return;
    }

    // Prevent duplicate clicks
    if (pendingActions[provider.provider_slug]) return;

    setPendingActions(prev => ({ ...prev, [provider.provider_slug]: 'connect' }));
    connectOAuth.mutate(
      {
        provider: provider.provider_slug,
        // Ensure the OAuth flow always returns to the same domain
        // (preview, staging, or production) and to the Settings page.
        redirect_uri: `${window.location.origin}/settings`,
      },
      {
        onSettled: () => {
          setPendingActions(prev => ({ ...prev, [provider.provider_slug]: null }));
        },
      }
    );
  };

  const submitActiveCollabConnect = (): void => {
    connectActiveCollab.mutate(
      {
        base_url: activeCollabBaseUrl.trim(),
        client_name: activeCollabClientName.trim(),
        client_vendor: activeCollabClientVendor.trim(),
        username: activeCollabEmail.trim(),
        password: activeCollabPassword,
      },
      {
        onSuccess: () => {
          setActiveCollabDialogOpen(false);
          resetActiveCollabDialogFields();
        },
      },
    );
  };

  const handleDisconnect = (provider: string) => {
    // Prevent duplicate clicks
    if (pendingActions[provider]) return;
    setDisconnectProvider(provider);
  };

  const confirmDisconnect = () => {
    if (disconnectProvider) {
      // Prevent duplicate clicks
      if (pendingActions[disconnectProvider]) {
        setDisconnectProvider(null);
        return;
      }

      setPendingActions(prev => ({ ...prev, [disconnectProvider]: 'disconnect' }));
      disconnectOAuth.mutate(
        { provider: disconnectProvider },
        {
          onSuccess: async () => {
            try {
              const { error } = await supabase.functions.invoke('user-integration-clear-data', {
                body: { provider: disconnectProvider },
              });
              if (error) {
                throw error;
              }
              toast.success('Disconnected and cleared synced data');
            } catch (err: any) {
              toast.error(
                err?.message ?? 'Disconnected, but failed to clear synced data'
              );
            }
          },
          onSettled: () => {
            setPendingActions(prev => ({ ...prev, [disconnectProvider]: null }));
          },
        }
      );
      setDisconnectProvider(null);
    }
  };

  const handleRefresh = (provider: string) => {
    // Prevent duplicate clicks
    if (pendingActions[provider]) return;

    setPendingActions(prev => ({ ...prev, [provider]: 'refresh' }));
    refreshToken.mutate(
      { provider },
      {
        onSettled: () => {
          setPendingActions(prev => ({ ...prev, [provider]: null }));
        },
      }
    );
  };

  const getConnectionForProvider = (slug: string): UserOAuthToken | undefined => {
    if (!Array.isArray(connections)) return undefined;
    return connections.find((c: UserOAuthToken) => c.provider_slug === slug);
  };

  // Helper to check pending state for a specific provider
  const isPendingAction = (provider: string, action: PendingAction) => {
    return pendingActions[provider] === action;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (hasError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Connected Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <p className="text-destructive font-medium">Failed to load connected services</p>
            <p className="text-sm text-muted-foreground mt-1">
              There was a problem loading your integration data. Please try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="mt-4"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Connected Services
          </CardTitle>
          <CardDescription>
            Connect your personal accounts to sync your data and enable additional features
          </CardDescription>
        </CardHeader>
        <CardContent>
          {availableProviders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ExternalLink className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No integrations are currently available.</p>
              <p className="text-sm">Contact your administrator to enable integrations.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {availableProviders.map((provider) => (
                <ServiceCard
                  key={provider.provider_slug}
                  provider={provider}
                  connection={getConnectionForProvider(provider.provider_slug)}
                  onConnect={() => handleConnect(provider)}
                  onDisconnect={() => handleDisconnect(provider.provider_slug)}
                  onRefresh={() => handleRefresh(provider.provider_slug)}
                  onReconnect={
                    provider.connection_method === 'activecollab_issue_token'
                      ? () => {
                          resetActiveCollabDialogFields();
                          setActiveCollabDialogOpen(true);
                        }
                      : undefined
                  }
                  isConnecting={
                    provider.connection_method === 'activecollab_issue_token'
                      ? connectActiveCollab.isPending
                      : isPendingAction(provider.provider_slug, 'connect')
                  }
                  isDisconnecting={isPendingAction(provider.provider_slug, 'disconnect')}
                  isRefreshing={isPendingAction(provider.provider_slug, 'refresh')}
                  onSync={
                    provider.provider_slug === 'clickup'
                      ? () => syncClickup.mutate()
                      : provider.provider_slug === 'activecollab'
                        ? () => syncActiveCollab.mutate()
                        : undefined
                  }
                  isSyncing={
                    (provider.provider_slug === 'clickup' && syncClickup.isPending) ||
                    (provider.provider_slug === 'activecollab' && syncActiveCollab.isPending)
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={!!disconnectProvider} onOpenChange={() => setDisconnectProvider(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Service?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your connection and revoke access. You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisconnect}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={activeCollabDialogOpen} onOpenChange={setActiveCollabDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect ActiveCollab</DialogTitle>
            <DialogDescription>
              Your instance URL and application labels are required by ActiveCollab&apos;s issue-token API. Your password
              is used only to obtain an API token and is not stored. See{' '}
              <a
                href="https://developers.activecollab.com/api-documentation/v1/authentication.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                ActiveCollab authentication
              </a>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="ac-base-url">Base URL</Label>
              <Input
                id="ac-base-url"
                type="url"
                autoComplete="off"
                value={activeCollabBaseUrl}
                onChange={(e) => setActiveCollabBaseUrl(e.target.value)}
                placeholder="https://your-company.activecollab.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ac-client-name">Client name</Label>
              <Input
                id="ac-client-name"
                type="text"
                autoComplete="off"
                value={activeCollabClientName}
                onChange={(e) => setActiveCollabClientName(e.target.value)}
                placeholder="Control Tower"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ac-client-vendor">Client vendor</Label>
              <Input
                id="ac-client-vendor"
                type="text"
                autoComplete="organization"
                value={activeCollabClientVendor}
                onChange={(e) => setActiveCollabClientVendor(e.target.value)}
                placeholder="Your company name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ac-email">Email</Label>
              <Input
                id="ac-email"
                type="email"
                autoComplete="username"
                value={activeCollabEmail}
                onChange={(e) => setActiveCollabEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ac-password">Password</Label>
              <Input
                id="ac-password"
                type="password"
                autoComplete="current-password"
                value={activeCollabPassword}
                onChange={(e) => setActiveCollabPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveCollabDialogOpen(false)}
              disabled={connectActiveCollab.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitActiveCollabConnect}
              disabled={
                connectActiveCollab.isPending ||
                activeCollabBaseUrl.trim().length === 0 ||
                activeCollabClientName.trim().length === 0 ||
                activeCollabClientVendor.trim().length === 0 ||
                activeCollabEmail.trim().length === 0 ||
                activeCollabPassword.length === 0
              }
            >
              {connectActiveCollab.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting…
                </>
              ) : (
                'Connect'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
