import { useState, useEffect } from "react";
import { useAppConfig, useUpdateAppConfig } from "@/hooks/useAppConfig";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Mail, Save, Loader2 } from "lucide-react";

export default function NotificationSettings() {
  const { data: config, isLoading } = useAppConfig();
  const updateConfig = useUpdateAppConfig();

  const [email, setEmail] = useState({
    enableEmailNotifications: true,
    fromName: "",
    fromEmail: "",
  });

  useEffect(() => {
    if (config) {
      setEmail({
        enableEmailNotifications: config.email.enableEmailNotifications,
        fromName: config.email.fromName,
        fromEmail: config.email.fromEmail,
      });
    }
  }, [config]);

  const isSaving = updateConfig.isPending;

  async function handleSave() {
    if (!config) return;
    await updateConfig.mutateAsync({ ...config, email });
  }

  if (isLoading || !config) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Configure email notifications and outgoing sender details
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>Email Settings</CardTitle>
          </div>
          <CardDescription>
            Configure email notifications and sender information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Enable system email notifications
              </p>
            </div>
            <Switch
              checked={email.enableEmailNotifications}
              onCheckedChange={(checked) =>
                setEmail({ ...email, enableEmailNotifications: checked })
              }
              disabled={isSaving}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="fromName">From Name</Label>
            <Input
              id="fromName"
              value={email.fromName}
              onChange={(e) => setEmail({ ...email, fromName: e.target.value })}
              placeholder="Control Tower"
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              The display name used in outgoing system emails.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fromEmail">From Email</Label>
            <Input
              id="fromEmail"
              type="email"
              value={email.fromEmail}
              onChange={(e) => setEmail({ ...email, fromEmail: e.target.value })}
              placeholder="noreply@yourcompany.com"
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              The email address system notifications are sent from.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
