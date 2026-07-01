import { useState } from "react";
import { LayoutDashboard, Users, Loader2, GripVertical, Eye, EyeOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDashboardWidgets, useUpdateWidget } from "@/hooks/useDashboardWidgets";
import type { DashboardWidget } from "@/hooks/useDashboardWidgets";
import { cn } from "@/lib/utils";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  pm: "bg-info/15 text-info dark:text-blue-400",
  ic: "bg-success/15 text-success dark:text-green-400",
};

function WidgetRow({ widget }: { widget: DashboardWidget }) {
  const updateWidget = useUpdateWidget();
  const [editingOrder, setEditingOrder] = useState(false);
  const [orderValue, setOrderValue] = useState(String(widget.sort_order));

  const handleToggle = (checked: boolean) => {
    updateWidget.mutate({ id: widget.id, patch: { is_enabled: checked } });
  };

  const handleOrderBlur = () => {
    const parsed = parseInt(orderValue, 10);
    if (!isNaN(parsed) && parsed !== widget.sort_order) {
      updateWidget.mutate({ id: widget.id, patch: { sort_order: parsed } });
    }
    setEditingOrder(false);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors",
        widget.is_enabled ? "bg-card" : "bg-muted/30 opacity-60"
      )}
    >
      {/* Drag handle (visual only) */}
      <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab" />

      {/* Widget info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{widget.display_name}</span>
          <code className="text-xs text-muted-foreground bg-muted rounded px-1 py-0.5">
            {widget.component_name}
          </code>
          {widget.agency_roles.map((role) => (
            <span
              key={role}
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                ROLE_COLORS[role] ?? "bg-muted text-muted-foreground"
              )}
            >
              <Users className="mr-1 h-2.5 w-2.5" />
              {role}
            </span>
          ))}
        </div>
        {widget.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{widget.description}</p>
        )}
      </div>

      {/* Sort order */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Label className="text-xs text-muted-foreground sr-only">Order</Label>
        {editingOrder ? (
          <Input
            autoFocus
            type="number"
            value={orderValue}
            onChange={(e) => setOrderValue(e.target.value)}
            onBlur={handleOrderBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") { setOrderValue(String(widget.sort_order)); setEditingOrder(false); }
            }}
            className="h-7 w-16 text-xs text-center"
          />
        ) : (
          <button
            onClick={() => setEditingOrder(true)}
            title="Click to edit sort order"
            className="h-7 w-16 rounded border border-dashed border-border text-xs text-center text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
          >
            {widget.sort_order}
          </button>
        )}
      </div>

      {/* Visibility badge */}
      <div className="shrink-0">
        {widget.is_enabled ? (
          <Eye className="h-4 w-4 text-muted-foreground" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Enable/disable toggle */}
      <Switch
        checked={widget.is_enabled}
        disabled={updateWidget.isPending}
        onCheckedChange={handleToggle}
        aria-label={`Toggle ${widget.display_name}`}
      />
    </div>
  );
}

export default function DashboardWidgets() {
  const { data: widgets, isLoading } = useDashboardWidgets();

  const enabledCount = widgets?.filter((w) => w.is_enabled).length ?? 0;

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
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
                Dashboard Widget Registry
              </CardTitle>
              <CardDescription className="mt-1">
                {enabledCount} of {widgets?.length ?? 0} widgets enabled. Toggle visibility and
                adjust sort order for each role dashboard. Changes take effect immediately — no
                deploy required.
              </CardDescription>
            </div>
            <div className="flex gap-2 shrink-0">
              {(["owner", "pm", "bd", "ic"] as const).map((role) => {
                const count = widgets?.filter(
                  (w) => w.agency_roles.includes(role) && w.is_enabled
                ).length ?? 0;
                return (
                  <Badge
                    key={role}
                    variant="outline"
                    className={cn("capitalize", ROLE_COLORS[role])}
                  >
                    {role}: {count} on
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {!widgets || widgets.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No widgets registered yet. Widgets are seeded via migration.
            </p>
          ) : (
            widgets.map((widget) => (
              <WidgetRow key={widget.id} widget={widget} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">How widgets work</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1.5">
          <p>
            • Each widget is linked to one or more agency roles (<strong>owner</strong>,{" "}
            <strong>pm</strong>, <strong>ic</strong>). Only relevant dashboards display the
            widget.
          </p>
          <p>
            • Disabling a widget hides it from <em>all users</em> of that role — useful for
            gradually rolling out or pulling back features.
          </p>
          <p>
            • Sort order controls display sequence within a dashboard. Lower numbers appear
            first. Click the dashed number to edit inline.
          </p>
          <p>
            • New widgets must be registered via a database migration inserting a row into{" "}
            <code className="text-xs bg-muted rounded px-1">dashboard_widgets</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
