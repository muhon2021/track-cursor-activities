/**
 * Deal Form Page - Create and edit deals
 * Matches reference: Create New Deal with tabs (Basic Info, Deal Details, URLs & Links, Advanced)
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, X, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDeal, useCreateDeal, useUpdateDeal } from "../hooks/useDeals";
import { useClients } from "@/hooks/useClients";
import { useContacts } from "../hooks/useContacts";
import type { DealFormData, DealStage } from "../types";

const STAGES: { value: DealStage; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "discovery", label: "Discovery" },
  { value: "qualified", label: "Qualified" },
  { value: "estimation", label: "Estimation" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const DEAL_TYPES = [
  { value: "new_business", label: "New Business" },
  { value: "renewal", label: "Renewal" },
  { value: "upsell", label: "Upsell" },
  { value: "other", label: "Other" },
];

const CATEGORIES = [
  { value: "services", label: "Services" },
  { value: "product", label: "Product" },
  { value: "license", label: "License" },
  { value: "subscription", label: "Subscription" },
  { value: "other", label: "Other" },
];

const LEAD_SOURCES = [
  { value: "Referral", label: "Referral" },
  { value: "Website", label: "Website" },
  { value: "Cold outreach", label: "Cold outreach" },
  { value: "Event", label: "Event" },
  { value: "Other", label: "Other" },
];

const POD_OPTIONS = [
  { value: "POD A", label: "POD A" },
  { value: "POD B", label: "POD B" },
  { value: "POD C", label: "POD C" },
];

const URL_LINK_KEYS = [
  "estimate_url",
  "internal_estimate_doc_url",
  "client_estimate_doc_url",
  "pandadoc_proposal_url",
  "hubspot_deal_url",
  "leadslift_crm_deal_url",
  "google_drive_folder_url",
  "workboard_ai_link",
  "collaborative_ai_link",
  "client_agent_folder",
] as const;

const initialUrlLinks: Record<(typeof URL_LINK_KEYS)[number], string> = {
  estimate_url: "",
  internal_estimate_doc_url: "",
  client_estimate_doc_url: "",
  pandadoc_proposal_url: "",
  hubspot_deal_url: "",
  leadslift_crm_deal_url: "",
  google_drive_folder_url: "",
  workboard_ai_link: "",
  collaborative_ai_link: "",
  client_agent_folder: "",
};

const ADVANCED_KEYS = [
  "company_name",
  "client_email",
  "contact_first_name",
  "contact_last_name",
  "contact_phone",
  "website",
  "linkedin_profile",
  "hubspot_deal_id",
  "hubspot_owner_id",
  "type_of_work",
] as const;

const initialAdvanced: Record<(typeof ADVANCED_KEYS)[number], string> = {
  company_name: "",
  client_email: "",
  contact_first_name: "",
  contact_last_name: "",
  contact_phone: "",
  website: "",
  linkedin_profile: "",
  hubspot_deal_id: "",
  hubspot_owner_id: "",
  type_of_work: "",
};

const TYPE_OF_WORK_OPTIONS = [
  { value: "consulting", label: "Consulting" },
  { value: "development", label: "Development" },
  { value: "design", label: "Design" },
  { value: "support", label: "Support" },
  { value: "other", label: "Other" },
];

export default function DealFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isEdit = !!slug;

  const { data: existingDeal, isLoading: loadingDeal } = useDeal(slug || "");
  const { data: clients = [] } = useClients();
  const { data: contacts = [] } = useContacts();
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return (data || []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();

  const [form, setForm] = useState<DealFormData>({
    title: "",
    description: "",
    stage: "lead",
    value: undefined,
    probability: 50,
    client_id: undefined,
    contact_id: undefined,
    owner_id: undefined,
    expected_close_date: undefined,
    source: "",
    tags: [],
    deal_type: undefined,
    category: undefined,
    pipeline: "Sales pipeline",
    assigned_pod: undefined,
    next_step: undefined,
  });
  const [tagInput, setTagInput] = useState("");
  const [urlLinks, setUrlLinks] = useState<Record<(typeof URL_LINK_KEYS)[number], string>>(initialUrlLinks);
  const [advanced, setAdvanced] = useState<Record<(typeof ADVANCED_KEYS)[number], string>>(initialAdvanced);

  useEffect(() => {
    if (existingDeal && isEdit) {
      const meta = (existingDeal as any).metadata as Record<string, unknown> | null;
      setForm({
        title: existingDeal.title,
        description: existingDeal.description || "",
        stage: existingDeal.stage,
        value: existingDeal.value || undefined,
        probability: existingDeal.probability ?? 50,
        client_id: existingDeal.client_id || undefined,
        contact_id: existingDeal.contact_id || undefined,
        owner_id: existingDeal.owner_id || undefined,
        expected_close_date: existingDeal.expected_close_date || undefined,
        source: existingDeal.source || "",
        tags: existingDeal.tags || [],
        deal_type: (meta?.deal_type as string) || undefined,
        category: (meta?.category as string) || undefined,
        pipeline: (meta?.pipeline as string) || "Sales pipeline",
        assigned_pod: (meta?.assigned_pod as string) || undefined,
        next_step: (meta?.next_step as string) || undefined,
      });
      const nextUrls = { ...initialUrlLinks };
      for (const k of URL_LINK_KEYS) {
        const v = meta?.[k];
        if (typeof v === "string") nextUrls[k] = v;
      }
      setUrlLinks(nextUrls);
      const nextAdvanced = { ...initialAdvanced };
      for (const k of ADVANCED_KEYS) {
        const v = meta?.[k];
        if (typeof v === "string") nextAdvanced[k] = v;
      }
      setAdvanced(nextAdvanced);
    }
  }, [existingDeal, isEdit]);

  const set = (field: keyof DealFormData, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !(form.tags || []).includes(tag)) {
      set("tags", [...(form.tags || []), tag]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    set("tags", (form.tags || []).filter((t) => t !== tag));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const payload = { ...form, ...urlLinks, ...advanced };
    if (isEdit && existingDeal) {
      updateDeal.mutate(
        { id: existingDeal.id, data: payload },
        { onSuccess: () => navigate(`/deals/${slug}`) }
      );
    } else {
      createDeal.mutate(payload, {
        onSuccess: (deal: any) => navigate(`/deals/${deal.slug}`),
      });
    }
  };

  const isPending = createDeal.isPending || updateDeal.isPending;

  if (isEdit && loadingDeal) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(isEdit ? `/deals/${slug}` : "/deals")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-primary">
            {isEdit ? "Edit Deal" : "Create New Deal"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEdit ? "Update the business opportunity." : "Add a new business opportunity to the pipeline."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="details">Deal Details</TabsTrigger>
                <TabsTrigger value="urls">URLs & Links</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              {/* Basic Info */}
              <TabsContent value="basic" className="space-y-4 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title">Deal Name *</Label>
                      <Input
                        id="title"
                        value={form.title}
                        onChange={(e) => set("title", e.target.value)}
                        placeholder="Enter deal name"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>Client *</Label>
                      <Select
                        value={form.client_id || "__none__"}
                        onValueChange={(v) => set("client_id", v === "__none__" ? undefined : v)}
                      >
                        <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select client..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Select client...</SelectItem>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Stage *</Label>
                      <Select value={form.stage || "lead"} onValueChange={(v) => set("stage", v)}>
                        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STAGES.filter((s) => !["won", "lost"].includes(s.value)).map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Deal Type</Label>
                      <Select
                        value={form.deal_type || ""}
                        onValueChange={(v) => set("deal_type", v || undefined)}
                      >
                        <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          {DEAL_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Deal Owner *</Label>
                      <Select
                        value={form.owner_id || "__none__"}
                        onValueChange={(v) => set("owner_id", v === "__none__" ? undefined : v)}
                      >
                        <SelectTrigger className="mt-1.5"><SelectValue placeholder="Owner name" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Owner name</SelectItem>
                          {profiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.full_name || p.email || "Unknown"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Contact</Label>
                      <Select
                        value={form.contact_id || "none"}
                        onValueChange={(v) => set("contact_id", v === "none" ? undefined : v)}
                      >
                        <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select contact" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No contact</SelectItem>
                          {contacts.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.first_name} {c.last_name || ""}{c.company ? ` (${c.company})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="value">Deal Value ($) *</Label>
                      <Input
                        id="value"
                        type="number"
                        min={0}
                        value={form.value ?? ""}
                        onChange={(e) => set("value", e.target.value ? Number(e.target.value) : undefined)}
                        placeholder="0"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="probability">Probability (%)</Label>
                      <Input
                        id="probability"
                        type="number"
                        min={0}
                        max={100}
                        value={form.probability ?? ""}
                        onChange={(e) => set("probability", e.target.value ? Number(e.target.value) : 50)}
                        placeholder="50"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select
                        value={form.category || ""}
                        onValueChange={(v) => set("category", v || undefined)}
                      >
                        <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="close_date">Expected Close Date</Label>
                      <div className="relative mt-1.5">
                        <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="close_date"
                          type="date"
                          value={form.expected_close_date || ""}
                          onChange={(e) => set("expected_close_date", e.target.value || undefined)}
                          placeholder="dd-mm-yyyy"
                          className="pr-9"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4 mt-4">
                  <Label>Tags</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                      placeholder="Add tag and press Enter"
                      className="flex-1 max-w-xs"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
                  </div>
                  {(form.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(form.tags || []).map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <button type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Deal Details */}
              <TabsContent value="details" className="space-y-4 mt-0">
                <div className="space-y-2">
                  <Label htmlFor="description">Deal Description</Label>
                  <Textarea
                    id="description"
                    value={form.description || ""}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="Detailed description of the deal..."
                    rows={4}
                    className="mt-1.5 resize-y"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Lead Source</Label>
                    <Select
                      value={form.source || "_none"}
                      onValueChange={(v) => set("source", v === "_none" ? "" : v)}
                    >
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select source" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Select source</SelectItem>
                        {LEAD_SOURCES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Pipeline</Label>
                    <Input
                      value={form.pipeline ?? "Sales pipeline"}
                      onChange={(e) => set("pipeline", e.target.value)}
                      placeholder="Sales pipeline"
                      className="mt-1.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Assigned POD</Label>
                    <Select
                      value={form.assigned_pod || "_none"}
                      onValueChange={(v) => set("assigned_pod", v === "_none" ? undefined : v)}
                    >
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select POD" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Select POD</SelectItem>
                        {POD_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Next Step</Label>
                    <Input
                      value={form.next_step ?? ""}
                      onChange={(e) => set("next_step", e.target.value || undefined)}
                      placeholder="What's next?"
                      className="mt-1.5"
                    />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <Label>Close Date</Label>
                    <div className="relative mt-1.5">
                      <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        type="date"
                        value={form.expected_close_date || ""}
                        onChange={(e) => set("expected_close_date", e.target.value || undefined)}
                        placeholder="dd-mm-yyyy"
                        className="pr-9 w-full min-w-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <Label>Create Date</Label>
                    <div className="relative mt-1.5">
                      <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        type="text"
                        readOnly
                        value={existingDeal?.created_at ? new Date(existingDeal.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""}
                        placeholder="—"
                        className="pr-9 w-full min-w-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Potential Amount</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={form.value ?? ""}
                      onChange={(e) => set("value", e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="0"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* URLs & Links */}
              <TabsContent value="urls" className="space-y-6 mt-0">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground">Estimate Documents</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="estimate_url">Estimate URL</Label>
                      <Input
                        id="estimate_url"
                        value={urlLinks.estimate_url}
                        onChange={(e) => setUrlLinks((u) => ({ ...u, estimate_url: e.target.value }))}
                        placeholder="https://"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="internal_estimate_doc_url">Internal Estimate Doc URL</Label>
                      <Input
                        id="internal_estimate_doc_url"
                        value={urlLinks.internal_estimate_doc_url}
                        onChange={(e) => setUrlLinks((u) => ({ ...u, internal_estimate_doc_url: e.target.value }))}
                        placeholder="https://"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="client_estimate_doc_url">Client Estimate Doc URL</Label>
                      <Input
                        id="client_estimate_doc_url"
                        value={urlLinks.client_estimate_doc_url}
                        onChange={(e) => setUrlLinks((u) => ({ ...u, client_estimate_doc_url: e.target.value }))}
                        placeholder="https://"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground">Proposals & CRM</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pandadoc_proposal_url">PandaDoc Proposal URL</Label>
                      <Input
                        id="pandadoc_proposal_url"
                        value={urlLinks.pandadoc_proposal_url}
                        onChange={(e) => setUrlLinks((u) => ({ ...u, pandadoc_proposal_url: e.target.value }))}
                        placeholder="https://"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hubspot_deal_url">HubSpot Deal URL</Label>
                      <Input
                        id="hubspot_deal_url"
                        value={urlLinks.hubspot_deal_url}
                        onChange={(e) => setUrlLinks((u) => ({ ...u, hubspot_deal_url: e.target.value }))}
                        placeholder="https://"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="leadslift_crm_deal_url">LeadsLift CRM Deal URL</Label>
                      <Input
                        id="leadslift_crm_deal_url"
                        value={urlLinks.leadslift_crm_deal_url}
                        onChange={(e) => setUrlLinks((u) => ({ ...u, leadslift_crm_deal_url: e.target.value }))}
                        placeholder="https://"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground">Collaboration & Files</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="google_drive_folder_url">Google Drive Folder URL</Label>
                      <Input
                        id="google_drive_folder_url"
                        value={urlLinks.google_drive_folder_url}
                        onChange={(e) => setUrlLinks((u) => ({ ...u, google_drive_folder_url: e.target.value }))}
                        placeholder="https://"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="workboard_ai_link">WorkBoard AI Link</Label>
                      <Input
                        id="workboard_ai_link"
                        value={urlLinks.workboard_ai_link}
                        onChange={(e) => setUrlLinks((u) => ({ ...u, workboard_ai_link: e.target.value }))}
                        placeholder="https://"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="collaborative_ai_link">Collaborative AI Link</Label>
                      <Input
                        id="collaborative_ai_link"
                        value={urlLinks.collaborative_ai_link}
                        onChange={(e) => setUrlLinks((u) => ({ ...u, collaborative_ai_link: e.target.value }))}
                        placeholder="https://"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client_agent_folder">Client Agent Folder</Label>
                      <Input
                        id="client_agent_folder"
                        value={urlLinks.client_agent_folder}
                        onChange={(e) => setUrlLinks((u) => ({ ...u, client_agent_folder: e.target.value }))}
                        placeholder="Folder path or URL"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Advanced */}
              <TabsContent value="advanced" className="space-y-6 mt-0">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground">Client Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company_name">Company Name</Label>
                      <Input
                        id="company_name"
                        value={advanced.company_name}
                        onChange={(e) => setAdvanced((a) => ({ ...a, company_name: e.target.value }))}
                        placeholder="Company name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client_email">Client Email</Label>
                      <Input
                        id="client_email"
                        type="email"
                        value={advanced.client_email}
                        onChange={(e) => setAdvanced((a) => ({ ...a, client_email: e.target.value }))}
                        placeholder="email@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact_first_name">First Name</Label>
                      <Input
                        id="contact_first_name"
                        value={advanced.contact_first_name}
                        onChange={(e) => setAdvanced((a) => ({ ...a, contact_first_name: e.target.value }))}
                        placeholder="First name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact_last_name">Last Name</Label>
                      <Input
                        id="contact_last_name"
                        value={advanced.contact_last_name}
                        onChange={(e) => setAdvanced((a) => ({ ...a, contact_last_name: e.target.value }))}
                        placeholder="Last name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact_phone">Phone</Label>
                      <Input
                        id="contact_phone"
                        value={advanced.contact_phone}
                        onChange={(e) => setAdvanced((a) => ({ ...a, contact_phone: e.target.value }))}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        value={advanced.website}
                        onChange={(e) => setAdvanced((a) => ({ ...a, website: e.target.value }))}
                        placeholder="https://"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin_profile">LinkedIn Profile</Label>
                    <Input
                      id="linkedin_profile"
                      value={advanced.linkedin_profile}
                      onChange={(e) => setAdvanced((a) => ({ ...a, linkedin_profile: e.target.value }))}
                      placeholder="https://linkedin.com/in/"
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground">HubSpot Integration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hubspot_deal_id">HubSpot Deal ID</Label>
                      <Input
                        id="hubspot_deal_id"
                        value={advanced.hubspot_deal_id}
                        onChange={(e) => setAdvanced((a) => ({ ...a, hubspot_deal_id: e.target.value }))}
                        placeholder="Deal ID"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hubspot_owner_id">HubSpot Owner ID</Label>
                      <Input
                        id="hubspot_owner_id"
                        value={advanced.hubspot_owner_id}
                        onChange={(e) => setAdvanced((a) => ({ ...a, hubspot_owner_id: e.target.value }))}
                        placeholder="Owner ID"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground">Additional Information</h3>
                  <div className="space-y-2">
                    <Label>Type of Work</Label>
                    <Select
                      value={advanced.type_of_work || "_none"}
                      onValueChange={(v) => setAdvanced((a) => ({ ...a, type_of_work: v === "_none" ? "" : v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select type of work" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Select type of work</SelectItem>
                        {TYPE_OF_WORK_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-6 mt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(isEdit ? `/deals/${slug}` : "/deals")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!form.title.trim() || isPending}>
                {isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isEdit ? "Saving..." : "Creating..."}</>
                ) : (
                  isEdit ? "Save Changes" : "Create Deal"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
