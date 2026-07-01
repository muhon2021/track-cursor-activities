/**
 * Deal Detail Page - Tabbed view with activities, comments, meetings, and AI coach
 */

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, DollarSign, Calendar, User, Building2, MessageSquare, Activity, Loader2, ChevronRight, Pencil, Trash2, Video, Plus, Bot, Tag, Send, MoreHorizontal, RefreshCw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDeal, useDealActivities, useDealComments, useAddDealComment, useUpdateDealComment, useDeleteDealComment, useAddDealActivity, useUpdateDealStage, useUpdateDeal, useDeleteDeal } from "../hooks/useDeals";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { useDealMeetings } from "@/modules/meetings/hooks/useCrossModuleMeetings";
import { useAssignMeeting } from "@/modules/meetings/hooks/useMeetingAssignment";
import { DealZohoCrmTab } from "@/components/deals/DealZohoCrmTab";
import { isZohoCrmDealExternalId } from "@/hooks/useZohoDealTabs";
import { useSyncZohoCrmRecord } from "@/hooks/useIntegrationSync";
import type { DealStage, DealActivityType } from "../types";

const STAGE_CONFIG: Record<DealStage, { label: string; color: string }> = {
  lead: { label: "Lead", color: "#6b7280" },
  discovery: { label: "Discovery", color: "#3b82f6" },
  qualified: { label: "Qualified", color: "#2563eb" },
  estimation: { label: "Estimation", color: "#8b5cf6" },
  proposal: { label: "Proposal", color: "#f59e0b" },
  won: { label: "Won", color: "#22c55e" },
  lost: { label: "Lost", color: "#ef4444" },
};

const STAGES: DealStage[] = ["lead", "discovery", "qualified", "estimation", "proposal", "won", "lost"];

const ACTIVITY_TYPES: { value: DealActivityType; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "task", label: "Task" },
];

