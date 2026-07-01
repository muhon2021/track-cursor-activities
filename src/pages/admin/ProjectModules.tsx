import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import {
  useProjectModuleSettings,
  useToggleProjectModule,
} from "@/hooks/useProjectModuleSettings";

export default function ProjectModules() {
  const { data: modules, isLoading } = useProjectModuleSettings();
  const toggleMutation = useToggleProjectModule();

  const enabledCount = modules?.filter((m) => m.enabled).length ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Modules</CardTitle>
          <CardDescription>
            {enabledCount} of {modules?.length ?? 0} tabs enabled on project detail pages.
            Changes are saved to <code className="text-xs">system_settings</code> and take
            effect immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {modules?.map((module) => (
            <div
              key={module.key}
              className="flex items-center justify-between rounded-md border px-4 py-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{module.label}</span>
                  <Badge variant="outline" className="text-xs font-mono">
                    {module.key}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {module.description}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Label htmlFor={module.key} className="text-xs">
                  {module.enabled ? "Enabled" : "Disabled"}
                </Label>
                <Switch
                  id={module.key}
                  checked={module.enabled}
                  disabled={toggleMutation.isPending}
                  onCheckedChange={(enabled) =>
                    toggleMutation.mutate({ key: module.key, enabled: Boolean(enabled) })
                  }
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
