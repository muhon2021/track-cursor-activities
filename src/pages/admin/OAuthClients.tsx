/**
 * OAuth Clients Management Page
 *
 * Admin panel for managing OAuth 2.0 client applications.
 * Allows admins to create, view, edit, and delete OAuth clients.
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOAuthClients, OAuthClient } from "@/hooks/useOAuthClients";
import { Plus, Key, Trash2, Edit, Eye, EyeOff, Copy, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function OAuthClients() {
  const { clients, isLoading, createClient, updateClient, deleteClient, toggleEnabled } = useOAuthClients();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<OAuthClient | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    client_name: "",
    client_id: "",
    client_secret: "",
    redirect_uris: "",
    allowed_scopes: "openid,profile,email",
    homepage_url: "",
    require_pkce: false,
    require_consent: true,
    trusted: false,
  });

  const handleCreate = () => {
    const redirectUris = formData.redirect_uris.split(",").map((uri) => uri.trim()).filter(Boolean);
    const scopes = formData.allowed_scopes.split(",").map((s) => s.trim()).filter(Boolean);

    createClient(
      {
        client_name: formData.client_name,
        client_id: formData.client_id || `client_${Date.now()}`,
        client_secret: formData.client_secret || `secret_${Math.random().toString(36).slice(2)}`,
        redirect_uris: redirectUris,
        allowed_scopes: scopes,
        grant_types: ["authorization_code", "refresh_token"],
        homepage_url: formData.homepage_url,
        require_pkce: formData.require_pkce,
        require_consent: formData.require_consent,
        trusted: formData.trusted,
        enabled: true,
      },
      {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
          setFormData({
            client_name: "",
            client_id: "",
            client_secret: "",
            redirect_uris: "",
            allowed_scopes: "openid,profile,email",
            homepage_url: "",
            require_pkce: false,
            require_consent: true,
            trusted: false,
          });
        },
      }
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  if (isLoading) {
    return <div className="p-8">Loading OAuth clients...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">OAuth Clients</h1>
          <p className="text-muted-foreground mt-1">
            Manage OAuth 2.0 client applications for federated authentication
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create OAuth Client</DialogTitle>
              <DialogDescription>
                Register a new OAuth 2.0 client application
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="client_name">Client Name *</Label>
                <Input
                  id="client_name"
                  placeholder="My Application"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_id">Client ID (leave blank to auto-generate)</Label>
                <Input
                  id="client_id"
                  placeholder="my-app-client-id"
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_secret">Client Secret (leave blank to auto-generate)</Label>
                <Input
                  id="client_secret"
                  type="password"
                  placeholder="my-secret-key"
                  value={formData.client_secret}
                  onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="redirect_uris">Redirect URIs (comma-separated) *</Label>
                <Textarea
                  id="redirect_uris"
                  placeholder="https://myapp.com/auth/callback, http://localhost:3000/auth/callback"
                  value={formData.redirect_uris}
                  onChange={(e) => setFormData({ ...formData, redirect_uris: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allowed_scopes">Allowed Scopes (comma-separated)</Label>
                <Input
                  id="allowed_scopes"
                  placeholder="openid, profile, email, roles"
                  value={formData.allowed_scopes}
                  onChange={(e) => setFormData({ ...formData, allowed_scopes: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="homepage_url">Homepage URL</Label>
                <Input
                  id="homepage_url"
                  placeholder="https://myapp.com"
                  value={formData.homepage_url}
                  onChange={(e) => setFormData({ ...formData, homepage_url: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="require_pkce">Require PKCE</Label>
                <Switch
                  id="require_pkce"
                  checked={formData.require_pkce}
                  onCheckedChange={(checked) => setFormData({ ...formData, require_pkce: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="require_consent">Require User Consent</Label>
                <Switch
                  id="require_consent"
                  checked={formData.require_consent}
                  onCheckedChange={(checked) => setFormData({ ...formData, require_consent: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="trusted">Trusted (skip consent for first-party apps)</Label>
                <Switch
                  id="trusted"
                  checked={formData.trusted}
                  onCheckedChange={(checked) => setFormData({ ...formData, trusted: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!formData.client_name || !formData.redirect_uris}>
                Create Client
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered Clients</CardTitle>
          <CardDescription>
            {clients?.length || 0} OAuth client(s) registered
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>Client ID</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients && clients.length > 0 ? (
                clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.client_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">{client.client_id}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(client.client_id, "Client ID")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {client.allowed_scopes.slice(0, 2).map((scope) => (
                          <Badge key={scope} variant="secondary" className="text-xs">
                            {scope}
                          </Badge>
                        ))}
                        {client.allowed_scopes.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{client.allowed_scopes.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.enabled ? (
                        <Badge variant="default" className="bg-success">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Disabled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{client.total_authorizations} authorizations</div>
                        {client.last_used_at && (
                          <div className="text-xs text-muted-foreground">
                            Last: {new Date(client.last_used_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleEnabled({ id: client.id, enabled: !client.enabled })}
                        >
                          {client.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete client "${client.client_name}"?`)) {
                              deleteClient(client.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No OAuth clients registered. Click "Add Client" to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-info/10 dark:bg-blue-950/20 border-info/30 dark:border-blue-900">
        <CardHeader>
          <CardTitle className="text-info dark:text-blue-100">OAuth Provider Endpoints</CardTitle>
          <CardDescription className="text-info dark:text-blue-300">
            Share these URLs with client app developers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-sm text-info dark:text-blue-200">Authorization URL</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs bg-card dark:bg-blue-950 px-3 py-1.5 rounded flex-1">
                {window.location.origin}/functions/v1/oauth-authorize
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(`${window.location.origin}/functions/v1/oauth-authorize`, "Authorization URL")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-sm text-info dark:text-blue-200">Token URL</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs bg-card dark:bg-blue-950 px-3 py-1.5 rounded flex-1">
                {window.location.origin}/functions/v1/oauth-token
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(`${window.location.origin}/functions/v1/oauth-token`, "Token URL")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-sm text-info dark:text-blue-200">UserInfo URL</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs bg-card dark:bg-blue-950 px-3 py-1.5 rounded flex-1">
                {window.location.origin}/functions/v1/oauth-userinfo
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(`${window.location.origin}/functions/v1/oauth-userinfo`, "UserInfo URL")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
