import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search,
  MessageSquare,
  Bug,
  Lightbulb,
  TrendingUp,
  Star,
  Loader2,
  RefreshCw,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { getInitials, formatDate } from "@/lib/utils";

interface FeedbackItem {
  id: string;
  user_id: string;
  type: "bug" | "feature" | "improvement" | "general";
  subject: string;
  message: string;
  rating: number | null;
  status: "pending" | "reviewed" | "resolved" | "closed";
  admin_notes: string | null;
  metadata: { screenshot_urls?: string[] } | null;
  created_at: string;
  updated_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface FeedbackWithUser extends FeedbackItem {
  user?: UserProfile | null;
}

export default function FeedbackManagement() {
  const [feedback, setFeedback] = useState<FeedbackWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "rating" | "status">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackWithUser | null>(null);
  const [editStatus, setEditStatus] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([]);

  const resolveScreenshotUrl = async (storedPath: string): Promise<string> => {
    let path = storedPath;
    if (path.startsWith("http")) {
      const parts = path.split("/object/public/user-knowledge/");
      if (parts.length > 1) {
        path = parts[1];
      } else {
        return path;
      }
    }
    const { data, error } = await supabase.storage
      .from("user-knowledge")
      .createSignedUrl(path, 3600);
    if (error) {
      console.error("Error creating signed URL:", error);
      return "";
    }
    return data.signedUrl;
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      // Fetch all feedback
      const { data: feedbackData, error: feedbackError } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false });

      if (feedbackError) throw feedbackError;

      // Fetch user profiles for each feedback item
      const feedbackWithUsers = await Promise.all(
        (feedbackData || []).map(async (item) => {
          const { data: userData } = await supabase
            .from("profiles")
            .select("id, email, full_name, avatar_url")
            .eq("id", item.user_id)
            .single();

          return {
            ...item,
            user: userData || null,
          } as FeedbackWithUser;
        })
      );

