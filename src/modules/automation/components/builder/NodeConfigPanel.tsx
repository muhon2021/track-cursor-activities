import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTION_OPTIONS, TRIGGER_OPTIONS } from "../../types";
import type { Node } from "@xyflow/react";

interface NodeConfigPanelProps {
  selectedNode: Node | null;
  triggerType: string;
  onTriggerTypeChange: (v: string) => void;
  onUpdateNode: (nodeId: string, config: Record<string, unknown>, label?: string) => void;
}

export function NodeConfigPanel({
  selectedNode,
  triggerType,
  onTriggerTypeChange,
  onUpdateNode,
}: NodeConfigPanelProps) {
  if (!selectedNode) {
    return (
      <Card className="w-72 shrink-0">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Select a node to edit</p>
        </CardContent>
      </Card>
    );
  }

  const config = (selectedNode.data?.config ?? {}) as Record<string, unknown>;
  const type = selectedNode.type ?? "action";

  const update = (patch: Record<string, unknown>, label?: string) => {
    onUpdateNode(selectedNode.id, { ...config, ...patch }, label);
  };

  return (
    <Card className="w-72 shrink-0">
      <CardHeader className="py-3">
        <CardTitle className="text-sm capitalize">{type} — {selectedNode.id}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {type === "trigger" && (
          <div className="space-y-2">
            <Label>Trigger type</Label>
            <Select value={triggerType} onValueChange={onTriggerTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {type === "condition" && (
          <>
            <div className="space-y-2">
              <Label>Field</Label>
              <Input
                value={String(config.field ?? "priority")}
                onChange={(e) => update({ field: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Operator</Label>
              <Select value={String(config.op ?? "eq")} onValueChange={(v) => update({ op: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="eq">Equals</SelectItem>
                  <SelectItem value="neq">Not Equals</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="gt">Greater Than</SelectItem>
                  <SelectItem value="lt">Less Than</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                value={String(config.value ?? "")}
                onChange={(e) => update({ value: e.target.value }, `if ${config.field} ${config.op} ${e.target.value}`)}
              />
            </div>
          </>
        )}

        {type === "action" && (
          <>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={String(config.action ?? "send_notification")}
                onValueChange={(v) => update({ action: v }, v.replace(/_/g, " "))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={String(config.title ?? "")}
                onChange={(e) => update({ title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={String(config.message ?? "")}
                onChange={(e) => update({ message: e.target.value })}
                rows={3}
              />
            </div>
          </>
        )}

        {type === "delay" && (
          <div className="space-y-2">
            <Label>Duration (e.g. 5m, 24h, 1d)</Label>
            <Input
              value={String(config.duration ?? "24h")}
              onChange={(e) => update({ duration: e.target.value }, `wait ${e.target.value}`)}
            />
          </div>
        )}

        {type === "approval" && (
          <>
            <div className="space-y-2">
              <Label>Level</Label>
              <Input
                type="number"
                value={String(config.level ?? 1)}
                onChange={(e) => update({ level: parseInt(e.target.value, 10) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                value={String(config.role ?? "manager")}
                onChange={(e) => update({ role: e.target.value }, `approval ${e.target.value}`)}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
