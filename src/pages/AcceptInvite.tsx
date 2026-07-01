import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface InviteDetails {
  email: string;
  welcome_message?: string | null;
  roles?: { name: string } | null;
}

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No invitation token provided");
      setLoading(false);
      return;
    }

    invokeEdgeFunction<{ invite: InviteDetails }>("validate-user-invite", { token })
      .then((data) => setInvite(data.invite))
      .catch((err) => setError(err instanceof Error ? err.message : "Invalid or expired invitation"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!token || !user) return;
    setAccepting(true);
    try {
      await invokeEdgeFunction("accept-user-invite", { token });
      toast.success("Invitation accepted!");
      navigate("/onboarding");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept invitation");
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    const lower = error.toLowerCase();
    const isRevoked = lower.includes("revoked");
    const title = lower.includes("already accepted")
      ? "Invitation Already Used"
      : lower.includes("expired")
      ? "Invitation Expired"
      : isRevoked
      ? "Invitation Replaced"
      : lower.includes("cancelled")
      ? "Invitation Cancelled"
      : "Invalid Invitation";

    const description = isRevoked
      ? "This invitation was replaced by a newer one. Please use the most recent email sent to you, or contact your administrator to request a new invite."
      : error;

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{description}</p>
            <Button asChild>
              <Link to="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Accept Invitation</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join Control Tower
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {invite?.welcome_message && (
            <Alert>
              <AlertDescription>{invite.welcome_message}</AlertDescription>
            </Alert>
          )}
          <div className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Email:</span> {invite?.email}
            </p>
            {invite?.roles?.name && (
              <p>
                <span className="text-muted-foreground">Role:</span> {invite.roles.name}
              </p>
            )}
          </div>

          {!user ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Sign in or create an account with <strong>{invite?.email}</strong> to accept.
              </p>
              <Button asChild className="w-full">
                <Link to={`/signup?email=${encodeURIComponent(invite?.email ?? "")}&token=${token}`}>
                  Create Account
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link to={`/login?email=${encodeURIComponent(invite?.email ?? "")}&token=${token}`}>
                  Sign In
                </Link>
              </Button>
            </div>
          ) : user.email?.toLowerCase() !== invite?.email.toLowerCase() ? (
            <Alert variant="destructive">
              <AlertDescription>
                You are signed in as {user.email}. Please sign in with {invite?.email}.
              </AlertDescription>
            </Alert>
          ) : (
            <Button className="w-full" onClick={handleAccept} disabled={accepting}>
              {accepting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Accept Invitation
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
