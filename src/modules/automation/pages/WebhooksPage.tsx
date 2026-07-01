import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAutomationWebhooks, useCreateWebhook, useDeleteWebhook } from "../hooks/useAutomationAnalytics";
import { useAutomationWorkflows } from "../hooks/useAutomationWorkflows";
import { env } from "@/shared/config/env";

export default function WebhooksPage() {
  const { data: webhooks = [], isLoading } = useAutomationWebhooks();
  const { data: workflows = [] } = useAutomationWorkflows();
  const createWebhook = useCreateWebhook();
  const deleteWebhook = useDeleteWebhook();

  const [name, setName] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [open, setOpen] = useState(false);

  const baseUrl = `${env.supabase.url}/functions/v1/automation-webhook-receiver`;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground">Incoming webhook endpoints for workflows</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/automation/workflows">Workflows</Link></Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add Webhook</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Webhook</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Workflow</Label>
                  <Select value={workflowId} onValueChange={setWorkflowId}>
                    <SelectTrigger><SelectValue placeholder="Select workflow" /></SelectTrigger>
                    <SelectContent>
                      {workflows.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={!name || !workflowId}
                  onClick={() => {
                    createWebhook.mutate({ name, workflow_id: workflowId }, {
                      onSuccess: () => { setOpen(false); setName(""); setWorkflowId(""); },
                    });
                  }}
                >
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((wh) => (
                <TableRow key={wh.id}>
                  <TableCell>{wh.name}</TableCell>
                  <TableCell className="font-mono text-xs max-w-md truncate">
                    {baseUrl}?slug={wh.path_slug}
                  </TableCell>
                  <TableCell>{wh.enabled ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => deleteWebhook.mutate(wh.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
