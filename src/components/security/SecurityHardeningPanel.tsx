import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, ShieldAlert } from "lucide-react";
import {
  useSecurityConfiguration,
  useUpdateSecurityConfiguration,
  type SecurityConfiguration,
} from "@/hooks/useSecurityHardening";

export function SecurityHardeningPanel() {
  const { data: config, isLoading } = useSecurityConfiguration();
  const updateConfig = useUpdateSecurityConfiguration();
  const [settings, setSettings] = useState<SecurityConfiguration | null>(null);

  useEffect(() => {
    if (config) setSettings(config);
  }, [config]);

  const isSaving = updateConfig.isPending;

  async function handleSave() {
    if (!settings) return;
    await updateConfig.mutateAsync({
      password_rotation_days: settings.password_rotation_days,
      max_login_attempts: settings.max_login_attempts,
      lockout_duration_minutes: settings.lockout_duration_minutes,
      hibp_check_enabled: settings.hibp_check_enabled,
      disposable_email_blocked: settings.disposable_email_blocked,
      smtp_check_enabled: settings.smtp_check_enabled,
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            <div>
              <CardTitle>Security Hardening</CardTitle>
              <CardDescription>
                Account lockouts, password expiry, breach checks, and email validation rules.
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
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="passwordRotation">Password rotation (days)</Label>
                <Input
                  id="passwordRotation"
                  type="number"
                  min={30}
                  max={365}
                  value={settings.password_rotation_days}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      password_rotation_days: parseInt(e.target.value, 10) || 90,
                    })
                  }
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxLoginAttempts">Max login attempts</Label>
                <Input
                  id="maxLoginAttempts"
                  type="number"
                  min={3}
                  max={20}
                  value={settings.max_login_attempts}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      max_login_attempts: parseInt(e.target.value, 10) || 5,
                    })
                  }
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lockoutDuration">Lockout duration (minutes)</Label>
                <Input
                  id="lockoutDuration"
                  type="number"
                  min={5}
                  max={1440}
                  value={settings.lockout_duration_minutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      lockout_duration_minutes: parseInt(e.target.value, 10) || 15,
                    })
                  }
                  disabled={isSaving}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Have I Been Pwned checks</Label>
                <p className="text-sm text-muted-foreground">
                  Reject passwords found in known breach databases.
                </p>
              </div>
              <Switch
                checked={settings.hibp_check_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, hibp_check_enabled: checked })
                }
                disabled={isSaving}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Block disposable email domains</Label>
                <p className="text-sm text-muted-foreground">
                  Prevent sign-ups from temporary email providers.
                </p>
              </div>
              <Switch
                checked={settings.disposable_email_blocked}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, disposable_email_blocked: checked })
                }
                disabled={isSaving}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>SMTP / MX record verification</Label>
                <p className="text-sm text-muted-foreground">
                  Validate that the email domain has MX records before accepting sign-up.
                </p>
              </div>
              <Switch
                checked={settings.smtp_check_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, smtp_check_enabled: checked })
                }
                disabled={isSaving}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
