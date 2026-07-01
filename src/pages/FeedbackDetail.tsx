import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Calendar, User, Loader2, MessageSquare, Image } from "lucide-react";

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
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Open",
  reviewed: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const TYPE_LABELS: Record<string, string> = {
  bug: "Bug",
  feature: "Feature",
  improvement: "Improvement",
  general: "General",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

function SignedScreenshot({ storedPath, index }: { storedPath: string; index: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let path = storedPath;
    if (path.startsWith("http")) {
      const parts = path.split("/object/public/user-knowledge/");
      path = parts.length > 1 ? parts[1] : storedPath;
    }
    supabase.storage.from("user-knowledge").createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled && data) setUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [storedPath]);
  if (!url) return <div className="w-full h-48 bg-muted rounded border animate-pulse" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block rounded border overflow-hidden bg-muted">
      <img src={url} alt={`Screenshot ${index + 1}`} className="w-full h-auto max-h-64 object-contain" />
    </a>
  );
}

export default function FeedbackDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, profile: authProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackItem | null>(null);
  const [reporter, setReporter] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  const isAdmin = authProfile?.role === "admin" || authProfile?.role === "moderator";

  useEffect(() => {
    if (id) fetchFeedback();
  }, [id]);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      setFeedback(data as FeedbackItem);

      // Fetch reporter profile
      if (data?.user_id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", data.user_id)
          .single();
        if (profileData) setReporter(profileData as Profile);
      }
    } catch (error: any) {
      console.error("Fetch feedback error:", error);
      toast.error("Failed to load feedback");
    } finally {
      setLoading(false);
    }
  };

  const updateField = async (field: string, value: string | null) => {
    if (!feedback || !isAdmin) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("feedback")
        .update({ [field]: value } as any)
        .eq("id", feedback.id);
      if (error) throw error;
      setFeedback((prev) => prev ? { ...prev, [field]: value } : prev);
      toast.success("Updated successfully");
    } catch (error: any) {
      console.error("Update error:", error);
      toast.error("Failed to update");
    } finally {
      setSaving(false);
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

  const getPriorityBadge = (priority: string | null) => {
    if (!priority) return null;
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      critical: "destructive",
      high: "destructive",
      medium: "secondary",
      low: "outline",
    };
    return <Badge variant={variants[priority] || "outline"}>{PRIORITY_LABELS[priority] || priority}</Badge>;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="space-y-4">
        <Link to="/feedback" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Feedback
        </Link>
        <p className="text-muted-foreground">Feedback item not found.</p>
      </div>
    );
  }

  const feedbackNumber = feedback.id.slice(0, 8).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground">Home</Link>
        {" > "}
        <Link to="/feedback" className="hover:text-foreground">Feedback</Link>
        {" > "}
        <span className="text-foreground">{feedbackNumber}</span>
      </nav>

      {/* Back link */}
      <Link to="/feedback" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Feedback
      </Link>

      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap">
        {getTypeBadge(feedback.type)}
        {getPriorityBadge(feedback.priority)}
        {getStatusBadge(feedback.status)}
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold tracking-tight">
        {TYPE_LABELS[feedback.type] || feedback.type} #{feedbackNumber}: {feedback.subject}
      </h1>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{feedback.message}</p>
            </CardContent>
          </Card>

          {/* Screenshots */}
          {feedback.metadata?.screenshot_urls && feedback.metadata.screenshot_urls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Screenshots ({feedback.metadata.screenshot_urls.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {feedback.metadata.screenshot_urls.map((path, i) => (
                    <SignedScreenshot key={i} storedPath={path} index={i} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Analysis Report placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Analysis Report</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                AI analysis is not yet available for this feedback item.
              </p>
            </CardContent>
          </Card>

          {/* Admin notes / Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {feedback.admin_notes ? (
                <div className="rounded-md bg-muted p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Admin Response</p>
                  <p className="text-sm">{feedback.admin_notes}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - sidebar */}
        <div className="space-y-6">
          {/* Details card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created</span>
                <span className="ml-auto font-medium">
                  {new Date(feedback.created_at).toLocaleDateString()}
                </span>
              </div>
              <Separator />
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Reported by</span>
                <span className="ml-auto font-medium truncate max-w-[140px]">
                  {reporter?.full_name || reporter?.email || "Unknown"}
                </span>
              </div>
              {feedback.module && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Module</span>
                    <Badge variant="outline" className="ml-auto">{feedback.module}</Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Admin Controls */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Admin Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={feedback.status || "pending"}
                    onValueChange={(value) => updateField("status", value)}
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Open</SelectItem>
                      <SelectItem value="reviewed">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select
                    value={feedback.priority || "medium"}
                    onValueChange={(value) => updateField("priority", value)}
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
