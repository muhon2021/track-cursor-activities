import { useState, useEffect } from "react";
import { useAppConfig, useUpdateAppConfig, AppConfig } from "@/hooks/useAppConfig";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Zap, Save, Shield, Loader2 } from "lucide-react";

export default function AdvancedSettings() {
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

  if (isLoading || !settings) {
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
          <h1 className="text-3xl font-bold tracking-tight">Advanced</h1>
          <p className="text-muted-foreground">
            Feature flags and platform-wide operational toggles
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
            <Zap className="h-5 w-5" />
            <CardTitle>Feature Flags</CardTitle>
          </div>
          <CardDescription>Enable or disable platform features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              ["enableAIChat", "AI Chat", "Enable AI assistant chat functionality"],
              ["enableKnowledgeBase", "Knowledge Base", "Enable knowledge base management"],
              ["enableMeetings", "Meetings", "Enable meeting management and scheduling"],
              ["enableTasks", "Tasks", "Enable task management functionality"],
              ["enableNotifications", "Notifications", "Enable notification system"],
              ["enableAutomations", "Automation Engine", "Enable workflow automation engine"],
              ["enableSemanticSearch", "Semantic Search", "Enable AI-powered semantic search"],
              ["enableGraphify", "Graphify", "Enable knowledge graph and hybrid graph-aware retrieval"],
              ["enableClients", "Clients Module", "Enable client/CRM management"],
              ["enableAIAgents", "AI Agents", "Enable AI agents management"],
              ["enablePersonalKnowledge", "Personal Knowledge", "Enable user personal file uploads"],
              ["enableFeedback", "Feedback Collection", "Enable user feedback submission"],
              ["enableGoogleDrive", "Google Drive Integration", "Enable Google Drive file sync"],
              ["enableZoomSync", "Zoom Integration", "Enable Zoom meeting sync"],
            ] as const
          ).map(([key, label, description], index) => (
            <div key={key}>
              {index > 0 && <Separator className="my-3" />}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{label}</Label>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <Switch
                  checked={settings.features[key]}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      features: { ...settings.features, [key]: checked },
                    })
                  }
                  disabled={isSaving}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Platform Operations</CardTitle>
          </div>
          <CardDescription>
            Operational toggles. Authentication-related controls have moved to Security settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">
                Put the platform in maintenance mode
              </p>
            </div>
            <Switch
              checked={settings.system.maintenanceMode}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  system: { ...settings.system, maintenanceMode: checked },
                })
              }
              disabled={isSaving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Allow Signups</Label>
              <p className="text-sm text-muted-foreground">
                Allow new users to self-register
              </p>
            </div>
            <Switch
              checked={settings.system.allowSignups}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  system: { ...settings.system, allowSignups: checked },
                })
              }
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

