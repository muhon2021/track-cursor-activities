import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, Play, Copy, Trash2, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAutomationWorkflows,
  useToggleWorkflow,
  useCloneWorkflow,
  useDeleteWorkflow,
  useExecuteWorkflow,
} from "../hooks/useAutomationWorkflows";
import { TRIGGER_OPTIONS } from "../types";

export default function WorkflowListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<string>("all");
  const [triggerFilter, setTriggerFilter] = useState<string>("all");

  const filters = {
    search: search || undefined,
    enabled: enabledFilter === "all" ? undefined : enabledFilter === "enabled",
    trigger_type: triggerFilter === "all" ? undefined : triggerFilter,
  };

  const { data: workflows = [], isLoading } = useAutomationWorkflows(filters);
  const toggle = useToggleWorkflow();
  const clone = useCloneWorkflow();
  const remove = useDeleteWorkflow();
  const execute = useExecuteWorkflow();

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">Manage automation workflows</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/automation/templates">Templates</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/automation/logs">Execution Logs</Link>
          </Button>
          <Button onClick={() => navigate("/automation/builder")}>
            <Plus className="mr-2 h-4 w-4" />
            New Workflow
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={enabledFilter} onValueChange={setEnabledFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={triggerFilter} onValueChange={setTriggerFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Trigger" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All triggers</SelectItem>
            {TRIGGER_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No workflows yet. Create one or clone a template.
                  </TableCell>
                </TableRow>
              ) : (
                workflows.map((wf) => (
                  <TableRow key={wf.id}>
                    <TableCell>
                      <div className="font-medium">{wf.name}</div>
                      {wf.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-xs">{wf.description}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{wf.trigger_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={wf.enabled}
                        onCheckedChange={(checked) => toggle.mutate({ id: wf.id, enabled: checked })}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {wf.updated_at ? new Date(wf.updated_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Run now"
                          onClick={() => execute.mutate({ id: wf.id })}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Edit"
                          onClick={() => navigate(`/automation/builder/${wf.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Clone"
                          onClick={() => clone.mutate(wf.id)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Delete"
                          onClick={() => remove.mutate(wf.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