export default function DealDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");

  // Lost reason dialog state
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [pendingLostDealId, setPendingLostDealId] = useState<string | null>(null);

  // Activity creation state
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityType, setActivityType] = useState<DealActivityType>("note");
  const [activityContent, setActivityContent] = useState("");

  // Link meeting dialog state
  const [linkMeetingDialogOpen, setLinkMeetingDialogOpen] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState("");

  // AI Coach state
  const [coachQuery, setCoachQuery] = useState("");
  const [coachResponse, setCoachResponse] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);

  const { data: deal, isLoading } = useDeal(slug!);
  const { data: activities = [] } = useDealActivities(deal?.id || "");
  const { data: comments = [] } = useDealComments(deal?.id || "");
  const addComment = useAddDealComment();
  const updateComment = useUpdateDealComment();
  const deleteComment = useDeleteDealComment();
  const addActivity = useAddDealActivity();
  const updateStage = useUpdateDealStage();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const assignMeeting = useAssignMeeting();
  const { data: linkedMeetings = [] } = useDealMeetings(deal?.id);
  const syncZohoRecord = useSyncZohoCrmRecord();

  const zohoPullMatch = deal?.external_id?.match(/^zoho-(deal|lead)-(.+)$/);

  // Fetch available meetings for linking
  const { data: availableMeetings = [] } = useQuery({
    queryKey: ["meetings", "for-linking"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meetings").select("id, title, scheduled_at").order("scheduled_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as { id: string; title: string; scheduled_at: string | null }[];
    },
    enabled: linkMeetingDialogOpen,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!deal) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">Deal not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/deals")}>Back to Deals</Button>
      </div>
    );
  }

  const currentStageIdx = STAGES.indexOf(deal.stage);

  const handleStageClick = (stage: DealStage) => {
    if (stage === deal.stage) return;
    if (stage === "lost") {
      setPendingLostDealId(deal.id);
      setLostReason("");
      setLostDialogOpen(true);
      return;
    }
    updateStage.mutate({ id: deal.id, stage, fromStage: deal.stage });
  };

  const handleConfirmLost = () => {
    if (pendingLostDealId) {
      updateDeal.mutate({ id: pendingLostDealId, data: { stage: "lost", lost_reason: lostReason || undefined } });
      updateStage.mutate({ id: pendingLostDealId, stage: "lost", fromStage: deal.stage });
    }
    setLostDialogOpen(false);
    setPendingLostDealId(null);
  };

  const handleSubmitComment = () => {
    if (!newComment.trim()) return;
    addComment.mutate({ dealId: deal.id, content: newComment.trim() });
    setNewComment("");
  };

  const handleSaveEditComment = () => {
    if (!editingCommentId || !editingCommentContent.trim()) return;
    updateComment.mutate({ id: editingCommentId, dealId: deal.id, content: editingCommentContent.trim() });
    setEditingCommentId(null);
    setEditingCommentContent("");
  };

  const handleSubmitActivity = () => {
    if (!activityContent.trim()) return;
    addActivity.mutate({ dealId: deal.id, activityType, content: activityContent.trim() });
    setActivityContent("");
    setActivityDialogOpen(false);
  };

  const handleLinkMeeting = () => {
    if (!selectedMeetingId) return;
    assignMeeting.mutate({ meetingId: selectedMeetingId, entityType: "deal" as any, entityId: deal.id });
    setSelectedMeetingId("");
    setLinkMeetingDialogOpen(false);
  };

  const handleAskCoach = async () => {
    if (!coachQuery.trim()) return;
    setCoachLoading(true);
    setCoachResponse("");
    try {
      const { data, error } = await supabase.functions.invoke("deal-coach", {
        body: { deal_id: deal.id, question: coachQuery },
      });
      if (error) throw error;
      setCoachResponse(data?.response || "No response from coach.");
    } catch (err: any) {
      setCoachResponse(`Error: ${err.message || "Failed to get coaching response"}`);
    } finally {
      setCoachLoading(false);
    }
  };

  // Filter out already-linked meetings
  const linkedMeetingIds = new Set(linkedMeetings.map((m) => m.meeting_id));
  const unlinkableMeetings = availableMeetings.filter((m) => !linkedMeetingIds.has(m.id));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/deals")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{deal.title}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge style={{ backgroundColor: `${STAGE_CONFIG[deal.stage]?.color}20`, color: STAGE_CONFIG[deal.stage]?.color, borderColor: STAGE_CONFIG[deal.stage]?.color }} variant="outline">
              {STAGE_CONFIG[deal.stage]?.label}
            </Badge>
            {deal.client && <span className="text-sm text-muted-foreground">{deal.client.name}</span>}
            {(deal.tags || []).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs"><Tag className="h-3 w-3 mr-1" />{tag}</Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {zohoPullMatch && (
            <Button
              variant="outline"
              size="sm"
              disabled={syncZohoRecord.isPending}
              onClick={() =>
                syncZohoRecord.mutate({
                  resource: zohoPullMatch[1] === "lead" ? "leads" : "deals",
                  recordId: zohoPullMatch[2],
                })
              }
            >
              {syncZohoRecord.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Pull from Zoho
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate(`/deals/${slug}/edit`)}>
            <Pencil className="h-4 w-4 mr-1" />Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" />Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete deal?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete "{deal.title}" and all associated activities and comments.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteDeal.mutate(deal.id, { onSuccess: () => navigate("/deals") })}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stage progress bar */}
      <div className="flex items-center gap-1">
        {STAGES.map((stage, idx) => {
          const cfg = STAGE_CONFIG[stage];
          const isActive = idx <= currentStageIdx;
          const isCurrent = stage === deal.stage;
          return (
            <button
              key={stage}
              className={`flex-1 h-8 rounded text-xs font-medium transition-colors flex items-center justify-center ${isCurrent ? "ring-2 ring-offset-1" : ""}`}
              style={{
                backgroundColor: isActive ? cfg.color : `${cfg.color}15`,
                color: isActive ? "#fff" : cfg.color,
                "--tw-ring-color": isCurrent ? cfg.color : undefined,
              } as React.CSSProperties}
              onClick={() => handleStageClick(stage)}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Data Source */}
      <DataSourceBadge
        dataSource={deal.data_source}
        lastSyncedAt={deal.last_synced_at}
        externalUrl={deal.external_url}
        variant="card"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activities">Activities ({activities.length})</TabsTrigger>
          <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
          <TabsTrigger value="meetings">Meetings ({linkedMeetings.length})</TabsTrigger>
          <TabsTrigger value="ai-coach"><Bot className="h-3.5 w-3.5 mr-1" />AI Coach</TabsTrigger>
          {isZohoCrmDealExternalId(deal.external_id) && (
            <TabsTrigger value="zoho-crm">Zoho CRM</TabsTrigger>
          )}
        </TabsList>

        {/* === OVERVIEW TAB === */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Deal Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {deal.description && <p className="text-sm text-muted-foreground">{deal.description}</p>}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Value</p>
                      <p className="font-medium">{deal.value ? `${deal.currency} ${deal.value.toLocaleString()}` : "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Probability</p>
                      <p className="font-medium">{deal.probability}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Expected Close</p>
                      <p className="font-medium">{deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Owner</p>
                      <p className="font-medium">{deal.owner?.full_name || "Unassigned"}</p>
                    </div>
                  </div>
                  {deal.source && (
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Source</p>
                        <p className="font-medium">{deal.source}</p>
                      </div>
                    </div>
                  )}
                  {deal.contact && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Contact</p>
                        <p className="font-medium">{deal.contact.first_name} {deal.contact.last_name || ""}</p>
                      </div>
                    </div>
                  )}
                </div>
                {(deal.tags || []).length > 0 && (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-sm text-muted-foreground mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {deal.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {deal.closed_at && (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-sm text-muted-foreground">
                      Closed on {new Date(deal.closed_at).toLocaleDateString()}
                      {deal.lost_reason && <> — Reason: {deal.lost_reason}</>}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activities yet.</p>
                ) : (
                  <div className="space-y-3">
                    {activities.slice(0, 5).map((a) => (
                      <div key={a.id} className="text-sm border-l-2 pl-3 py-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{a.activity_type}</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-muted-foreground mt-1">{a.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === ACTIVITIES TAB === */}
        <TabsContent value="activities" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setActivityType("note"); setActivityContent(""); setActivityDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />Log Activity
            </Button>
          </div>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No activities recorded.</p>
          ) : (
            <div className="space-y-2">
              {activities.map((a) => (
                <Card key={a.id}>
                  <CardContent className="flex items-start gap-3 py-3 px-4">
                    <Activity className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{a.activity_type}</Badge>
                        {a.user && <span className="text-xs text-muted-foreground">{a.user.full_name}</span>}
                      </div>
                      <p className="text-sm mt-1">{a.content}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(a.created_at).toLocaleDateString()}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* === COMMENTS TAB === */}
        <TabsContent value="comments" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmitComment(); }}
            />
            <Button size="sm" disabled={!newComment.trim()} onClick={handleSubmitComment}>
              <MessageSquare className="h-4 w-4 mr-1" />Post
            </Button>
          </div>
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No comments yet.</p>
          ) : (
            <div className="space-y-2">
              {comments.map((c) => (
                <Card key={c.id}>
                  <CardContent className="py-3 px-4">
                    {editingCommentId === c.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingCommentContent}
                          onChange={(e) => setEditingCommentContent(e.target.value)}
                          rows={2}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setEditingCommentId(null)}>Cancel</Button>
                          <Button size="sm" disabled={!editingCommentContent.trim()} onClick={handleSaveEditComment}>Save</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{c.user?.full_name || "Unknown"}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                            {c.user_id === user?.id && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setEditingCommentId(c.id); setEditingCommentContent(c.content); }}>
                                    <Pencil className="h-3.5 w-3.5 mr-2" />Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive" onClick={() => deleteComment.mutate({ id: c.id, dealId: deal.id })}>
                                    <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{c.content}</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* === MEETINGS TAB === */}
        <TabsContent value="meetings" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setLinkMeetingDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Link Meeting
            </Button>
          </div>
          {linkedMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No meetings linked to this deal.</p>
          ) : (
            <div className="space-y-2">
              {linkedMeetings.map((item) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/meetings/${item.meeting?.id}`)}
                >
                  <CardContent className="flex items-start gap-3 py-3 px-4">
                    <Video className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.meeting?.title || "Untitled Meeting"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {item.meeting?.status && (
                          <Badge variant="secondary" className="text-xs">{item.meeting.status}</Badge>
                        )}
                        {item.meeting?.duration_minutes && (
                          <span className="text-xs text-muted-foreground">{item.meeting.duration_minutes} min</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {item.meeting?.scheduled_at ? new Date(item.meeting.scheduled_at).toLocaleDateString() : "—"}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* === ZOHO CRM TAB === */}
        {isZohoCrmDealExternalId(deal.external_id) && (
          <TabsContent value="zoho-crm" className="mt-4 space-y-4">
            <DealZohoCrmTab dealId={deal.id} dealExternalId={deal.external_id} />
          </TabsContent>
        )}

        {/* === AI COACH TAB === */}
        <TabsContent value="ai-coach" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4" />Deal Coach</CardTitle>
              <p className="text-sm text-muted-foreground">Get AI-powered advice on deal strategy, objection handling, and next steps using the MEDDPICC framework.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {["Analyze this deal with MEDDPICC", "What should my next steps be?", "Draft a follow-up email", "Help me handle objections"].map((suggestion) => (
                  <Button key={suggestion} variant="outline" size="sm" className="text-xs" onClick={() => setCoachQuery(suggestion)}>
                    {suggestion}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Textarea
                  placeholder="Ask the Deal Coach a question about this deal..."
                  value={coachQuery}
                  onChange={(e) => setCoachQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAskCoach(); } }}
                  rows={2}
                  className="flex-1"
                />
                <Button size="sm" disabled={!coachQuery.trim() || coachLoading} onClick={handleAskCoach}>
                  {coachLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              {coachResponse && (
                <Card className="bg-muted/50">
                  <CardContent className="py-3 px-4">
                    <p className="text-sm whitespace-pre-wrap">{coachResponse}</p>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lost reason dialog */}
      <Dialog open={lostDialogOpen} onOpenChange={setLostDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark deal as lost</DialogTitle>
            <DialogDescription>Optionally provide a reason why this deal was lost.</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="lost-reason">Reason (optional)</Label>
            <Textarea
              id="lost-reason"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. Budget constraints, went with competitor, timing..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmLost}>Mark as Lost</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log activity dialog */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
            <DialogDescription>Record a note, call, email, or other activity for this deal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Activity Type</Label>
              <Select value={activityType} onValueChange={(v) => setActivityType(v as DealActivityType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Details</Label>
              <Textarea
                value={activityContent}
                onChange={(e) => setActivityContent(e.target.value)}
                placeholder="Describe the activity..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivityDialogOpen(false)}>Cancel</Button>
            <Button disabled={!activityContent.trim()} onClick={handleSubmitActivity}>Log Activity</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link meeting dialog */}
      <Dialog open={linkMeetingDialogOpen} onOpenChange={setLinkMeetingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link a Meeting</DialogTitle>
            <DialogDescription>Select a meeting to link to this deal.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Meeting</Label>
            <Select value={selectedMeetingId || "none"} onValueChange={(v) => setSelectedMeetingId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select meeting" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select a meeting</SelectItem>
                {unlinkableMeetings.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title}{m.scheduled_at ? ` (${new Date(m.scheduled_at).toLocaleDateString()})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkMeetingDialogOpen(false)}>Cancel</Button>
            <Button disabled={!selectedMeetingId} onClick={handleLinkMeeting}>Link Meeting</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
