import { useState } from "react";
import {
  useMfaFactors,
  useEnrollMfaFactor,
  useVerifyMfaFactor,
  useUnenrollMfaFactor,
} from "@/hooks/useMfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, ShieldCheck, Trash2 } from "lucide-react";

export default function AccountSecurity() {
  const { data: factors, isLoading } = useMfaFactors();
  const enroll = useEnrollMfaFactor();
  const verify = useVerifyMfaFactor();
  const unenroll = useUnenrollMfaFactor();

  const [code, setCode] = useState("");

  const verifiedFactors = (factors ?? []).filter((f) => f.status === "verified");
  const pendingFactor = enroll.data;

  const handleEnroll = () => {
    setCode("");
    enroll.mutate();
  };

  const handleVerify = () => {
    if (!pendingFactor) return;
    verify.mutate(
      { factorId: pendingFactor.id, code },
      { onSuccess: () => setCode("") }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account security</h1>
        <p className="text-muted-foreground">
          Manage your two-factor authentication methods.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle>Two-factor authentication</CardTitle>
          </div>
          <CardDescription>
            Add an authenticator app to protect your account with a one-time code on sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {verifiedFactors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">Authenticator app</p>
                    <p className="text-xs text-muted-foreground">
                      Added {new Date(factor.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-600">
                      Active
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unenroll.mutate(factor.id)}
                      disabled={unenroll.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {!verifiedFactors.length && !pendingFactor && (
                <Button onClick={handleEnroll} disabled={enroll.isPending}>
                  {enroll.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Set up authenticator app
                </Button>
              )}

              {pendingFactor && (
                <div className="space-y-3 rounded-md border p-4">
                  <p className="text-sm font-medium">
                    Scan this QR code with your authenticator app, then enter the 6-digit code.
                  </p>
                  {pendingFactor.totp?.qr_code && (
                    <img
                      src={pendingFactor.totp.qr_code}
                      alt="MFA enrollment QR code"
                      className="h-40 w-40"
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Or enter this code manually: {pendingFactor.totp?.secret}
                  </p>
                  <div className="space-y-2 max-w-xs">
                    <Label htmlFor="mfa-code">Verification code</Label>
                    <Input
                      id="mfa-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="123456"
                      maxLength={6}
                    />
                  </div>
                  <Button onClick={handleVerify} disabled={verify.isPending || code.length !== 6}>
                    {verify.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Verify and enable
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
