import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  useNotificationRules,
  useUpsertNotificationRule,
  useDeleteNotificationRule,
} from "../../hooks/useNotificationAdmin";
import { useNotificationEvents } from "../../hooks/useNotificationSubscriptions";
import type { NotificationRule } from "../../types";

const CHANNELS = ["in_app", "email", "slack", "teams", "sms", "webhook", "push"];

export default function NotificationRulesPage() {
  const { data: rules, isLoading } = useNotificationRules();
  const { data: events } = useNotificationEvents();
  const upsertRule = useUpsertNotificationRule();
  const deleteRule = useDeleteNotificationRule();

  const [form, setForm] = useState({
    name: "",
    event_key: "",
    channels: ["in_app", "email"] as string[],
    is_active: true,
  });

  const handleCreate = () => {
    if (!form.name || !form.event_key) return;
    upsertRule.mutate({
      name: form.name,
      description: `Route ${form.event_key} notifications`,
      conditions: { event_key: form.event_key },
      channels: form.channels,
      target_roles: [],
      target_departments: [],
      escalation: {},
      sort_order: (rules?.length ?? 0) + 1,
      is_active: form.is_active,
    });
    setForm({ name: "", event_key: "", channels: ["in_app", "email"], is_active: true });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notification Rules</h1>
        <p className="text-muted-foreground">
          Configure routing: IF event THEN channels
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Rule</CardTitle>
          <CardDescription>IF event matches THEN send via selected channels</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Task Assigned → Email + In-App"
              />
            </div>
            <div className="space-y-2">
              <Label>Event</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.event_key}
                onChange={(e) => setForm({ ...form, event_key: e.target.value })}
              >
                <option value="">Select event...</option>
                {(events ?? []).map((ev) => (
                  <option key={ev.event_key} value={ev.event_key}>
                    {ev.description}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Channels</Label>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <Button
                  key={ch}
                  size="sm"
                  variant={form.channels.includes(ch) ? "default" : "outline"}
                  onClick={() => {
                    const channels = form.channels.includes(ch)
                      ? form.channels.filter((c) => c !== ch)
                      : [...form.channels, ch];
                    setForm({ ...form, channels });
                  }}
                >
                  {ch}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
            <Label>Active</Label>
          </div>
          <Button onClick={handleCreate} disabled={upsertRule.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Add Rule
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(rules ?? []).map((rule: NotificationRule) => (
          <Card key={rule.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{rule.name}</p>
                  <Badge variant={rule.is_active ? "default" : "secondary"}>
                    {rule.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  IF {(rule.conditions as { event_key?: string })?.event_key ?? "any"} →{" "}
                  {rule.channels.join(" + ")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteRule.mutate(rule.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {!rules?.length && (
          <p className="text-sm text-muted-foreground text-center py-8">No rules configured</p>
        )}
      </div>
    </div>
  );
}
