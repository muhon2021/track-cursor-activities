import { useMemo, useState, Fragment } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useClients, useDeleteClient, useClientStats, type Client } from "@/hooks/useClients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, Edit, Eye, Users, Briefcase, DollarSign, TrendingUp, Building2, RefreshCw, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { CrmConnectionBanner } from "@/components/common/CrmConnectionBanner";
import { useSyncCrmData } from "@/hooks/useIntegrationSync";
import { useCRMIntegrationDisplay } from "@/hooks/useCRMIntegrationDisplay";
import { useCrmSync } from "@/hooks/useCrmSync";
import { isCrmSyncProvider } from "@/lib/integration-preferences";

const NO_COMPANY_LABEL = "— No company —";

/** Group clients by company key; empty/null company becomes NO_COMPANY_LABEL. */
function groupClientsByCompany(clients: Client[]): Map<string, Client[]> {
  const map = new Map<string, Client[]>();
  for (const c of clients) {
    const key = (c.company?.trim() || "") || NO_COMPANY_LABEL;
    const list = map.get(key) ?? [];
    list.push(c);
    map.set(key, list);
  }
  return map;
}

/** Sort company keys alphabetically, with NO_COMPANY_LABEL last. */
function sortCompanyKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    if (a === NO_COMPANY_LABEL) return 1;
    if (b === NO_COMPANY_LABEL) return -1;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
}

function formatCurrency(value: number): string {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}

export default function Clients() {
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") ?? undefined;
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: clients, totalCount, isLoading } = useClients({
    search,
    sortBy: "company",
    sortOrder: "asc",
    status: statusFilter,
  });
  const { data: stats, isLoading: statsLoading } = useClientStats(statusFilter ?? undefined);
  const deleteClient = useDeleteClient();
  const { showOnClients, primarySlug, destinations } = useCRMIntegrationDisplay();
  const crmSync = useCrmSync(primarySlug ?? "", destinations);
  const syncZohoAccounts = useSyncCrmData("zoho-crm", "accounts");
  const useUnifiedCrmSync =
    showOnClients && !!primarySlug && isCrmSyncProvider(primarySlug);

  const companiesGrouped = useMemo(() => {
    if (!clients?.length) return { keys: [] as string[], map: new Map<string, Client[]>() };
    const map = groupClientsByCompany(clients);
    const keys = sortCompanyKeys([...map.keys()]);
    return { keys, map };
  }, [clients]);

  const handleDelete = () => {
    if (deleteId) {
      deleteClient.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <CrmConnectionBanner />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {statusFilter === "active" ? "Active Companies" : "Companies"}
          </h1>
          <p className="text-muted-foreground">
            Companies and their contacts, sorted alphabetically
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/clients/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Manually
            </Link>
          </Button>
          {(useUnifiedCrmSync || !primarySlug) && (
            <Button
              variant="outline"
              disabled={useUnifiedCrmSync ? crmSync.isPending : syncZohoAccounts.isPending}
              onClick={() =>
                useUnifiedCrmSync
                  ? crmSync.mutate({
                      providerSlug: primarySlug!,
                      destinations: ["clients"],
                    })
                  : syncZohoAccounts.mutate(undefined)
              }
            >
              {(useUnifiedCrmSync ? crmSync.isPending : syncZohoAccounts.isPending) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {useUnifiedCrmSync ? `Sync ${primarySlug === "zoho-crm" ? "Zoho" : primarySlug}` : "Sync from Zoho"}
            </Button>
          )}
          <Button variant="secondary" asChild>
            <Link to="/admin/integrations">Integrations</Link>
          </Button>
        </div>
      </div>

      {/* Metric cards: Total/Active Companies (unique), Active Projects, Lifetime Value, Avg Project Value */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                {statusFilter === "active" ? "Active Companies" : "Total Companies"}
              </p>
              <div className="rounded-lg bg-primary/10 p-2">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {isLoading ? "—" : companiesGrouped.keys.length.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Active Projects</p>
              <div className="rounded-lg bg-primary/10 p-2">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {statsLoading ? "—" : (stats?.activeProjects ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Lifetime Value</p>
              <div className="rounded-lg bg-primary/10 p-2">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {statsLoading ? "—" : formatCurrency(stats?.lifetimeValue ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Companies</CardTitle>
          <CardDescription>
            Find companies or contacts by name, email, or company name
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Companies list: grouped by company, sorted A–Z */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">Loading companies...</p>
            </div>
          ) : companiesGrouped.keys.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2">
              <p className="text-muted-foreground">No companies found</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/clients/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add your first contact
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companiesGrouped.keys.map((companyKey) => {
                  const contacts = companiesGrouped.map.get(companyKey) ?? [];
                  return (
                    <Fragment key={companyKey}>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={7} className="font-semibold py-2">
                          <span className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {companyKey}
                            <span className="text-muted-foreground font-normal text-sm">
                              ({contacts.length} {contacts.length === 1 ? "contact" : "contacts"})
                            </span>
                          </span>
                        </TableCell>
                      </TableRow>
                      {contacts.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium pl-8">{client.name}</TableCell>
                          <TableCell>{client.email ?? "—"}</TableCell>
                          <TableCell>
                            <DataSourceBadge
                              dataSource={client.data_source}
                              externalUrl={client.external_url}
                              lastSyncedAt={client.last_synced_at}
                            />
                          </TableCell>
                          <TableCell className="capitalize">{client.status ?? "—"}</TableCell>
                          <TableCell>{client.phone ?? "—"}</TableCell>
                          <TableCell>{formatDate(client.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" asChild>
                                <Link to={`/clients/${client.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button variant="ghost" size="sm" asChild>
                                <Link to={`/clients/${client.id}/edit`}>
                                  <Edit className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteId(client.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {!isLoading && totalCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {companiesGrouped.keys.length} companies · {totalCount.toLocaleString()} contacts
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this client? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
