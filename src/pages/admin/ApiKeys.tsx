/**
 * API Keys Management Page
 *
 * Admin panel for managing API keys for programmatic access.
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useApiKeys } from "@/hooks/useApiKeys";
import { Plus, Key, Trash2, Copy, CheckCircle2, XCircle, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ApiKeys() {
  const { apiKeys, isLoading, createApiKey, deleteApiKey, toggleEnabled } = useApiKeys();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    scopes: "read,write",
    allowed_endpoints: "",
    allowed_ips: "",
    rate_limit: "60",
    expires_in_days: "",
  });

  const handleCreate = () => {
    const scopes = formData.scopes.split(",").map((s) => s.trim()).filter(Boolean);
    const endpoints = formData.allowed_endpoints ? formData.allowed_endpoints.split(",").map((e) => e.trim()).filter(Boolean) : [];
    const ips = formData.allowed_ips ? formData.allowed_ips.split(",").map((ip) => ip.trim()).filter(Boolean) : [];
    const expiresAt = formData.expires_in_days ? new Date(Date.now() + parseInt(formData.expires_in_days) * 24 * 60 * 60 * 1000).toISOString() : undefined;

    createApiKey(
      {
        name: formData.name,
        description: formData.description,
        scopes,
        allowed_endpoints: endpoints,
        allowed_ips: ips,
        rate_limit_per_minute: parseInt(formData.rate_limit) || 60,
        expires_at: expiresAt,
      },
      {
        onSuccess: (data: any) => {
          setNewKey(data.plaintext_key);
          setFormData({
            name: "",
            description: "",
            scopes: "read,write",
            allowed_endpoints: "",
            allowed_ips: "",
            rate_limit: "60",
            expires_in_days: "",
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
    return <div className="p-8">Loading API keys...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground mt-1">
            Manage API keys for programmatic access to Control Tower APIs
          </p>
        </div>
        <Dialog open={isCreateDialogOpen || newKey !== null} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) setNewKey(null);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            {newKey ? (
              <>
                <DialogHeader>
                  <DialogTitle>API Key Created Successfully!</DialogTitle>
                  <DialogDescription>
                    Save this key now. You won't be able to see it again.
                  </DialogDescription>
                </DialogHeader>
                <Alert className="bg-warning/10 dark:bg-yellow-950/20 border-warning/30">
                  <Key className="h-4 w-4" />
                  <AlertDescription className="ml-2">
                    <strong>Important:</strong> Copy and save this API key in a secure location. For security reasons, we cannot show it again.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2 py-4">
                  <Label>Your API Key</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-4 py-3 rounded font-mono text-sm break-all">
                      {newKey}
                    </code>
                    <Button onClick={() => copyToClipboard(newKey, "API Key")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => setNewKey(null)}>I've saved my key</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Generate a new API key for programmatic access
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      placeholder="Production API Key"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Used for automated deployments"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scopes">Scopes (comma-separated)</Label>
                    <Input
                      id="scopes"
                      placeholder="read, write, admin"
                      value={formData.scopes}
                      onChange={(e) => setFormData({ ...formData, scopes: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Available: read, write, admin</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="allowed_endpoints">Allowed Endpoints (optional, comma-separated)</Label>
                    <Input
                      id="allowed_endpoints"
                      placeholder="/api/v1/tasks/*, /api/v1/projects/*"
                      value={formData.allowed_endpoints}
                      onChange={(e) => setFormData({ ...formData, allowed_endpoints: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Leave blank to allow all endpoints. Use * for wildcards.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="allowed_ips">Allowed IPs (optional, comma-separated)</Label>
                    <Input
                      id="allowed_ips"
                      placeholder="192.168.1.100, 10.0.0.5"
                      value={formData.allowed_ips}
                      onChange={(e) => setFormData({ ...formData, allowed_ips: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Leave blank to allow all IPs</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rate_limit">Rate Limit (per minute)</Label>
                      <Input
                        id="rate_limit"
                        type="number"
                        placeholder="60"
                        value={formData.rate_limit}
                        onChange={(e) => setFormData({ ...formData, rate_limit: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expires_in_days">Expires In (days, optional)</Label>
                      <Input
                        id="expires_in_days"
                        type="number"
                        placeholder="365"
                        value={formData.expires_in_days}
                        onChange={(e) => setFormData({ ...formData, expires_in_days: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={!formData.name || !formData.scopes}>
                    Generate Key
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active API Keys</CardTitle>
          <CardDescription>
            {apiKeys?.length || 0} API key(s) created
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key Prefix</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys && apiKeys.length > 0 ? (
                apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{key.name}</div>
                        {key.description && (
                          <div className="text-xs text-muted-foreground">{key.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{key.key_prefix}</code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.map((scope) => (
                          <Badge key={scope} variant="secondary" className="text-xs">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {key.enabled ? (
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
                        <div>{key.total_requests} requests</div>
                        {key.last_used_at && (
                          <div className="text-xs text-muted-foreground">
                            Last: {new Date(key.last_used_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleEnabled({ id: key.id, enabled: !key.enabled })}
                        >
                          {key.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete API key "${key.name}"?`)) {
                              deleteApiKey(key.id);
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
                    No API keys created. Click "Create API Key" to generate one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-info/10 dark:bg-blue-950/20 border-info/30 dark:border-blue-900">
        <CardHeader>
          <CardTitle className="text-info dark:text-blue-100">API Usage</CardTitle>
          <CardDescription className="text-info dark:text-blue-300">
            How to use API keys in your requests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-sm text-info dark:text-blue-200">cURL Example</Label>
            <code className="block text-xs bg-card dark:bg-blue-950 px-3 py-2 rounded mt-1 font-mono">
              curl {window.location.origin}/api/v1/tasks \<br />
              &nbsp;&nbsp;-H "x-api-key: YOUR_API_KEY"
            </code>
          </div>
          <div>
            <Label className="text-sm text-info dark:text-blue-200">JavaScript Example</Label>
            <code className="block text-xs bg-card dark:bg-blue-950 px-3 py-2 rounded mt-1 font-mono overflow-x-auto">
              fetch('{window.location.origin}/api/v1/tasks', {'{'}<br />
              &nbsp;&nbsp;headers: {'{'} 'x-api-key': 'YOUR_API_KEY' {'}'}<br />
              {'}'})
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
