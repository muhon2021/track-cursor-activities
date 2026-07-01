import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Kanban, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useIntegrationProvider } from "@/hooks/useIntegrations";
import { useDisconnectOAuth, useUserOAuthToken, useConnectActiveCollabToken } from "@/hooks/useUserIntegrations";
import { useSyncProjects } from "@/hooks/useIntegrationSync";

export default function ActiveCollabIntegration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [clientName, setClientName] = useState<string>("Control Tower");
  const [clientVendor, setClientVendor] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const { data: provider, isLoading: providerLoading, error: providerError } =
    useIntegrationProvider("activecollab");

  const { data: userToken } = useUserOAuthToken("activecollab");
  const connectActiveCollab = useConnectActiveCollabToken();
  const disconnectOAuth = useDisconnectOAuth();
  const syncProjects = useSyncProjects("activecollab");

  const isUserConnected = Boolean(userToken?.is_active);
  const canSubmit =
    baseUrl.trim().length > 0 &&
    clientName.trim().length > 0 &&
    clientVendor.trim().length > 0 &&
    username.trim().length > 0 &&
    password.length > 0;

  const handleConnect = (): void => {
    connectActiveCollab.mutate(
      {
        base_url: baseUrl,
        client_name: clientName,
        client_vendor: clientVendor,
        username: username.trim(),
        password,
      },
      {
        onSuccess: () => {
          setPassword("");
          queryClient.invalidateQueries({ queryKey: ["user-oauth-tokens"] });
        },
      },
    );
  };

  const handleDisconnect = (): void => {
    disconnectOAuth.mutate(
      { provider: "activecollab" },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["user-oauth-tokens"] });
          toast({
            title: "Disconnected",
            description: "Your ActiveCollab API token has been removed from Control Tower.",
          });
        },
      },
    );
  };

  if (providerLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (providerError || !provider || provider.is_available === false) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Link
          to="/admin/integrations"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Integrations
        </Link>
        <p className="text-destructive">ActiveCollab is not available.</p>
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
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg">
            <Kanban className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">ActiveCollab</h1>
            <p className="text-muted-foreground mt-1">
              Connect with your instance URL and account. Tokens are issued via ActiveCollab&apos;s{" "}
              <code className="text-xs">issue-token</code> API (
              <a
                href="https://developers.activecollab.com/api-documentation/v1/authentication.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                docs
              </a>
              ).
            </p>
          </div>
        </div>
      </div>

      <Card className="border-2 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Kanban className="h-5 w-5 text-primary" />
            User API token
          </CardTitle>
          <CardDescription>
            Enter your ActiveCollab base URL, application labels (required by the API), and your sign-in
            credentials. Only the issued API token is stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 max-w-md">
            <div className="grid gap-2">
              <Label htmlFor="ac-base-url">Base URL</Label>
              <Input
                id="ac-base-url"
                type="url"
                autoComplete="off"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                disabled={isUserConnected}
                placeholder="https://your-company.activecollab.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ac-client-name">Client name</Label>
              <Input
                id="ac-client-name"
                type="text"
                autoComplete="off"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                disabled={isUserConnected}
                placeholder="Control Tower"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ac-client-vendor">Client vendor</Label>
              <Input
                id="ac-client-vendor"
                type="text"
                autoComplete="organization"
                value={clientVendor}
                onChange={(e) => setClientVendor(e.target.value)}
                disabled={isUserConnected}
                placeholder="Your company name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ac-admin-email">Email</Label>
              <Input
                id="ac-admin-email"
                type="email"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isUserConnected}
                placeholder="you@company.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ac-admin-password">Password</Label>
              <Input
                id="ac-admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isUserConnected}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleConnect}
              disabled={isUserConnected || connectActiveCollab.isPending || !canSubmit}
            >
              {connectActiveCollab.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Issue token & connect"
              )}
            </Button>
          </div>

          {isUserConnected && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={handleDisconnect} disabled={disconnectOAuth.isPending}>
                {disconnectOAuth.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  "Disconnect"
                )}
              </Button>
              <Button variant="secondary" onClick={() => syncProjects.mutate()} disabled={syncProjects.isPending}>
                {syncProjects.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync now
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
