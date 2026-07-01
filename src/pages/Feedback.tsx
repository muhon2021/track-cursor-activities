import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Bug,
  Lightbulb,
  Loader2,
  Send,
  Upload,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
} from "lucide-react";

const SCREENSHOT_ACCEPT = "image/png,image/jpeg,image/jpg,image/gif,image/webp";
const SCREENSHOT_MAX = 5;
const SCREENSHOT_MAX_SIZE_MB = 5;

interface FeedbackItem {
  id: string;
  user_id: string;
  type: string;
  subject: string;
  message: string;
  rating: number | null;
  status: string | null;
  admin_notes: string | null;
  metadata: { screenshot_urls?: string[] } | null;
  module: string | null;
  priority: string | null;
  created_at: string;
  updated_at: string;
}

type ScreenshotPreview = { file: File; previewUrl: string };

const STATUS_LABELS: Record<string, string> = {
  pending: "Open",
  reviewed: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500",
  reviewed: "bg-blue-500",
  resolved: "bg-green-500",
  closed: "bg-gray-400",
};

const TYPE_LABELS: Record<string, string> = {
  bug: "Bug",
  feature: "Feature",
  improvement: "Improvement",
  general: "General",
};

function StatusBar({ label, count, total, colorClass }: { label: string; count: number; total: number; colorClass: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{count} ({pct}%)</span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Feedback() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [allFeedback, setAllFeedback] = useState<FeedbackItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"bug" | "feature">("bug");
  const [submitting, setSubmitting] = useState(false);
  const [screenshots, setScreenshots] = useState<ScreenshotPreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("open-bugs");
  const [statusFilter, setStatusFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [perPage, setPerPage] = useState(20);

  const [formData, setFormData] = useState({
    type: "bug" as string,
    subject: "",
    message: "",
    module: "",
  });

  useEffect(() => {
    if (user) fetchAllFeedback();
  }, [user]);

  const fetchAllFeedback = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAllFeedback((data || []) as FeedbackItem[]);
    } catch (error: any) {
      console.error("Fetch feedback error:", error);
      toast.error("Failed to load feedback");
    } finally {
      setLoading(false);
    }
  };

  // --- Stats computation ---
  const stats = useMemo(() => {
    const bugs = allFeedback.filter((f) => f.type === "bug");
    const features = allFeedback.filter((f) => f.type === "feature");
    const openBugs = bugs.filter((f) => f.status === "pending");
    const openFeatures = features.filter((f) => f.status === "pending");
    const inProgress = allFeedback.filter((f) => f.status === "reviewed");
    const resolved = allFeedback.filter((f) => f.status === "resolved");

    const bugsByStatus = {
      pending: bugs.filter((f) => f.status === "pending").length,
      reviewed: bugs.filter((f) => f.status === "reviewed").length,
      resolved: bugs.filter((f) => f.status === "resolved").length,
      closed: bugs.filter((f) => f.status === "closed").length,
    };

    const featuresByStatus = {
      pending: features.filter((f) => f.status === "pending").length,
      reviewed: features.filter((f) => f.status === "reviewed").length,
      resolved: features.filter((f) => f.status === "resolved").length,
      closed: features.filter((f) => f.status === "closed").length,
    };

    return {
      openBugs: openBugs.length,
      openFeatures: openFeatures.length,
      inProgress: inProgress.length,
      resolved: resolved.length,
      totalBugs: bugs.length,
      totalFeatures: features.length,
      bugsByStatus,
      featuresByStatus,
      inProgressBugs: bugsByStatus.reviewed,
      inProgressFeatures: featuresByStatus.reviewed,
      resolvedBugs: bugsByStatus.resolved,
      resolvedFeatures: featuresByStatus.resolved,
    };
  }, [allFeedback]);

  // --- Available modules for filter ---
  const availableModules = useMemo(() => {
    const modules = new Set<string>();
    allFeedback.forEach((f) => {
      if (f.module) modules.add(f.module);
    });
    return Array.from(modules).sort();
  }, [allFeedback]);

  // --- Filtered list per tab ---
  const filteredFeedback = useMemo(() => {
    let items = allFeedback;

    // Tab filter
    switch (activeTab) {
      case "open-bugs":
        items = items.filter((f) => f.type === "bug" && f.status === "pending");
        break;
      case "resolved":
        items = items.filter((f) => f.status === "resolved");
        break;
      case "features-open":
        items = items.filter((f) => f.type === "feature" && f.status === "pending");
        break;
      case "all-open":
        items = items.filter((f) => f.status === "pending" || f.status === "reviewed");
        break;
    }

    // Status filter
    if (statusFilter !== "all") {
      items = items.filter((f) => f.status === statusFilter);
    }

    // Module filter
    if (moduleFilter !== "all") {
      items = items.filter((f) => f.module === moduleFilter);
    }

    return items.slice(0, perPage);
  }, [allFeedback, activeTab, statusFilter, moduleFilter, perPage]);

  // --- Screenshot handling ---
  const addScreenshotFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next: ScreenshotPreview[] = [];
    for (let i = 0; i < files.length && screenshots.length + next.length < SCREENSHOT_MAX; i++) {
      const file = files[i];
      if (!SCREENSHOT_ACCEPT.split(",").some((t) => t.trim() === file.type)) {
        toast.error(`${file.name}: use PNG, JPG, GIF, or WebP`);
        continue;
      }
      if (file.size > SCREENSHOT_MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name}: max ${SCREENSHOT_MAX_SIZE_MB}MB`);
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    if (next.length) setScreenshots((prev) => prev.concat(next).slice(0, SCREENSHOT_MAX));
  };

  const removeScreenshot = (index: number) => {
    setScreenshots((prev) => {
      const copy = prev.slice();
      URL.revokeObjectURL(copy[index].previewUrl);
      copy.splice(index, 1);
      return copy;
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.files;
    if (!items?.length) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) imageFiles.push(items[i]);
    }
    if (imageFiles.length) {
      e.preventDefault();
      const dto = new DataTransfer();
      imageFiles.forEach((f) => dto.items.add(f));
      addScreenshotFiles(dto.files);
    }
  };

  const uploadScreenshots = async (): Promise<string[]> => {
    if (!user || !screenshots.length) return [];
    const urls: string[] = [];
    for (const { file } of screenshots) {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/feedback/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("user-knowledge").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      urls.push(path);
    }
    return urls;
  };

  const openSubmitDialog = (type: "bug" | "feature") => {
    setDialogType(type);
    setFormData({ type, subject: "", message: "", module: "" });
    setScreenshots([]);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.subject.trim() || !formData.message.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const screenshotUrls = await uploadScreenshots();
      const metadata = screenshotUrls.length > 0 ? { screenshot_urls: screenshotUrls } : null;

      const { error } = await supabase.from("feedback").insert({
        user_id: user.id,
        type: formData.type,
        subject: formData.subject,
        message: formData.message,
        status: "pending",
        module: formData.module || null,
        metadata,
      });

      if (error) throw error;
      toast.success("Feedback submitted successfully!");
      setDialogOpen(false);
      fetchAllFeedback();
    } catch (error: any) {
      console.error("Submit feedback error:", error);
      toast.error(error.message || "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      bug: "destructive",
      feature: "default",
      improvement: "secondary",
      general: "outline",
    };
    return <Badge variant={variants[type] || "outline"}>{TYPE_LABELS[type] || type}</Badge>;
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      reviewed: "default",
      resolved: "default",
      closed: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{STATUS_LABELS[status] || status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
        <p className="text-muted-foreground">
          Submit bugs, feature requests, and view community feedback
        </p>
      </div>

      {/* Stats Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open Bugs</CardDescription>
            <CardTitle className="text-3xl">{stats.openBugs}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.inProgressBugs} in progress, {stats.resolvedBugs} resolved
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open Features</CardDescription>
            <CardTitle className="text-3xl">{stats.openFeatures}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.inProgressFeatures} in progress, {stats.resolvedFeatures} resolved
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In Progress</CardDescription>
            <CardTitle className="text-3xl">{stats.inProgress}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Across all feedback types
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Resolved</CardDescription>
            <CardTitle className="text-3xl">{stats.resolved}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.resolvedBugs} bugs, {stats.resolvedFeatures} features
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-destructive" />
              <CardTitle className="text-lg">Bug Reports</CardTitle>
            </div>
            <CardDescription>Report technical issues and problems</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => openSubmitDialog("bug")} className="w-full">
              <Send className="mr-2 h-4 w-4" />
              Submit Bug Report
            </Button>
          </CardContent>
        </Card>
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-lg">Feature Requests</CardTitle>
            </div>
            <CardDescription>Suggest new features and enhancements</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => openSubmitDialog("feature")} variant="outline" className="w-full">
              <Send className="mr-2 h-4 w-4" />
              Submit Feature Request
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bug Reports Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusBar label="Open" count={stats.bugsByStatus.pending} total={stats.totalBugs} colorClass="bg-yellow-500" />
            <StatusBar label="In Progress" count={stats.bugsByStatus.reviewed} total={stats.totalBugs} colorClass="bg-blue-500" />
            <StatusBar label="Resolved" count={stats.bugsByStatus.resolved} total={stats.totalBugs} colorClass="bg-green-500" />
            <StatusBar label="Closed" count={stats.bugsByStatus.closed} total={stats.totalBugs} colorClass="bg-gray-400" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feature Requests Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusBar label="Open" count={stats.featuresByStatus.pending} total={stats.totalFeatures} colorClass="bg-yellow-500" />
            <StatusBar label="In Progress" count={stats.featuresByStatus.reviewed} total={stats.totalFeatures} colorClass="bg-blue-500" />
            <StatusBar label="Resolved" count={stats.featuresByStatus.resolved} total={stats.totalFeatures} colorClass="bg-green-500" />
            <StatusBar label="Closed" count={stats.featuresByStatus.closed} total={stats.totalFeatures} colorClass="bg-gray-400" />
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Feedback List */}
      <Card>
        <CardHeader>
          <CardTitle>Community Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="open-bugs">Open Bugs</TabsTrigger>
                <TabsTrigger value="resolved">Resolved</TabsTrigger>
                <TabsTrigger value="features-open">Features (open)</TabsTrigger>
                <TabsTrigger value="all-open">All (open)</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2 flex-wrap">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Open</SelectItem>
                    <SelectItem value="reviewed">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>

                {availableModules.length > 0 && (
                  <Select value={moduleFilter} onValueChange={setModuleFilter}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Module" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Modules</SelectItem>
                      {availableModules.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={String(perPage)} onValueChange={(v) => setPerPage(Number(v))}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* All tabs share the same list rendering */}
            {["open-bugs", "resolved", "features-open", "all-open"].map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredFeedback.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No feedback items found</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredFeedback.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => navigate(`/feedback/${item.id}`)}
                        className="flex items-center gap-3 w-full px-3 py-3 text-left hover:bg-muted/50 transition-colors rounded-md"
                      >
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getTypeBadge(item.type)}
                          {item.module && (
                            <Badge variant="outline" className="text-xs">{item.module}</Badge>
                          )}
                        </div>
                        <span className="flex-1 truncate text-sm font-medium">{item.subject}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getStatusBadge(item.status)}
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Submit Feedback Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogType === "bug" ? "Submit Bug Report" : "Submit Feature Request"}
            </DialogTitle>
            <DialogDescription>
              {dialogType === "bug"
                ? "Describe the issue you encountered"
                : "Describe the feature you'd like to see"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} onPaste={handlePaste} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Brief description"
                required
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Description *</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder={
                  dialogType === "bug"
                    ? "Steps to reproduce, expected vs actual behavior..."
                    : "Describe what you'd like and why it's useful..."
                }
                rows={5}
                required
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="module">Module (Optional)</Label>
              <Select
                value={formData.module}
                onValueChange={(value) => setFormData({ ...formData, module: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dashboard">Dashboard</SelectItem>
                  <SelectItem value="CRM">CRM</SelectItem>
                  <SelectItem value="Meetings">Meetings</SelectItem>
                  <SelectItem value="Tasks">Tasks</SelectItem>
                  <SelectItem value="Projects">Projects</SelectItem>
                  <SelectItem value="Knowledge">Knowledge</SelectItem>
                  <SelectItem value="EOS">EOS</SelectItem>
                  <SelectItem value="Productivity">Productivity</SelectItem>
                  <SelectItem value="AI Features">AI Features</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Screenshots (Optional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept={SCREENSHOT_ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => {
                  addScreenshotFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={submitting || screenshots.length >= SCREENSHOT_MAX}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Add Screenshot
              </Button>
              <p className="text-xs text-muted-foreground">
                Upload or paste up to {SCREENSHOT_MAX} images. Max {SCREENSHOT_MAX_SIZE_MB}MB each.
              </p>
              {screenshots.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {screenshots.map((s, i) => (
                    <div
                      key={i}
                      className="relative rounded-md border overflow-hidden bg-muted w-16 h-16 flex-shrink-0"
                    >
                      <img src={s.previewUrl} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        aria-label="Remove screenshot"
                        className="absolute top-0.5 right-0.5 rounded-full bg-destructive/90 text-destructive-foreground p-0.5 hover:bg-destructive"
                        onClick={() => removeScreenshot(i)}
                        disabled={submitting}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
