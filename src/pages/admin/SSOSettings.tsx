/**
 * SSO Settings Page
 * Configure enterprise SSO providers (Google Workspace, Azure AD, SAML)
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Loader2,
  Shield,
  Plus,
  Trash2,
  Settings,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Key,
  Globe,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useAuthConfig,
  useSSOConfigurations,
  useUpsertSSOConfiguration,
  useDeleteSSOConfiguration,
  useSSODomains,
  useAddSSODomain,
  useRemoveSSODomain,
  useUpdateAuthConfig,
  SSOProvider,
} from '@/hooks/useAuthConfig';
import { SSOGroupMappingsPanel } from '@/components/admin/SSOGroupMappingsPanel';

interface ProviderConfig {
  type: 'google_workspace' | 'azure_ad' | 'saml' | 'oidc' | 'okta';
  name: string;
  description: string;
  icon: string;
  setupUrl: string;
  fields: {
    key: string;
    label: string;
    placeholder: string;
    required: boolean;
    type?: string;
  }[];
}

const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    type: 'google_workspace',
    name: 'Google Workspace',
    description: 'Sign in with Google corporate accounts',
    icon: '🔵',
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'xxx.apps.googleusercontent.com', required: true },
    ],
  },
  {
    type: 'azure_ad',
    name: 'Microsoft Azure AD',
    description: 'Sign in with Microsoft 365 accounts',
    icon: '🔷',
    setupUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps',
    fields: [
      { key: 'client_id', label: 'Application (client) ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
      { key: 'tenant_id', label: 'Directory (tenant) ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
    ],
  },
  {
    type: 'oidc',
    name: 'Generic OIDC',
    description: 'OpenID Connect provider',
    icon: '🔑',
    setupUrl: '',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'client-id', required: true },
    ],
  },
  {
    type: 'okta',
    name: 'Okta',
    description: 'Sign in with Okta workforce identity',
    icon: '🔵',
    setupUrl: 'https://developer.okta.com/',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Okta client ID', required: true },
      { key: 'okta_domain', label: 'Okta Domain', placeholder: 'your-org.okta.com', required: true },
    ],
  },
];

export default function SSOSettings() {
  const { data: authConfig, isLoading: authLoading } = useAuthConfig();
  const { data: ssoConfigs = [], isLoading: configsLoading } = useSSOConfigurations();
  const upsertConfig = useUpsertSSOConfiguration();
  const deleteConfig = useDeleteSSOConfiguration();
  const updateAuthConfig = useUpdateAuthConfig();

  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<SSOProvider>>({});
  const [newDomain, setNewDomain] = useState('');

  // Domain management hooks
  const { data: domains = [] } = useSSODomains(selectedConfigId || '');
  const addDomain = useAddSSODomain();
  const removeDomain = useRemoveSSODomain();

  const isLoading = authLoading || configsLoading;

  const openConfigDialog = (provider: ProviderConfig) => {
    setSelectedProvider(provider);
    const existingConfig = ssoConfigs.find((c) => c.provider_type === provider.type);
    if (existingConfig) {
      setFormData(existingConfig);
    } else {
      setFormData({
        provider_type: provider.type,
        display_name: provider.name,
        is_enabled: false,
        auto_provision_role: 'user',
        auto_create_users: true,
      });
    }
    setConfigDialogOpen(true);
  };

  const handleSaveConfig = async () => {
    if (!selectedProvider) return;

    await upsertConfig.mutateAsync({
      ...formData,
      provider_type: selectedProvider.type,
    } as SSOProvider);

    setConfigDialogOpen(false);
    setSelectedProvider(null);
    setFormData({});
  };

  const handleDeleteConfig = async (providerType: string) => {
    if (!confirm('Are you sure you want to delete this SSO configuration?')) return;
    await deleteConfig.mutateAsync(providerType);
  };

  const openDomainDialog = (configId: string) => {
    setSelectedConfigId(configId);
    setDomainDialogOpen(true);
  };

  const handleAddDomain = async () => {
    if (!selectedConfigId || !newDomain.trim()) return;

    await addDomain.mutateAsync({
      configId: selectedConfigId,
      domain: newDomain.trim(),
    });

    setNewDomain('');
  };

  const handleRemoveDomain = async (domainId: string) => {
    if (!selectedConfigId) return;
    await removeDomain.mutateAsync({ domainId, configId: selectedConfigId });
  };

  const getConfigForProvider = (type: string) => {
    return ssoConfigs.find((c) => c.provider_type === type);
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SSO Settings</h1>
        <p className="text-muted-foreground">
          Configure enterprise single sign-on providers
        </p>
      </div>

      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="providers">SSO Providers</TabsTrigger>
          <TabsTrigger value="groups">Group Mapping</TabsTrigger>
          <TabsTrigger value="settings">Auth Settings</TabsTrigger>
        </TabsList>

        {/* SSO Providers Tab */}
        <TabsContent value="providers" className="space-y-6">
          {/* Info Alert */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              SSO providers allow your users to sign in with their corporate accounts.
              Each provider requires configuration in both Supabase and the identity provider's console.
            </AlertDescription>
          </Alert>

          {/* Provider Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PROVIDER_CONFIGS.map((provider) => {
              const config = getConfigForProvider(provider.type);
              const isConfigured = !!config;
              const isEnabled = config?.is_enabled;

              return (
                <Card key={provider.type} className={isEnabled ? 'border-success' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <span className="text-2xl">{provider.icon}</span>
                        {provider.name}
                      </CardTitle>
                      {isEnabled ? (
                        <Badge className="bg-success">Active</Badge>
                      ) : isConfigured ? (
                        <Badge variant="secondary">Configured</Badge>
                      ) : (
                        <Badge variant="outline">Not Set Up</Badge>
                      )}
                    </div>
                    <CardDescription>{provider.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {provider.type === 'saml' ? (
                      <p className="text-sm text-muted-foreground">
                        SAML support requires Supabase Pro plan.
                      </p>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            onClick={() => openConfigDialog(provider)}
                          >
                            <Settings className="mr-2 h-4 w-4" />
                            {isConfigured ? 'Edit' : 'Configure'}
                          </Button>
                          {isConfigured && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openDomainDialog(config!.id)}
                            >
                              <Globe className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {isConfigured && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-destructive"
                            onClick={() => handleDeleteConfig(provider.type)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove Configuration
                          </Button>
                        )}
                      </>
                    )}
                    {provider.setupUrl && (
                      <a
                        href={provider.setupUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-sm text-primary hover:underline"
                      >
                        Open Provider Console
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Auth Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Methods</CardTitle>
              <CardDescription>
                Control which authentication methods are available to users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email/Password Login</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow users to sign in with email and password
                  </p>
                </div>
                <Switch
                  checked={authConfig?.allowEmailPassword}
                  onCheckedChange={(checked) =>
                    updateAuthConfig.mutate({ allowEmailPassword: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Public Registration</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow new users to create accounts
                  </p>
                </div>
                <Switch
                  checked={authConfig?.allowPublicSignup}
                  onCheckedChange={(checked) =>
                    updateAuthConfig.mutate({ allowPublicSignup: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Require SSO</Label>
                  <p className="text-sm text-muted-foreground">
                    Force all users to sign in via SSO (disables other methods)
                  </p>
                </div>
                <Switch
                  checked={authConfig?.requireSSO}
                  onCheckedChange={(checked) =>
                    updateAuthConfig.mutate({ requireSSO: checked })
                  }
                  disabled={ssoConfigs.filter((c) => c.is_enabled).length === 0}
                />
              </div>

              <div className="space-y-2">
                <Label>Session Timeout</Label>
                <Select
                  value={String(authConfig?.sessionTimeoutHours || 24)}
                  onValueChange={(value) =>
                    updateAuthConfig.mutate({ sessionTimeoutHours: parseInt(value, 10) })
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="8">8 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="168">1 week</SelectItem>
                    <SelectItem value="720">30 days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  How long users stay logged in before requiring re-authentication
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Enabled Providers Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Active Providers</CardTitle>
              <CardDescription>
                SSO providers that users can use to sign in
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ssoConfigs.filter((c) => c.is_enabled).length === 0 ? (
                <p className="text-muted-foreground">No SSO providers are currently enabled.</p>
              ) : (
                <div className="space-y-2">
                  {ssoConfigs
                    .filter((c) => c.is_enabled)
                    .map((config) => (
                      <div
                        key={config.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          <span>{config.display_name}</span>
                          {config.is_primary && (
                            <Badge variant="default">Primary</Badge>
                          )}
                        </div>
                        <Badge variant="outline">{config.provider_type}</Badge>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups">
          <SSOGroupMappingsPanel />
        </TabsContent>
      </Tabs>

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Configure {selectedProvider?.name}
            </DialogTitle>
            <DialogDescription>
              Enter your SSO provider credentials
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={formData.display_name || ''}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="e.g., Company Google SSO"
              />
            </div>

            {selectedProvider?.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>
                  {field.label}
                  {field.required && <span className="text-destructive"> *</span>}
                </Label>
                <Input
                  type={field.type || 'text'}
                  value={(formData as any)[field.key] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                />
              </div>
            ))}

            <div className="flex items-center justify-between">
              <div>
                <Label>Enabled</Label>
                <p className="text-sm text-muted-foreground">
                  Show this provider on login page
                </p>
              </div>
              <Switch
                checked={formData.is_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, is_enabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Primary Provider</Label>
                <p className="text-sm text-muted-foreground">
                  Show as the main sign-in option
                </p>
              </div>
              <Switch
                checked={formData.is_primary}
                onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Auto-provision Role</Label>
              <Select
                value={formData.auto_provision_role || 'user'}
                onValueChange={(value) => setFormData({ ...formData, auto_provision_role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Role assigned to new users signing in via this provider
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-create Users</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically create accounts for new SSO users
                </p>
              </div>
              <Switch
                checked={formData.auto_create_users !== false}
                onCheckedChange={(checked) => setFormData({ ...formData, auto_create_users: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig} disabled={upsertConfig.isPending}>
              {upsertConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Domain Allowlist Dialog */}
      <Dialog open={domainDialogOpen} onOpenChange={setDomainDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Domain Allowlist</DialogTitle>
            <DialogDescription>
              Restrict sign-in to specific email domains. Leave empty to allow all domains.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
              />
              <Button onClick={handleAddDomain} disabled={addDomain.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {domains.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No domain restrictions. All domains are allowed.
              </p>
            ) : (
              <div className="space-y-2">
                {domains.map((domain) => (
                  <div
                    key={domain.id}
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <span>@{domain.domain}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDomain(domain.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDomainDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
