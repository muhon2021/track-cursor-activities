import { Settings } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardPreferences } from "@/hooks/useDashboardPreferences";

/**
 * Slide-in sheet for personalising the agency dashboard.
 * Backed by user_role_preferences.
 */
export function DashboardPreferencesSheet() {
  const { preferences, updatePreference, isPending } = useDashboardPreferences();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Dashboard settings">
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80">
        <SheetHeader className="mb-4">
          <SheetTitle>Dashboard preferences</SheetTitle>
          <SheetDescription>
            Personalise how your dashboard looks and behaves. Changes save instantly.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* AI Digest */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              AI Digest
            </p>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="ai-digest-enabled" className="text-sm">
                  Enable AI digest
                </Label>
                <p className="text-xs text-muted-foreground">
                  Show the AI-generated quarterly summary on your dashboard.
                </p>
              </div>
              <Switch
                id="ai-digest-enabled"
                checked={preferences.ai_digest_enabled}
                disabled={isPending}
                onCheckedChange={(checked) =>
                  updatePreference({ ai_digest_enabled: checked })
                }
              />
            </div>

            {preferences.ai_digest_enabled && (
              <div className="space-y-1.5">
                <Label htmlFor="ai-digest-freq" className="text-sm">
                  Digest frequency
                </Label>
                <Select
                  value={preferences.ai_digest_frequency}
                  onValueChange={(val) =>
                    updatePreference({ ai_digest_frequency: val as "weekly" | "daily" })
                  }
                  disabled={isPending}
                >
                  <SelectTrigger id="ai-digest-freq" className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </section>

          <Separator />

          {/* Tasks */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tasks
            </p>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="hide-completed" className="text-sm">
                  Hide completed tasks
                </Label>
                <p className="text-xs text-muted-foreground">
                  Remove done / cancelled tasks from your My Work board.
                </p>
              </div>
              <Switch
                id="hide-completed"
                checked={preferences.hide_completed_tasks}
                disabled={isPending}
                onCheckedChange={(checked) =>
                  updatePreference({ hide_completed_tasks: checked })
                }
              />
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
