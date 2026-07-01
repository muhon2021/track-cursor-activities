/**
 * Provider Detail Page
 * Dynamic provider configuration with form fields, services, and stats
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  useIntegrationProvider,
  useIntegrationFields,
  useOrganizationIntegration,
  useIntegrationServices,
  useProviderUsageStats,
  useUpdateIntegration,
  useTestConnection,
  useDisconnectIntegration,
  useToggleService,
  useSetDefaultService,
  useSendOutlookTestEmail,
} from '@/hooks/useIntegrations';
import { useConnectOAuth, useDisconnectOAuth, useUserOAuthToken } from '@/hooks/useUserIntegrations';
import {
  useSyncProjects,
  useSyncTasks,
  useSyncFloatSchedule,
  useSyncConfluenceKnowledge,
  useSyncSharePointKnowledge,
} from '@/hooks/useIntegrationSync';
import { DynamicFormField } from '@/components/integrations/DynamicFormField';
import { ServiceManagement } from '@/components/integrations/ServiceManagement';
import { UsageStats } from '@/components/integrations/UsageStats';
import { AIModelsSection } from '@/components/integrations/AIModelsSection';
import { AIProviderConnectSettings } from '@/components/integrations/AIProviderConnectSettings';
import {
  areRequiredFieldsFilled,
  generateOAuthState,
  storeOAuthState,
  buildOAuthAuthorizationUrl,
  formatRelativeTime,
} from '@/lib/integration-utils';

export default function ProviderDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Fetch provider data
  const { data: provider, isLoading, error } = useIntegrationProvider(slug || '');
  const { data: fields = [], isLoading: fieldsLoading } = useIntegrationFields(provider?.id || '');
  const { data: orgIntegrationResult } = useOrganizationIntegration(provider?.id || '');
  const orgIntegration = orgIntegrationResult?.integration;
  const [configuredSensitiveFields, setConfiguredSensitiveFields] = useState<string[]>([]);
  const { data: services = [] } = useIntegrationServices(provider?.id || '');
  const { data: usageStats, isLoading: statsLoading } = useProviderUsageStats(
    provider?.id || '',
    30
  );

  // Check if this is an AI provider or Project Management provider with sync
  const [isAIProvider, setIsAIProvider] = useState(false);
  const [categorySlug, setCategorySlug] = useState<string>('');
  const isProjectManagementWithSync =
    categorySlug === 'project-management' &&
    (slug === 'activecollab' || slug === 'jira' || slug === 'clickup' || slug === 'workamajig');
  const syncProjects = useSyncProjects(slug || '');
  const syncTasks = useSyncTasks(slug || '');
  const syncFloatSchedule = useSyncFloatSchedule();
  const syncConfluenceKnowledge = useSyncConfluenceKnowledge();
  const syncSharePointKnowledge = useSyncSharePointKnowledge();

  const outlookUserToken = useUserOAuthToken(slug === 'outlook' ? 'outlook' : '');
  const connectOAuth = useConnectOAuth();
  const disconnectOAuth = useDisconnectOAuth();
  const sendOutlookTest = useSendOutlookTestEmail();
  const [outlookTestRecipient, setOutlookTestRecipient] = useState('');

  useEffect(() => {
    if (slug !== 'outlook') return;
    if (searchParams.get('connected') !== 'outlook') return;
    queryClient.invalidateQueries({ queryKey: ['user-oauth-tokens'] });
    queryClient.invalidateQueries({ queryKey: ['user-oauth-token'] });
    toast.success('Microsoft Outlook connected successfully.');
    const next = new URLSearchParams(searchParams);
    next.delete('connected');
    setSearchParams(next, { replace: true });
  }, [slug, searchParams, setSearchParams, queryClient]);

  useEffect(() => {
    const fetchCategory = async () => {
      if (!provider?.category_id) return;

      const { data: category } = await supabase
        .from('integration_categories')
        .select('slug')
        .eq('id', provider.category_id)
        .single();

      if (category) {
        setCategorySlug(category.slug);
        setIsAIProvider(category.slug === 'ai-providers');
      }
    };

    fetchCategory();
  }, [provider?.category_id]);

  // Mutations
  const updateIntegration = useUpdateIntegration();
  const testConnection = useTestConnection();
  const disconnectIntegration = useDisconnectIntegration();
  const toggleService = useToggleService();
  const setDefaultService = useSetDefaultService();

  // Form state
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const normalizedFields = useMemo(
    () =>
      fields.map((field) =>
        slug === 'sharepoint' && field.field_key === 'sharepoint_site_path'
          ? { ...field, is_required: false }
          : field
      ),
    [fields, slug]
  );

  // Initialize form values from org integration config
  useEffect(() => {
    setConfiguredSensitiveFields(orgIntegrationResult?.configured_sensitive_fields ?? []);
    if (orgIntegration?.config) {
      setFormValues(orgIntegration.config as Record<string, string>);
    } else if (normalizedFields && normalizedFields.length > 0) {
      // Set default values
      const defaults: Record<string, string> = {};
      normalizedFields.forEach((field) => {
        if (field.default_value) {
          defaults[field.field_key] = field.default_value;
        }
      });
      setFormValues(defaults);
    }
  }, [orgIntegration, orgIntegrationResult, normalizedFields]);

  // Handle field change
  const handleFieldChange = (fieldKey: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [fieldKey]: value }));
    setHasChanges(true);
  };

  // Handle save configuration
  const handleSave = async () => {
    if (!provider) return;

    // Validate required fields
    if (!areRequiredFieldsFilled(normalizedFields, formValues, configuredSensitiveFields)) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);

    try {
      const result = await updateIntegration.mutateAsync({
        providerId: provider.id,
        config: formValues,
        enabled: true,
      });
      setConfiguredSensitiveFields(result.configured_sensitive_fields);

      toast.success(`${provider.name} configuration has been saved successfully.`);
      setHasChanges(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle test connection — validate first; persist only when credentials are valid
  const handleTestConnection = async () => {
    if (!provider || !slug) return;

    if (!areRequiredFieldsFilled(normalizedFields, formValues, configuredSensitiveFields)) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const result = await testConnection.mutateAsync({
        providerSlug: slug,
        providerId: provider.id,
        credentials: formValues,
      });

      if (result.valid) {
        const saveResult = await updateIntegration.mutateAsync({
          providerId: provider.id,
          config: formValues,
          enabled: true,
        });
        setConfiguredSensitiveFields(saveResult.configured_sensitive_fields);
        setHasChanges(false);
        toast.success(result.message || 'Successfully connected to ' + provider.name);
      } else {
        toast.error(result.message || 'Failed to connect to ' + provider.name);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to test connection');
    }
  };

  const isOAuthProvider =
    provider?.auth_type === 'oauth2' || provider?.auth_type === 'oauth';

  // Handle OAuth connect
  const handleOAuthConnect = () => {
    if (!provider || !provider.oauth_config) {
      toast.error('This provider does not have OAuth configuration set up.');
      return;
    }

    try {
      const mergedCreds: Record<string, string> = {
        ...(typeof orgIntegration?.config === 'object' && orgIntegration.config !== null
          ? (orgIntegration.config as Record<string, string>)
          : {}),
        ...formValues,
      };

      // 1. Generate and store state for CSRF protection
      const state = generateOAuthState();
      storeOAuthState(state, provider.id);

      // 2. Build redirect URI
      const redirectUri = `${window.location.origin}/admin/integrations/oauth/callback`;

      // 3. Build authorization URL (client_id from saved config + unsaved form values)
      const authUrl = buildOAuthAuthorizationUrl(provider, state, redirectUri, mergedCreds);

      // 4. Redirect to provider authorization page
      window.location.href = authUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to initiate OAuth flow');
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!provider) return;

    try {
      await disconnectIntegration.mutateAsync({
        providerId: provider.id,
      });

      toast.success(`${provider.name} has been disconnected.`);

      // Clear form
      setFormValues({});
      setHasChanges(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to disconnect');
    }
  };

  // Handle toggle service
  const handleToggleService = async (serviceId: string, enabled: boolean) => {
    try {
      await toggleService.mutateAsync({ serviceId, enabled });
      toast.success('Service status updated successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update service');
    }
  };

  // Handle set default service
  const handleSetDefaultService = async (serviceId: string) => {
    if (!provider) return;

    try {
      await setDefaultService.mutateAsync({
        providerId: provider.id,
        serviceId,
      });
      toast.success('Default service has been set successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to set default service');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Error state or no provider
  if (error || !provider) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/integrations')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Integrations
        </Button>
        
        <div className="flex h-96 flex-col items-center justify-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-destructive">Provider not found</p>
          <Button onClick={() => navigate('/admin/integrations')}>
            View All Integrations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/admin/integrations')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Integrations
      </Button>

      {/* Provider Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {provider.name}
          </CardTitle>
          <CardDescription>{provider.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Authentication</p>
              <p className="text-sm text-muted-foreground capitalize">
                {provider.auth_type.replace('_', ' ')}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Status</p>
              <p className="text-sm text-muted-foreground">
                {provider.is_available ? 'Available' : 'Not Available'}
                {provider.is_beta && ' (Beta)'}
                {provider.is_coming_soon && ' (Coming Soon)'}
              </p>
            </div>
            {provider.docs_url && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Documentation</p>
                <a
                  href={provider.docs_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View Docs
                </a>
              </div>
            )}
            {orgIntegration && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Last Updated</p>
                <p className="text-sm text-muted-foreground">
                  {formatRelativeTime(orgIntegration.updated_at ?? orgIntegration.last_tested_at)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Form */}
      {normalizedFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Enter your API credentials to connect {provider.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {normalizedFields.map((field) => (
              <DynamicFormField
                key={field.id}
                field={field}
                value={formValues[field.field_key] || ''}
                onChange={(value) => handleFieldChange(field.field_key, value)}
              />
            ))}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Configuration
              </Button>
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testConnection.isPending}
              >
                {testConnection.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Test Connection
              </Button>
              {orgIntegration && (
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={disconnectIntegration.isPending}
                >
                  Disconnect
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* OAuth Connect — DB uses auth_type "oauth2"; was incorrectly gated on "oauth" only */}
      {/* Outlook uses Integration Hub Edge flow (user-oauth-connect → user-oauth-callback), not client-side authorize URL */}
      {isOAuthProvider && slug !== 'outlook' && orgIntegration?.connection_status !== 'connected' && (
        <Card>
          <CardHeader>
            <CardTitle>Connect with OAuth</CardTitle>
            <CardDescription>
              Save your Client ID and Client Secret above, then connect your {provider.name} account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleOAuthConnect}>
              Connect {provider.name}
            </Button>
          </CardContent>
        </Card>
      )}

      {slug === 'outlook' && orgIntegration?.connection_status === 'connected' && !outlookUserToken.data && (
        <Card>
          <CardHeader>
            <CardTitle>Connect your mailbox</CardTitle>
            <CardDescription>
              After saving the Entra application credentials above, sign in with Microsoft to grant mail
              and calendar access. In Entra, add redirect URI{' '}
              <code className="text-xs bg-muted px-1 rounded break-all">
                {'{SUPABASE_URL}'}/functions/v1/user-oauth-callback
              </code>{' '}
              (your project URL). This path is separate from MSAL on the Teams admin page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() =>
                connectOAuth.mutate({
                  provider: 'outlook',
                  redirect_uri: `${window.location.origin}/admin/integrations/outlook`,
                })
              }
              disabled={connectOAuth.isPending}
            >
              {connectOAuth.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Connect Microsoft Outlook
            </Button>
          </CardContent>
        </Card>
      )}

      {slug === 'outlook' && outlookUserToken.data && (
        <Card>
          <CardHeader>
            <CardTitle>Outlook connection</CardTitle>
            <CardDescription>
              Connected as{' '}
              {outlookUserToken.data.account_email ||
                outlookUserToken.data.account_name ||
                'your Microsoft account'}
              . Send a test message to verify Mail.Send.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              onClick={() => disconnectOAuth.mutate({ provider: 'outlook' })}
              disabled={disconnectOAuth.isPending}
            >
              Disconnect mailbox
            </Button>
            <div className="max-w-md space-y-2">
              <Label htmlFor="outlook-test-recipient">Test recipient (optional)</Label>
              <Input
                id="outlook-test-recipient"
                type="email"
                placeholder="Defaults to your connected mailbox"
                value={outlookTestRecipient}
                onChange={(e) => setOutlookTestRecipient(e.target.value)}
              />
              <Button
                onClick={async () => {
                  try {
                    const to = outlookTestRecipient.trim();
                    await sendOutlookTest.mutateAsync(to.length > 0 ? to : undefined);
                    toast.success('Test email sent.');
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Failed to send test email');
                  }
                }}
                disabled={sendOutlookTest.isPending}
              >
                {sendOutlookTest.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Send test email
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!fieldsLoading && fields.length === 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-base">Configuration fields missing</CardTitle>
            <CardDescription>
              {slug === 'jira'
                ? 'The database has no integration_fields rows for Jira (site URL, email, API token). Apply Supabase migrations through 20260413220000_jira_integration_fields_ensure.sql (or re-run db push), then refresh.'
                : isOAuthProvider
                  ? 'No credential fields are defined for this provider in the database. Apply the latest Supabase migrations (including provider integration_fields seeds), then refresh this page.'
                  : 'No credential fields are defined for this provider in the database. Apply the latest Supabase migrations, then refresh this page.'}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Usage Statistics */}
      {usageStats && (
        <Card>
          <CardHeader>
            <CardTitle>Usage Statistics (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{usageStats.totalCalls}</p>
                <p className="text-sm text-muted-foreground">Total Calls</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{usageStats.successfulCalls}</p>
                <p className="text-sm text-muted-foreground">Successful</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{usageStats.failedCalls}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{usageStats.successRate.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service Management */}
      {services.length > 0 && orgIntegration?.connection_status === 'connected' && (
        <ServiceManagement
          services={services}
          onToggleService={handleToggleService}
          onSetDefault={handleSetDefaultService}
          isLoading={toggleService.isPending || setDefaultService.isPending}
        />
      )}

      {/* Sync projects - Only for connected Project Management providers (ActiveCollab, Jira) */}
      {isProjectManagementWithSync && orgIntegration?.connection_status === 'connected' && (
        <Card>
          <CardHeader>
            <CardTitle>Sync projects</CardTitle>
            <CardDescription>
              Load projects from {provider.name} into the Projects list. New and updated
              projects will be created or updated; existing projects are matched by external ID.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => syncProjects.mutate()}
              disabled={syncProjects.isPending}
            >
              {syncProjects.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync projects
            </Button>
            {syncProjects.data && (
              <p className="mt-3 text-sm text-muted-foreground">
                Last sync: {syncProjects.data.projects_synced} project
                {syncProjects.data.projects_synced !== 1 ? 's' : ''} synced
                ({syncProjects.data.projects_created} created, {syncProjects.data.projects_updated}{' '}
                updated).
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Jira: task/issue sync uses Edge secrets; admin form alone does not feed sync functions */}
      {slug === 'jira' && orgIntegration?.connection_status === 'connected' && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Jira issues</CardTitle>
            <CardDescription>
              Pull issues into Tasks (comments and worklogs included). Sync reads credentials
              from this provider&apos;s saved configuration first, with{' '}
              <code className="text-xs bg-muted px-1 rounded">JIRA_HOST</code>,{' '}
              <code className="text-xs bg-muted px-1 rounded">JIRA_EMAIL</code>, and{' '}
              <code className="text-xs bg-muted px-1 rounded">JIRA_API_TOKEN</code> as fallback
              Edge Function secrets.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              onClick={() => syncTasks.mutate(undefined)}
              disabled={syncTasks.isPending || syncProjects.isPending}
            >
              {syncTasks.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync tasks
            </Button>
          </CardContent>
        </Card>
      )}

      {slug === 'float' && orgIntegration?.connection_status === 'connected' && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Float schedule</CardTitle>
            <CardDescription>
              Pull people, projects, tasks, and allocations from Float into synced tables.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => syncFloatSchedule.mutate()} disabled={syncFloatSchedule.isPending}>
              {syncFloatSchedule.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync schedule
            </Button>
          </CardContent>
        </Card>
      )}

      {slug === 'confluence' && orgIntegration?.connection_status === 'connected' && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Confluence into Knowledge</CardTitle>
            <CardDescription>
              Import Confluence pages into the knowledge base. Sync prefers credentials saved above;
              if any required field is missing, it falls back to Edge secrets{' '}
              <code className="text-xs bg-muted px-1 rounded">CONFLUENCE_EMAIL</code>,{' '}
              <code className="text-xs bg-muted px-1 rounded">CONFLUENCE_API_TOKEN</code>,{' '}
              <code className="text-xs bg-muted px-1 rounded">CONFLUENCE_DOMAIN</code>, and optional{' '}
              <code className="text-xs bg-muted px-1 rounded">CONFLUENCE_SPACE_KEY</code>. Optional space
              key in the form is stored with your integration and limits sync when those credentials are
              complete.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => syncConfluenceKnowledge.mutate()}
              disabled={syncConfluenceKnowledge.isPending}
            >
              {syncConfluenceKnowledge.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync from Confluence
            </Button>
            {syncConfluenceKnowledge.data && (
              <p className="mt-3 text-sm text-muted-foreground">
                Last run: {syncConfluenceKnowledge.data.pages_synced} page
                {syncConfluenceKnowledge.data.pages_synced !== 1 ? 's' : ''} synced (
                {syncConfluenceKnowledge.data.pages_created} created,{' '}
                {syncConfluenceKnowledge.data.pages_updated} updated).
                {syncConfluenceKnowledge.data.credential_source && (
                  <>
                    {' '}
                    Credentials: {syncConfluenceKnowledge.data.credential_source === 'env'
                      ? 'function secrets'
                      : 'saved integration'}
                    .
                  </>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {slug === 'sharepoint' && orgIntegration?.connection_status === 'connected' && (
        <Card>
          <CardHeader>
            <CardTitle>Sync SharePoint into Knowledge</CardTitle>
            <CardDescription>
              Import text-like files from the default document library into the knowledge base via
              Microsoft Graph (application permissions). Sync prefers credentials saved above; otherwise
              set Edge secrets{' '}
              <code className="text-xs bg-muted px-1 rounded">SHAREPOINT_TENANT_ID</code>,{' '}
              <code className="text-xs bg-muted px-1 rounded">SHAREPOINT_CLIENT_ID</code>,{' '}
              <code className="text-xs bg-muted px-1 rounded">SHAREPOINT_CLIENT_SECRET</code>,{' '}
              <code className="text-xs bg-muted px-1 rounded">SHAREPOINT_HOSTNAME</code>, and optional{' '}
              <code className="text-xs bg-muted px-1 rounded">SHAREPOINT_SITE_PATH</code> (defaults to{' '}
              <code className="text-xs bg-muted px-1 rounded">/</code>).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => syncSharePointKnowledge.mutate()}
              disabled={syncSharePointKnowledge.isPending}
            >
              {syncSharePointKnowledge.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync from SharePoint
            </Button>
            {syncSharePointKnowledge.data && (
              <p className="mt-3 text-sm text-muted-foreground">
                Last run: {syncSharePointKnowledge.data.pages_synced} file
                {syncSharePointKnowledge.data.pages_synced !== 1 ? 's' : ''} synced (
                {syncSharePointKnowledge.data.pages_created} created,{' '}
                {syncSharePointKnowledge.data.pages_updated} updated).
                {syncSharePointKnowledge.data.credential_source && (
                  <>
                    {' '}
                    Credentials: {syncSharePointKnowledge.data.credential_source === 'env'
                      ? 'function secrets'
                      : 'saved integration'}
                    .
                  </>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI provider connect settings (model variant + default provider) */}
      {isAIProvider && provider && slug && (
        <AIProviderConnectSettings
          providerSlug={slug}
          providerName={provider.name}
          isConnected={orgIntegration?.connection_status === 'connected'}
          config={formValues}
          onConfigChange={handleFieldChange}
        />
      )}

      {/* AI Models Section - Only for AI providers */}
      {isAIProvider && provider && slug && (
        <AIModelsSection
          providerId={provider.id}
          providerSlug={slug}
          providerName={provider.name}
          isConnected={orgIntegration?.connection_status === 'connected'}
        />
      )}
    </div>
  );
}