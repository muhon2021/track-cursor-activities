import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Bell, Mail, Clock } from "lucide-react";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "../hooks/useNotificationPreferences";
import {
  useNotificationEvents,
  useNotificationSubscriptions,
  useUpdateSubscription,
} from "../hooks/useNotificationSubscriptions";
import type { NotificationPreferences } from "../types";

export default function NotificationPreferencesPage() {
  const { data: prefs, isLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();
  const { data: events } = useNotificationEvents();
  const { data: subscriptions } = useNotificationSubscriptions();
  const updateSub = useUpdateSubscription();

  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    if (prefs) setLocalPrefs(prefs);
  }, [prefs]);

  const getSub = (eventKey: string) =>
    subscriptions?.find((s) => s.event_key === eventKey);

  if (isLoading || !localPrefs) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const handleSave = () => {
    updatePrefs.mutate(localPrefs);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notification Preferences</h1>
        <p className="text-muted-foreground">
          Configure how and when you receive notifications
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Channels
          </CardTitle>
          <CardDescription>Global channel toggles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="in-app">In-App Notifications</Label>
            <Switch
              id="in-app"
              checked={localPrefs.in_app_enabled}
              onCheckedChange={(v) => setLocalPrefs({ ...localPrefs, in_app_enabled: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Notifications
            </Label>
            <Switch
              id="email"
              checked={localPrefs.email_enabled}
              onCheckedChange={(v) => setLocalPrefs({ ...localPrefs, email_enabled: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Digest & Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Digest Mode</Label>
            <Select
              value={localPrefs.digest_mode}
              onValueChange={(v) =>
                setLocalPrefs({
                  ...localPrefs,
                  digest_mode: v as NotificationPreferences["digest_mode"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Instant</SelectItem>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily (Morning Digest)</SelectItem>
                <SelectItem value="weekly">Weekly Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input
                value={localPrefs.timezone}
                onChange={(e) => setLocalPrefs({ ...localPrefs, timezone: e.target.value })}
                placeholder="UTC"
              />
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={localPrefs.language}
                onValueChange={(v) => setLocalPrefs({ ...localPrefs, language: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Working Hours Start</Label>
              <Input
                type="time"
                value={localPrefs.working_hours.start}
                onChange={(e) =>
                  setLocalPrefs({
                    ...localPrefs,
                    working_hours: { ...localPrefs.working_hours, start: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Working Hours End</Label>
              <Input
                type="time"
                value={localPrefs.working_hours.end}
                onChange={(e) =>
                  setLocalPrefs({
                    ...localPrefs,
                    working_hours: { ...localPrefs.working_hours, end: e.target.value },
                  })
                }
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Mute Notifications</Label>
            <Switch
              checked={!!localPrefs.mute_until && new Date(localPrefs.mute_until) > new Date()}
              onCheckedChange={(v) =>
                setLocalPrefs({
                  ...localPrefs,
                  mute_until: v ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event Subscriptions</CardTitle>
          <CardDescription>Choose which events you want to receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(events ?? []).map((event) => {
            const sub = getSub(event.event_key);
            const inApp = sub?.in_app ?? true;
            const email = sub?.email ?? false;

            return (
              <div
                key={event.event_key}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-sm">{event.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.category} · {event.event_key}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">In-App</Label>
                    <Switch
                      checked={inApp}
                      onCheckedChange={(v) =>
                        updateSub.mutate({ event_key: event.event_key, in_app: v, email })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Email</Label>
                    <Switch
                      checked={email}
                      onCheckedChange={(v) =>
                        updateSub.mutate({ event_key: event.event_key, in_app: inApp, email: v })
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={updatePrefs.isPending}>
        {updatePrefs.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Preferences
      </Button>
    </div>
  );
}
