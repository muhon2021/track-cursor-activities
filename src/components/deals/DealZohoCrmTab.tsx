/**
 * Zoho CRM sub-tabs for deals linked with external_id zoho-deal-*
 */

import { useState } from "react";
import { Loader2, RefreshCw, FileText, ListTree, Calendar, User, Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useZohoDealAttachments,
  useZohoDealEngagements,
  useZohoDealEvents,
  useZohoContactEnrichment,
  useZohoAccountEnrichment,
  useRefreshZohoDealAttachments,
  useRefreshZohoDealEngagements,
  useRefreshZohoDealEvents,
  useRefreshZohoContactEnrichment,
  useRefreshZohoAccountEnrichment,
} from "@/hooks/useZohoDealTabs";

interface DealZohoCrmTabProps {
  dealId: string;
  dealExternalId: string | null | undefined;
}

export function DealZohoCrmTab({ dealId, dealExternalId }: DealZohoCrmTabProps) {
  const [sub, setSub] = useState("attachments");

  const attachments = useZohoDealAttachments(dealId, dealExternalId);
  const engagements = useZohoDealEngagements(dealId, dealExternalId);
  const events = useZohoDealEvents(dealId, dealExternalId);
  const contactEnr = useZohoContactEnrichment(dealId, dealExternalId);
  const accountEnr = useZohoAccountEnrichment(dealId, dealExternalId);

  const refAttachments = useRefreshZohoDealAttachments(dealId);
  const refEngagements = useRefreshZohoDealEngagements(dealId);
  const refEvents = useRefreshZohoDealEvents(dealId);
  const refContact = useRefreshZohoContactEnrichment(dealId);
  const refAccount = useRefreshZohoAccountEnrichment(dealId);

  const busy =
    refAttachments.isPending ||
    refEngagements.isPending ||
    refEvents.isPending ||
    refContact.isPending ||
    refAccount.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Zoho CRM</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            void refAttachments.mutateAsync();
            void refEngagements.mutateAsync();
            void refEvents.mutateAsync();
            void refContact.mutateAsync();
            void refAccount.mutateAsync();
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Refresh all
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={sub} onValueChange={setSub}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="attachments" className="gap-1">
              <FileText className="h-3.5 w-3.5" />
              Files
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1">
              <ListTree className="h-3.5 w-3.5" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Events
            </TabsTrigger>
            <TabsTrigger value="research" className="gap-1">
              <User className="h-3.5 w-3.5" />
              Profiles
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attachments" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" disabled={refAttachments.isPending} onClick={() => refAttachments.mutate()}>
                {refAttachments.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
            {attachments.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : attachments.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No attachments cached. Use refresh to pull from Zoho.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {attachments.data?.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
                    <span className="font-medium truncate">{a.file_name || a.zoho_attachment_id}</span>
                    {a.size_bytes != null && <span className="text-muted-foreground shrink-0">{a.size_bytes} B</span>}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" disabled={refEngagements.isPending} onClick={() => refEngagements.mutate()}>
                {refEngagements.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
            {engagements.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : engagements.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No notes or calls cached.</p>
            ) : (
              <ul className="space-y-2">
                {engagements.data?.map((e) => (
                  <li key={e.id} className="border rounded-md px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">{e.zoho_module}</Badge>
                      <span className="text-xs text-muted-foreground">{e.occurred_at ? new Date(e.occurred_at).toLocaleString() : "—"}</span>
                    </div>
                    <p className="font-medium">{e.title}</p>
                    {e.content && <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{e.content}</p>}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="events" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" disabled={refEvents.isPending} onClick={() => refEvents.mutate()}>
                {refEvents.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
            {events.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : events.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No related events in Zoho for this deal.</p>
            ) : (
              <ul className="space-y-2">
                {events.data?.map((ev) => (
                  <li key={ev.id} className="border rounded-md px-3 py-2 text-sm flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium">{ev.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ev.start_at ? new Date(ev.start_at).toLocaleString() : "—"}
                        {ev.end_at ? ` → ${new Date(ev.end_at).toLocaleString()}` : ""}
                      </p>
                      {ev.location && <p className="text-xs text-muted-foreground mt-1">{ev.location}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="research" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" disabled={refContact.isPending} onClick={() => refContact.mutate()}>
                <User className="h-3.5 w-3.5 mr-1" />
                {refContact.isPending ? "…" : "Sync contact"}
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={refAccount.isPending} onClick={() => refAccount.mutate()}>
                <Building2 className="h-3.5 w-3.5 mr-1" />
                {refAccount.isPending ? "…" : "Sync account"}
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium mb-2">Zoho contact</p>
                {contactEnr.isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : !contactEnr.data ? (
                  <p className="text-xs text-muted-foreground">Run sync after a main deal sync populated zoho_contact_id in metadata.</p>
                ) : (
                  <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-auto max-h-72 whitespace-pre-wrap">
                    {JSON.stringify(contactEnr.data.payload, null, 2)}
                  </pre>
                )}
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Zoho account</p>
                {accountEnr.isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : !accountEnr.data ? (
                  <p className="text-xs text-muted-foreground">Requires a linked client with external_id zoho-account-…</p>
                ) : (
                  <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-auto max-h-72 whitespace-pre-wrap">
                    {JSON.stringify(accountEnr.data.payload, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