      setFeedback(feedbackWithUsers);
    } catch (error: any) {
      console.error("Error fetching feedback:", error);
      toast.error("Failed to fetch feedback");
    } finally {
      setLoading(false);
    }
  };

  const handleViewFeedback = (item: FeedbackWithUser) => {
    setSelectedFeedback(item);
    setEditStatus(item.status);
    setEditNotes(item.admin_notes || "");
    setScreenshotUrls([]);
    setSheetOpen(true);
  };

  useEffect(() => {
    if (!selectedFeedback?.metadata?.screenshot_urls?.length) {
      setScreenshotUrls([]);
      return;
    }
    let cancelled = false;
    Promise.all(selectedFeedback.metadata.screenshot_urls.map(resolveScreenshotUrl)).then(
      (urls) => {
        if (!cancelled) setScreenshotUrls(urls.filter(Boolean));
      }
    );
    return () => { cancelled = true; };
  }, [selectedFeedback]);

  const handleSaveFeedback = async () => {
    if (!selectedFeedback) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("feedback")
        .update({
          status: editStatus,
          admin_notes: editNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedFeedback.id);

      if (error) throw error;

      toast.success("Feedback updated successfully");
      setSheetOpen(false);
      fetchFeedback();
    } catch (error: any) {
      console.error("Error updating feedback:", error);
      toast.error("Failed to update feedback");
    } finally {
      setSaving(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "bug":
        return <Bug className="h-4 w-4" />;
      case "feature":
        return <Lightbulb className="h-4 w-4" />;
      case "improvement":
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      bug: "destructive",
      feature: "default",
      improvement: "secondary",
      general: "outline",
    };
    return (
      <Badge variant={variants[type] || "outline"} className="flex items-center gap-1 w-fit">
        {getTypeIcon(type)}
        <span className="capitalize">{type}</span>
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "reviewed":
        return <Eye className="h-4 w-4" />;
      case "resolved":
        return <CheckCircle2 className="h-4 w-4" />;
      case "closed":
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      reviewed: "default",
      resolved: "default",
      closed: "outline",
    };
    const colors: Record<string, string> = {
      pending: "bg-warning/10 text-warning border-warning/20",
      reviewed: "bg-info/10 text-info border-info/20",
      resolved: "bg-success/10 text-success border-success/20",
      closed: "bg-muted/500/10 text-muted-foreground border-gray-500/20",
    };
    return (
      <Badge variant="outline" className={`flex items-center gap-1 w-fit ${colors[status] || ""}`}>
        {getStatusIcon(status)}
        <span className="capitalize">{status}</span>
      </Badge>
    );
  };

  const renderRating = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${
              i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
            }`}
          />
        ))}
      </div>
    );
  };

  // Filter and sort feedback
  const filteredFeedback = feedback
    .filter((item) => {
      const matchesSearch =
        item.subject.toLowerCase().includes(search.toLowerCase()) ||
        item.message.toLowerCase().includes(search.toLowerCase()) ||
        item.user?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        item.user?.email?.toLowerCase().includes(search.toLowerCase());

      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "date":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "rating":
          comparison = (a.rating || 0) - (b.rating || 0);
          break;
        case "status":
          const statusOrder = { pending: 0, reviewed: 1, resolved: 2, closed: 3 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  // Stats
  const stats = {
    total: feedback.length,
    pending: feedback.filter((f) => f.status === "pending").length,
    bugs: feedback.filter((f) => f.type === "bug").length,
    features: feedback.filter((f) => f.type === "feature").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feedback Management</h1>
          <p className="text-muted-foreground">
            Review and manage user feedback, bug reports, and feature requests
          </p>
        </div>
        <Button onClick={fetchFeedback} variant="outline" disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All submissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bug Reports</CardTitle>
            <Bug className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.bugs}</div>
            <p className="text-xs text-muted-foreground">Issues reported</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feature Requests</CardTitle>
            <Lightbulb className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.features}</div>
            <p className="text-xs text-muted-foreground">New ideas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Feedback</CardTitle>
          <CardDescription>View and manage all submitted feedback</CardDescription>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by subject, message, or user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="feature">Feature</SelectItem>
                <SelectItem value="improvement">Improvement</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
              const [sort, order] = value.split("-");
              setSortBy(sort as "date" | "rating" | "status");
              setSortOrder(order as "asc" | "desc");
            }}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Newest First</SelectItem>
                <SelectItem value="date-asc">Oldest First</SelectItem>
                <SelectItem value="rating-desc">Highest Rating</SelectItem>
                <SelectItem value="rating-asc">Lowest Rating</SelectItem>
                <SelectItem value="status-asc">Status (Pending First)</SelectItem>
                <SelectItem value="status-desc">Status (Closed First)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Response</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFeedback.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                      No feedback found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFeedback.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewFeedback(item)}
                    >
                      <TableCell>{getTypeBadge(item.type)}</TableCell>
                      <TableCell>
                        <div className="max-w-[250px]">
                          <p className="font-medium truncate">{item.subject}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.message}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={item.user?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(item.user?.full_name || item.user?.email || "?")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate max-w-[120px]">
                            {item.user?.full_name || item.user?.email || "Unknown"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{renderRating(item.rating)}</TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(item.created_at, "PP")}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.admin_notes ? (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                            Responded
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            No response
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Feedback Details</SheetTitle>
            <SheetDescription>
              Review and update feedback status
            </SheetDescription>
          </SheetHeader>

          {selectedFeedback && (
            <div className="space-y-6 py-6">
              {/* Type and Status */}
              <div className="flex items-center gap-2 flex-wrap">
                {getTypeBadge(selectedFeedback.type)}
                {getStatusBadge(selectedFeedback.status)}
              </div>

              {/* Subject */}
              <div>
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <p className="font-medium">{selectedFeedback.subject}</p>
              </div>

              {/* User Info */}
              <div>
                <Label className="text-xs text-muted-foreground">Submitted by</Label>
                <div className="flex items-center gap-3 mt-1">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedFeedback.user?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(
                        selectedFeedback.user?.full_name ||
                          selectedFeedback.user?.email ||
                          "?"
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {selectedFeedback.user?.full_name || "Unknown User"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedFeedback.user?.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Rating */}
              {selectedFeedback.rating && (
                <div>
                  <Label className="text-xs text-muted-foreground">Rating</Label>
                  <div className="flex items-center gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${
                          i < selectedFeedback.rating!
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-sm text-muted-foreground">
                      {selectedFeedback.rating}/5
                    </span>
                  </div>
                </div>
              )}

              {/* Message */}
              <div>
                <Label className="text-xs text-muted-foreground">Message</Label>
                <div className="mt-1 p-4 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{selectedFeedback.message}</p>
                </div>
              </div>

              {/* Screenshots */}
              {screenshotUrls.length > 0 ? (
                <div>
                  <Label className="text-xs text-muted-foreground">Screenshots</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {screenshotUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-md border overflow-hidden w-24 h-24 bg-muted flex-shrink-0 hover:opacity-90"
                      >
                        <img
                          src={url}
                          alt={`Screenshot ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click to open full size
                  </p>
                </div>
              ) : null}

              {/* Date */}
              <div className="flex gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Submitted</Label>
                  <p className="text-sm">{formatDate(selectedFeedback.created_at, "PPp")}</p>
                </div>
                {selectedFeedback.updated_at !== selectedFeedback.created_at && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Last Updated</Label>
                    <p className="text-sm">{formatDate(selectedFeedback.updated_at, "PPp")}</p>
                  </div>
                )}
              </div>

              {/* Editable fields */}
              <div className="border-t pt-6 space-y-4">
                <h4 className="font-medium">Update Feedback</h4>

                {/* Status */}
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Admin Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Admin Notes (Response to User)</Label>
                  <Textarea
                    id="notes"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add notes or a response for the user..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    This response will be visible to the user
                  </p>
                </div>
              </div>
            </div>
          )}

          <SheetFooter className="mt-4">
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveFeedback} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
