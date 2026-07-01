/**
 * SecuritySettings — authentication and SSO configuration, plus auth-related
 * platform toggles (email verification requirement, session timeout) moved out
 * of the Advanced page so they live alongside other security controls.
 */
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, ShieldCheck, KeyRound, ArrowRight, Globe, MonitorSmartphone } from "lucide-react";
import { useAppConfig, useUpdateAppConfig, AppConfig } from "@/hooks/useAppConfig";
import SSOSettings from "@/pages/admin/SSOSettings";
import { SecurityHardeningPanel } from "@/components/security/SecurityHardeningPanel";
import { Link } from "react-router-dom";

export default function SecuritySettings() {
  const { data: config, isLoading } = useAppConfig();
  const updateConfig = useUpdateAppConfig();
  const [settings, setSettings] = useState<AppConfig | null>(null);

  useEffect(() => {
    if (config) setSettings(config);
  }, [config]);

  const isSaving = updateConfig.isPending;

  async function handleSave() {
    if (!settings) return;
    await updateConfig.mutateAsync(settings);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <div>
                <CardTitle>Authentication Policies</CardTitle>
                <CardDescription>
                  Controls how users sign up and how long their sessions last.
                </CardDescription>
              </div>
            </div>
            <Button onClick={handleSave} disabled={isSaving || !settings}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading || !settings ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Email Verification</Label>
                  <p className="text-sm text-muted-foreground">
                    Require users to verify their email before signing in
                  </p>
                </div>
                <Switch
                  checked={settings.system.requireEmailVerification}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      system: { ...settings.system, requireEmailVerification: checked },
                    })
                  }
                  disabled={isSaving}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="sessionTimeout">Session Timeout (days)</Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  min="1"
                  max="30"
                  value={settings.system.sessionTimeout}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      system: {
                        ...settings.system,
                        sessionTimeout: parseInt(e.target.value) || 7,
                      },
                    })
                  }
                  disabled={isSaving}
                  className="w-32"
                />
                <p className="text-sm text-muted-foreground">
                  Number of days before a user session expires.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              <div>
                <CardTitle>Multi-Factor Authentication</CardTitle>
                <CardDescription>
                  Enforce MFA enrollment and manage who still needs to set it up.
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link to="/admin/security/mfa">
                Manage MFA
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              <div>
                <CardTitle>Self-Signup Domain Whitelist</CardTitle>
                <CardDescription>
                  Restrict open self-signup to approved email domains.
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link to="/admin/security/signup-whitelist">
                Manage Whitelist
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <SecurityHardeningPanel />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <div>
                <CardTitle>Security Analytics</CardTitle>
                <CardDescription>
                  Monitor lockouts, blocked sign-ups, and audit anomalies.
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link to="/admin/security/analytics">
                View Analytics
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="h-5 w-5" />
              <div>
                <CardTitle>Session Management</CardTitle>
                <CardDescription>
                  View active sessions org-wide and force-terminate any of them.
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link to="/admin/security/sessions">
                Manage Sessions
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <SSOSettings />
    </div>
  );
}
