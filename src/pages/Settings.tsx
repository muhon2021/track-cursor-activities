import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { usePreferences, useUpdatePreferences, useResetPreferences, UserPreferences } from "@/hooks/usePreferences";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Moon, Globe, Shield, Zap, Loader2, ArrowRight } from "lucide-react";
import { ConnectedServices } from "@/components/settings/ConnectedServices";
import { OrganizationIntegrations } from "@/components/settings/OrganizationIntegrations";
import { Link } from "react-router-dom";

export default function Settings() {
  const { data: preferences, isLoading } = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const resetPreferences = useResetPreferences();
  const { setTheme } = useTheme();

  const [settings, setSettings] = useState<UserPreferences | null>(null);

  // Sync settings with loaded preferences and apply theme
  useEffect(() => {
    if (preferences) {
      setSettings(preferences);
      // Apply the saved theme immediately (next-themes handles "system" when enableSystem is true)
      const themeToApply = preferences.appearance.theme;
      setTheme(themeToApply);
    }
  }, [preferences, setTheme]);

  const handleSave = () => {
    if (settings) {
      updatePreferences.mutate(settings);
    }
  };

  const handleReset = () => {
    resetPreferences.mutate();
  };

  if (isLoading || !settings) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isProcessing = updatePreferences.isPending || resetPreferences.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your application preferences and settings
        </p>
      </div>

      {/* Notifications Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Notifications</CardTitle>
          </div>
          <CardDescription>Configure how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
              </p>
            </div>
            <Switch
              checked={settings.notifications.email}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, email: checked },
                })
              }
              disabled={isProcessing}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive push notifications in browser
              </p>
            </div>
            <Switch
              checked={settings.notifications.push}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, push: checked },
                })
              }
              disabled={isProcessing}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Meeting Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Get notified about upcoming meetings
              </p>
            </div>
            <Switch
              checked={settings.notifications.meetings}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, meetings: checked },
                })
              }
              disabled={isProcessing}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Client Updates</Label>
              <p className="text-sm text-muted-foreground">
                Notifications for client-related activities
              </p>
            </div>
            <Switch
              checked={settings.notifications.clients}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, clients: checked },
                })
              }
              disabled={isProcessing}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Task Updates</Label>
              <p className="text-sm text-muted-foreground">
                Notifications for task assignments and updates
              </p>
            </div>
            <Switch
              checked={settings.notifications.tasks}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, tasks: checked },
                })
              }
              disabled={isProcessing}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>AI Agent Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when AI agents complete tasks
              </p>
            </div>
            <Switch
              checked={settings.notifications.aiAgents}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, aiAgents: checked },
                })
              }
              disabled={isProcessing}
            />
          </div>
        </CardContent>
      </Card>

      {/* Appearance Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            <CardTitle>Appearance</CardTitle>
          </div>
          <CardDescription>Customize the look and feel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select
              value={settings.appearance.theme}
              onValueChange={(value) => {
                const themeValue = value as "light" | "dark" | "system";
                setSettings({
                  ...settings,
                  appearance: { ...settings.appearance, theme: themeValue },
                });
                // Apply theme immediately (next-themes handles "system" when enableSystem is true)
                const themeToApply = themeValue;
                setTheme(themeToApply);
                // Save to database
                updatePreferences.mutate({
                  ...settings,
                  appearance: { ...settings.appearance, theme: themeValue },
                });
              }}
              disabled={isProcessing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Select your preferred theme
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Language</Label>
            <Select
              value={settings.appearance.language}
              onValueChange={(value) =>
                setSettings({
                  ...settings,
                  appearance: { ...settings.appearance, language: value },
                })
              }
              disabled={isProcessing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Choose your preferred language
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Privacy & Security</CardTitle>
          </div>
          <CardDescription>Control your privacy preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Profile Visibility</Label>
            <Select
              value={settings.privacy.profileVisibility}
              onValueChange={(value) =>
                setSettings({
                  ...settings,
                  privacy: { ...settings.privacy, profileVisibility: value as "public" | "team" | "private" },
                })
              }
              disabled={isProcessing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="team">Team Only</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Who can see your profile information
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Activity Tracking</Label>
              <p className="text-sm text-muted-foreground">
                Allow system to track your activity for analytics
              </p>
            </div>
            <Switch
              checked={settings.privacy.activityTracking}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  privacy: { ...settings.privacy, activityTracking: checked },
                })
              }
              disabled={isProcessing}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Two-factor authentication</Label>
              <p className="text-sm text-muted-foreground">
                Manage authenticator app and MFA enrollment
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/settings/security">
                Manage
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <CardTitle>AI Features</CardTitle>
          </div>
          <CardDescription>Configure AI assistant behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>AI Suggestions</Label>
              <p className="text-sm text-muted-foreground">
                Enable AI-powered suggestions throughout the app
              </p>
            </div>
            <Switch
              checked={settings.ai.enableSuggestions}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  ai: { ...settings.ai, enableSuggestions: checked },
                })
              }
              disabled={isProcessing}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Summarize Meetings</Label>
              <p className="text-sm text-muted-foreground">
                Automatically generate summaries for new meetings
              </p>
            </div>
            <Switch
              checked={settings.ai.autoSummarize}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  ai: { ...settings.ai, autoSummarize: checked },
                })
              }
              disabled={isProcessing}
            />
          </div>
        </CardContent>
      </Card>

      {/* Organization Integrations — admin hub defaults visible to all users */}
      <OrganizationIntegrations />

      {/* Connected Services - User Integration Connections */}
      <ConnectedServices />

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleReset} disabled={isProcessing}>
          Reset to Defaults
        </Button>
        <Button onClick={handleSave} disabled={isProcessing}>
          {isProcessing ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
