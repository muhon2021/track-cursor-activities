/**
 * Provider Detail Header Component
 * Displays provider information, status, and action buttons
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  ArrowLeft,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';
import {
  IntegrationProvider,
  OrganizationIntegration,
  getProviderIcon,
  getConnectionStatusLabel,
  getConnectionStatusVariant,
  getAuthTypeLabel,
  formatRelativeTime,
} from '@/lib/integration-utils';

interface ProviderDetailHeaderProps {
  provider: IntegrationProvider;
  orgIntegration?: OrganizationIntegration | null;
  onTestConnection?: () => void;
  onDisconnect?: () => void;
  onOAuthConnect?: () => void;
  isTesting?: boolean;
  isDisconnecting?: boolean;
}

export function ProviderDetailHeader({
  provider,
  orgIntegration,
  onTestConnection,
  onDisconnect,
  onOAuthConnect,
  isTesting = false,
  isDisconnecting = false,
}: ProviderDetailHeaderProps) {
  const navigate = useNavigate();
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const Icon = getProviderIcon(provider.slug);

  const connectionStatus = orgIntegration?.connection_status || 'disconnected';
  const statusVariant = getConnectionStatusVariant(connectionStatus);
  const statusLabel = getConnectionStatusLabel(connectionStatus);

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'error':
        return <XCircle className="h-4 w-4" />;
      case 'testing':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const handleDisconnect = () => {
    setShowDisconnectDialog(false);
    onDisconnect?.();
  };

  const isOAuth = provider.auth_type === 'oauth2';
  const isConnected = connectionStatus === 'connected';

  return (
    <>
      <div className="space-y-4">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/integrations')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Integrations
        </Button>

        {/* Provider header card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="rounded-lg border-2 p-4 bg-muted/50">
                  <Icon className="h-10 w-10" />
                </div>

                {/* Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-2xl">{provider.name}</CardTitle>
                    {provider.is_beta && (
                      <Badge variant="outline" className="text-xs">
                        Beta
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-base">
                    {provider.description}
                  </CardDescription>

                  {/* Auth type & docs link */}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      Authentication: <span className="font-medium">{getAuthTypeLabel(provider.auth_type)}</span>
                    </span>
                    {provider.docs_url && (
                      <a
                        href={provider.docs_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Documentation
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <Badge variant={statusVariant} className="gap-1.5 text-sm px-3 py-1">
                {getStatusIcon()}
                {statusLabel}
              </Badge>
            </div>
          </CardHeader>

          {/* Connection details */}
          {orgIntegration && (
            <CardContent className="pt-0">
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Status</p>
                    <p className="font-medium">{orgIntegration.enabled ? 'Enabled' : 'Disabled'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Last Tested</p>
                    <p className="font-medium">{formatRelativeTime(orgIntegration.last_tested_at)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Last Synced</p>
                    <p className="font-medium">{formatRelativeTime(orgIntegration.last_sync_at)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Configured</p>
                    <p className="font-medium">
                      {formatRelativeTime(orgIntegration.created_at)}
                    </p>
                  </div>
                </div>

                {/* Connection message */}
                {orgIntegration.connection_message && (
                  <div className="mt-4 p-3 rounded-lg bg-muted">
                    <p className="text-sm">{orgIntegration.connection_message}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-4 flex items-center gap-2">
                  {isOAuth ? (
                    <>
                      {!isConnected && (
                        <Button onClick={onOAuthConnect} disabled={isTesting}>
                          Connect with {provider.name}
                        </Button>
                      )}
                      {isConnected && (
                        <Button
                          variant="destructive"
                          onClick={() => setShowDisconnectDialog(true)}
                          disabled={isDisconnecting}
                        >
                          {isDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Disconnect
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button onClick={onTestConnection} disabled={isTesting}>
                        {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Test Connection
                      </Button>
                      {isConnected && (
                        <Button
                          variant="outline"
                          onClick={() => setShowDisconnectDialog(true)}
                          disabled={isDisconnecting}
                        >
                          {isDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Disconnect
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Disconnect confirmation dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {provider.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disable the integration and remove all stored credentials. You can reconnect
              at any time by configuring the integration again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
