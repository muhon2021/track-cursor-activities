/**
 * Contacts Page - List and manage contacts with lead follow-up status
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Users, Loader2, Mail, Phone, Building2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw } from "lucide-react";
import { useContacts, useCreateContact } from "../hooks/useContacts";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { CrmConnectionBanner } from "@/components/common/CrmConnectionBanner";
import { EmailIntegrationBanner } from "@/components/common/EmailIntegrationBanner";
import { useSyncCrmData } from "@/hooks/useIntegrationSync";
import { useCRMIntegrationDisplay } from "@/hooks/useCRMIntegrationDisplay";
import { useCrmSync } from "@/hooks/useCrmSync";
import { isCrmSyncProvider } from "@/lib/integration-preferences";
import type { Contact } from "../types";

const PAGE_SIZES = [10, 25, 50, 100];

const FOLLOWUP_COLORS: Record<string, string> = {
  new: "#6b7280",
  contacted: "#3b82f6",
  interested: "#22c55e",
  not_interested: "#ef4444",
  converted: "#8b5cf6",
  dormant: "#f59e0b",
};

export default function ContactsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const { data: contacts = [], isLoading } = useContacts(search || undefined);
  const createContact = useCreateContact();
  const syncZohoContacts = useSyncCrmData("zoho-crm", "contacts");
  const { showOnContacts, primarySlug, destinations } = useCRMIntegrationDisplay();
  const crmSync = useCrmSync(primarySlug ?? "", destinations);
  const useUnifiedCrmSync =
    showOnContacts && !!primarySlug && isCrmSyncProvider(primarySlug);

  const totalCount = contacts.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedContacts = useMemo(
    () => contacts.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [contacts, currentPage, pageSize]
  );
  const from = totalCount === 0 ? 0 : currentPage * pageSize + 1;
  const to = Math.min((currentPage + 1) * pageSize, totalCount);

  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", company: "", title: "" });

  const handleCreate = () => {
    if (!form.first_name.trim()) return;
    createContact.mutate(form, {
      onSuccess: () => {
        setForm({ first_name: "", last_name: "", email: "", phone: "", company: "", title: "" });
        setDialogOpen(false);
      },
    });
  };

  const contactStats = {
    total: contacts.length,
    withFollowup: contacts.filter((c) => c.followup).length,
    withEmail: contacts.filter((c) => c.email).length,
  };

  return (
    <div className="space-y-6">
      <CrmConnectionBanner />
      <EmailIntegrationBanner page="contacts" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">Synced from your CRM and tools</p>
        </div>
        <div className="flex items-center gap-2">
          {(useUnifiedCrmSync || !primarySlug) && (
            <Button
              variant="outline"
              size="sm"
              disabled={useUnifiedCrmSync ? crmSync.isPending : syncZohoContacts.isPending}
              onClick={() =>
                useUnifiedCrmSync
                  ? crmSync.mutate({
                      providerSlug: primarySlug!,
                      destinations: ["contacts"],
                    })
                  : syncZohoContacts.mutate(undefined)
              }
            >
              {(useUnifiedCrmSync ? crmSync.isPending : syncZohoContacts.isPending) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {useUnifiedCrmSync ? `Sync ${primarySlug === "zoho-crm" ? "Zoho" : primarySlug}` : "Sync from Zoho"}
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Add Manually</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First Name *</Label>
                  <Input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Company</Label>
                  <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
                </div>
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={!form.first_name.trim() || createContact.isPending}>
                {createContact.isPending ? "Creating..." : "Create Contact"}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
          <Button asChild>
            <a href="/admin/integrations">Sync from CRM</a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><p className="text-sm text-muted-foreground">Total Contacts</p></div>
            <p className="text-2xl font-bold mt-1">{contactStats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><p className="text-sm text-muted-foreground">With Email</p></div>
            <p className="text-2xl font-bold mt-1">{contactStats.withEmail}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><p className="text-sm text-muted-foreground">Active Follow-ups</p></div>
            <p className="text-2xl font-bold mt-1">{contactStats.withFollowup}</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">No contacts found</p>
        </div>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Lead Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedContacts.map((contact) => (
                <TableRow key={contact.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/contacts/${contact.id}`)}>
                  <TableCell>
                    <p className="font-medium">{contact.first_name} {contact.last_name || ""}</p>
                    {contact.title && <p className="text-xs text-muted-foreground">{contact.title}</p>}
                  </TableCell>
                  <TableCell>
                    {contact.company ? (
                      <span className="flex items-center gap-1 text-sm"><Building2 className="h-3 w-3" />{contact.company}</span>
                    ) : <span className="text-sm text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {contact.email ? <span className="text-sm">{contact.email}</span> : <span className="text-sm text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {contact.phone ? <span className="text-sm">{contact.phone}</span> : <span className="text-sm text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <DataSourceBadge
                      dataSource={(contact as any).data_source}
                      externalUrl={(contact as any).external_url}
                      lastSyncedAt={(contact as any).last_synced_at}
                    />
                  </TableCell>
                  <TableCell>
                    {contact.followup ? (
                      <Badge variant="outline" style={{ borderColor: FOLLOWUP_COLORS[contact.followup.status], color: FOLLOWUP_COLORS[contact.followup.status] }}>
                        {contact.followup.status.replace("_", " ")}
                      </Badge>
                    ) : <span className="text-xs text-muted-foreground">No follow-up</span>}
                  </TableCell>
                </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Showing {from} to {to} of {totalCount} results</span>
              <span className="text-muted-foreground/70">·</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setCurrentPage(0);
                }}
              >
                <SelectTrigger className="w-[110px] h-8 bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s} per page</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-md"
                disabled={currentPage <= 0}
                onClick={() => setCurrentPage(0)}
                aria-label="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-md"
                disabled={currentPage <= 0}
                onClick={() => setCurrentPage((p) => p - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center gap-1 px-2 text-sm">
                <span className="font-medium">{currentPage + 1}</span>
                <span className="text-muted-foreground">of {totalPages}</span>
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-md"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage((p) => p + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-md"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage(totalPages - 1)}
                aria-label="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
