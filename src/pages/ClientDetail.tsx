import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useClient, useDeleteClient } from "@/hooks/useClients";
import { useClientMeetings } from "@/modules/meetings/hooks/useCrossModuleMeetings";
import { useProjects } from "@/hooks/useProjects";
import { useDeals } from "@/modules/business-dev/hooks/useDeals";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Edit, Trash2, Mail, Phone, Building2, Loader2, Calendar, FolderKanban, Handshake, FileText, Activity } from "lucide-react";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { useState } from "react";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: client, isLoading } = useClient(id || "");
  const deleteClient = useDeleteClient();
  const { data: linkedMeetings = [] } = useClientMeetings(id);
  const { data: clientProjects = [] } = useProjects(id ? { client_id: id, is_archived: false } : undefined);
  const { data: clientDeals = [] } = useDeals(id ? { client_id: id } : undefined);

  const projectIds = clientProjects.map((p) => p.id).sort().join(",");
  const { data: invoiceSummary } = useQuery({
    queryKey: ["client-invoices", id, projectIds],
    queryFn: async () => {
      if (!id || clientProjects.length === 0) return { totalAmount: 0, paidAmount: 0, pendingAmount: 0, count: 0 };
      const projectIds = clientProjects.map((p) => p.id);
      const { data, error } = await supabase
        .from("project_invoices")
        .select("amount, status, paid_at")
        .in("project_id", projectIds);
      if (error) throw error;
      const invoices = data ?? [];
      const totalAmount = invoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const paidAmount = invoices
        .filter((i) => i.status === "paid" || i.paid_at)
        .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      return {
        totalAmount,
        paidAmount,
        pendingAmount: totalAmount - paidAmount,
        count: invoices.length,
      };
    },
    enabled: !!id && clientProjects.length > 0,
  });

  const { data: activityLogs = [] } = useQuery({
    queryKey: ["client-activity", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, action, resource_type, resource_id, details, created_at, user_id")
        .eq("resource_type", "client")
        .eq("resource_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const logs = (data ?? []) as { id: string; action: string; user_id: string; created_at: string; details: unknown }[];
      if (logs.length === 0) return [];
      const userIds = [...new Set(logs.map((l) => l.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      const profileBy = new Map((profiles ?? []).map((p) => [p.id, p]));
      return logs.map((log) => ({
        ...log,
        user_name: profileBy.get(log.user_id)?.full_name ?? profileBy.get(log.user_id)?.email ?? "Unknown",
      }));
    },
    enabled: !!id,
  });

  const handleDelete = async () => {
    if (id) {
      await deleteClient.mutateAsync(id);
      navigate("/clients");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Client not found</p>
        <Button onClick={() => navigate("/clients")}>Back to Clients</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/clients")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
            <p className="text-muted-foreground">Client Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/clients/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Client</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {client.name}? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Data Source */}
      <DataSourceBadge
        dataSource={(client as any).data_source}
        externalUrl={(client as any).external_url}
        lastSyncedAt={(client as any).last_synced_at}
        variant="card"
      />

      {/* Client Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Primary contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Email</p>
                <a
                  href={`mailto:${client.email}`}
                  className="text-sm text-primary hover:underline"
                >
                  {client.email}
                </a>
              </div>
            </div>

            {client.phone && (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Phone</p>
                  <a
                    href={`tel:${client.phone}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {client.phone}
                  </a>
                </div>
              </div>
            )}

            {client.company && (
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Company</p>
                  <p className="text-sm text-muted-foreground">{client.company}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
            <CardDescription>Record details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(client as { status?: string | null }).status && (
              <div>
                <p className="text-sm font-medium">Status</p>
                <Badge variant="secondary" className="mt-1">
                  {(client as { status: string }).status}
                </Badge>
              </div>
            )}
            <div>
              <p className="text-sm font-medium">Created</p>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(client.created_at)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Last Updated</p>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(client.updated_at)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {client.metadata && typeof client.metadata === 'object' && 'notes' in client.metadata && client.metadata.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Additional information about this client</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{String(client.metadata.notes)}</p>
          </CardContent>
        </Card>
      )}

      {/* Related Data summary */}
      <Card>
        <CardHeader>
          <CardTitle>Related Data</CardTitle>
          <CardDescription>Overview of meetings, projects, deals, and invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="rounded-lg border p-4">
              <p className="text-2xl font-bold">{linkedMeetings.length}</p>
              <p className="text-sm text-muted-foreground">Meetings</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-2xl font-bold">{clientProjects.length}</p>
              <p className="text-sm text-muted-foreground">Projects</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-2xl font-bold">{clientDeals.length}</p>
              <p className="text-sm text-muted-foreground">Deals</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-2xl font-bold">{invoiceSummary?.count ?? 0}</p>
              <p className="text-sm text-muted-foreground">Invoices</p>
            </div>
          </div>
          {linkedMeetings.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Recent Meetings</p>
              {linkedMeetings.slice(0, 5).map((item) => item.meeting && (
                <div key={item.id} className="flex items-center justify-between rounded-md border p-3 cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/meetings/${item.meeting!.id}`)}>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{item.meeting.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.meeting.scheduled_at ? new Date(item.meeting.scheduled_at).toLocaleDateString() : "\u2014"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projects */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-muted-foreground" />
                Projects
              </CardTitle>
              <CardDescription>Projects linked to this client</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/projects">View all</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {clientProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            <ul className="space-y-2">
              {clientProjects.slice(0, 10).map((project) => (
                <li key={project.id}>
                  <div
                    className="flex items-center justify-between rounded-md border p-3 cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/projects/${project.slug}`)}
                  >
                    <span className="text-sm font-medium">{project.name}</span>
                    <div className="flex items-center gap-2">
                      {project.end_date && (
                        <span className="text-xs text-muted-foreground">
                          End {formatDate(project.end_date)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {project.budget != null ? formatCurrency(project.budget, project.currency) : "\u2014"}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Deals */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Handshake className="h-5 w-5 text-muted-foreground" />
                Deals
              </CardTitle>
              <CardDescription>Deals pipeline for this client</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/deals">View all</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {clientDeals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deals yet.</p>
          ) : (
            <ul className="space-y-2">
              {clientDeals.slice(0, 10).map((deal) => (
                <li key={deal.id}>
                  <div
                    className="flex items-center justify-between rounded-md border p-3 cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/deals/${deal.slug}`)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{deal.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {deal.stage}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {deal.value != null ? formatCurrency(deal.value, deal.currency) : "\u2014"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Invoices summary */}
      {(invoiceSummary && invoiceSummary.count > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              Invoices Summary
            </CardTitle>
            <CardDescription>Totals from project invoices for this client</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{formatCurrency(invoiceSummary.totalAmount)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-muted-foreground">Paid</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(invoiceSummary.paidAmount)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-xl font-bold">{formatCurrency(invoiceSummary.pendingAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            Activity History
          </CardTitle>
          <CardDescription>Recent activity for this client</CardDescription>
        </CardHeader>
        <CardContent>
          {activityLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {activityLogs.map((log) => (
                <li key={log.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{log.action}</Badge>
                    <span className="text-muted-foreground">{log.user_name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
