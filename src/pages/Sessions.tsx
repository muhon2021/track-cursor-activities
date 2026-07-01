import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Info, RefreshCw, CheckCheck, LogOut, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatDate(isoString: string | undefined): string {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function truncateSessionId(token: string | undefined): string {
  if (!token) return "—";
  return token.substring(0, 24);
}

function minutesRemaining(expiresAt: number | undefined): string {
  if (!expiresAt) return "—";
  const diff = expiresAt * 1000 - Date.now();
  const mins = Math.max(0, Math.floor(diff / 60000));
  return `${mins} min remaining`;
}

export default function Sessions() {
  const { session, profile, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSigningOutOthers, setIsSigningOutOthers] = useState(false);
  const [isSigningOutEverywhere, setIsSigningOutEverywhere] = useState(false);

  const handleRefreshSession = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      if (data.session) {
        toast({
          title: "Session refreshed",
          description: "Your session has been refreshed successfully.",
        });
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        title: "Refresh failed",
        description: err?.message ?? "Could not refresh session.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSignOutOthers = async () => {
    setIsSigningOutOthers(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      toast({
        title: "Other sessions signed out",
        description: "All other devices have been signed out.",
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        title: "Sign out failed",
        description: err?.message ?? "Could not sign out other devices.",
        variant: "destructive",
      });
    } finally {
      setIsSigningOutOthers(false);
    }
  };

  const handleSignOutEverywhere = async () => {
    setIsSigningOutEverywhere(true);
    try {
      await signOut();
      navigate("/login");
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        title: "Sign out failed",
        description: err?.message ?? "Could not sign out everywhere.",
        variant: "destructive",
      });
      setIsSigningOutEverywhere(false);
    }
  };

  if (authLoading || !session) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading session…</p>
      </div>
    );
  }

  const user = session.user;
  const expiresAt = session.expires_at;
  const storageType = "localStorage";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Session management</h1>
        <p className="text-muted-foreground">
          Control where you are signed in, refresh tokens, and choose how sessions persist.
        </p>
      </div>

      {/* Session expiry warning */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/50">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
        <div className="text-sm text-amber-800 dark:text-amber-200">
          <strong>Session expiry warning.</strong> Sessions refresh automatically while you are
          active. You can still be signed out if an inactivity policy, single-session enforcement,
          or manual sign out occurs.
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current session */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Current session</CardTitle>
              <Badge variant="default" className="bg-green-600">Active</Badge>
            </div>
            <CardDescription>Review your active Supabase session details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium text-muted-foreground">User:</span>{" "}
                {user?.email ?? "—"}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">Last sign in:</span>{" "}
                {formatDate(user?.last_sign_in_at)}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">Session ID:</span>{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {truncateSessionId(session.access_token)}
                </code>
              </p>
              <p>
                <span className="font-medium text-muted-foreground">Session expires:</span>{" "}
                {formatDate(expiresAt ? new Date(expiresAt * 1000).toISOString() : undefined)}{" "}
                <span className="text-muted-foreground">({minutesRemaining(expiresAt)})</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Auto-refresh enabled</Badge>
              <Badge variant="secondary">Keeps you signed in after restarts</Badge>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleRefreshSession}
                disabled={isRefreshing}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh session
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSignOutOthers}
                disabled={isSigningOutOthers}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Sign out other devices
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleSignOutEverywhere}
                disabled={isSigningOutEverywhere}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out everywhere
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Session storage */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Session storage</CardTitle>
            </div>
            <CardDescription>Where we store your Supabase session tokens.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium text-muted-foreground">Storage type:</span>{" "}
                Persistent ({storageType}) — survives browser restarts.
              </p>
              <p className="text-muted-foreground">
                Change this in the login screen using the &quot;Remember me&quot; toggle before you
                sign in.
              </p>
              <p>
                <span className="font-medium text-muted-foreground">Current device:</span>{" "}
                {profile?.full_name || user?.email || "Unknown"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
