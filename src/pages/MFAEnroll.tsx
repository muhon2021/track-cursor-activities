import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollMfaFactor, useVerifyMfaFactor, useMfaFactors } from "@/hooks/useMfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

export default function MFAEnroll() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { data: factors } = useMfaFactors();
  const enroll = useEnrollMfaFactor();
  const verify = useVerifyMfaFactor();
  const [code, setCode] = useState("");

  const verified = (factors ?? []).some((f) => f.status === "verified");

  useEffect(() => {
    if (verified) navigate("/dashboard", { replace: true });
  }, [verified, navigate]);

  useEffect(() => {
    if (!enroll.data && !enroll.isPending) {
      enroll.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = () => {
    if (!enroll.data) return;
    verify.mutate(
      { factorId: enroll.data.id, code },
      { onSuccess: () => navigate("/dashboard", { replace: true }) }
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle>Set up two-factor authentication</CardTitle>
          </div>
          <CardDescription>
            Your organization requires two-factor authentication. Scan the QR code below with an
            authenticator app, then enter the 6-digit code to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {enroll.isPending || !enroll.data ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {enroll.data.totp?.qr_code && (
                <img
                  src={enroll.data.totp.qr_code}
                  alt="MFA enrollment QR code"
                  className="mx-auto h-48 w-48"
                />
              )}
              <p className="text-center text-xs text-muted-foreground">
                Or enter this code manually: {enroll.data.totp?.secret}
              </p>
              <div className="space-y-2">
                <Label htmlFor="mfa-code">Verification code</Label>
                <Input
                  id="mfa-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleVerify}
                disabled={verify.isPending || code.length !== 6}
              >
                {verify.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify and continue
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => signOut()}>
                Sign out instead
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
