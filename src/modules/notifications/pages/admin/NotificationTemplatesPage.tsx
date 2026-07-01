import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye } from "lucide-react";
import {
  useNotificationTemplates,
  useUpsertNotificationTemplate,
} from "../../hooks/useNotificationAdmin";
import { useNotificationEvents } from "../../hooks/useNotificationSubscriptions";
import { previewTemplate } from "../../lib/templateEngine";

export default function NotificationTemplatesPage() {
  const { data: templates, isLoading } = useNotificationTemplates();
  const { data: events } = useNotificationEvents();
  const upsertTemplate = useUpsertNotificationTemplate();

  const [form, setForm] = useState({
    event_key: "",
    channel: "email",
    subject: "",
    body: "Hello {{user}},\n\n{{task}} has been updated.",
    locale: "en",
  });
  const [showPreview, setShowPreview] = useState(false);

  const preview = previewTemplate(form.subject, form.body);

  const handleSave = () => {
    if (!form.event_key || !form.body) return;
    upsertTemplate.mutate({
      event_key: form.event_key,
      channel: form.channel,
      subject: form.subject,
      body: form.body,
      locale: form.locale,
      is_active: true,
      version: 1,
    });
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
        <h1 className="text-3xl font-bold tracking-tight">Notification Templates</h1>
        <p className="text-muted-foreground">
          Manage templates with variables: {"{{user}}"}, {"{{task}}"}, {"{{meeting}}"}, {"{{rock}}"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create / Update Template</CardTitle>
          <CardDescription>Supports versioning via is_active flag per locale</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Event</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.event_key}
                onChange={(e) => setForm({ ...form, event_key: e.target.value })}
              >
                <option value="">Select...</option>
                {(events ?? []).map((ev) => (
                  <option key={ev.event_key} value={ev.event_key}>
                    {ev.description}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
              >
                {["in_app", "email", "slack", "teams"].map((ch) => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Locale</Label>
              <Input
                value={form.locale}
                onChange={(e) => setForm({ ...form, locale: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Task assigned: {{task}}"
            />
          </div>
          <div className="space-y-2">
            <Label>Body</Label>
            <Textarea
              rows={6}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={upsertTemplate.isPending}>
              Save Template
            </Button>
            <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
          </div>
          {showPreview && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="font-medium">{preview.subject}</p>
              <pre className="mt-2 whitespace-pre-wrap text-sm">{preview.body}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(templates ?? []).map((t) => (
          <Card key={t.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{t.event_key} · {t.channel}</p>
                <p className="text-xs text-muted-foreground">
                  v{t.version} · {t.locale}
                </p>
              </div>
              <Badge variant={t.is_active ? "default" : "secondary"}>
                {t.is_active ? "Active" : "Inactive"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
