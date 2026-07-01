/**
 * Meeting AI Match Results Page
 *
 * Displays AI matching results for meetings to clients/projects/pods.
 * Supports filtering by review status, approving/rejecting suggestions,
 * and bulk-approving high confidence matches.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  Brain,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Zap,
  BarChart3,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import { ASSIGNMENT_CONFIDENCE } from "../types";

type ReviewFilter = "all" | "pending" | "approved" | "rejected";

interface SuggestionRow {
  id: string;
  meeting_id: string;
  suggested_type: string;
  suggested_id: string;
  confidence: number;
  reasoning: string | null;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  meeting_title: string;
  entity_name: string;
}

function useAssignmentSuggestions(filter: ReviewFilter) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["assignment-suggestions", filter],
    queryFn: async (): Promise<SuggestionRow[]> => {
      let query = (supabase as any)
        .from("meeting_assignment_suggestions")
        .select(
          "id, meeting_id, suggested_type, suggested_id, confidence, reasoning, review_status, reviewed_by, reviewed_at, created_at"
        )
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("review_status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch meeting titles
      const meetingIds = [...new Set((data as any[]).map((s: any) => s.meeting_id))];
      const { data: meetings } = await supabase
        .from("meetings")
        .select("id, title")
        .in("id", meetingIds);

      const meetingMap = new Map<string, string>(
        (meetings || []).map((m: any) => [m.id, m.title])
      );

      // Fetch entity names based on type
      const clientIds = (data as any[])
        .filter((s: any) => s.suggested_type === "client")
        .map((s: any) => s.suggested_id);
      const projectIds = (data as any[])
        .filter((s: any) => s.suggested_type === "project")
        .map((s: any) => s.suggested_id);

      const entityNameMap = new Map<string, string>();

      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("clients")
          .select("id, name")
          .in("id", clientIds);
        (clients || []).forEach((c: any) => entityNameMap.set(c.id, c.name));
      }

      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from("projects")
          .select("id, name")
          .in("id", projectIds);
        (projects || []).forEach((p: any) => entityNameMap.set(p.id, p.name));
      }

      return (data as any[]).map((s: any) => ({
        ...s,
        meeting_title: meetingMap.get(s.meeting_id) || "Unknown Meeting",
        entity_name: entityNameMap.get(s.suggested_id) || "Unknown",
      }));
    },
    enabled: !!user,
  });
}

function getConfidenceBadge(confidence: number) {
  if (confidence >= ASSIGNMENT_CONFIDENCE.HIGH) {
    return { label: "HIGH", className: "bg-green-100 text-green-800" };
  }
  if (confidence >= ASSIGNMENT_CONFIDENCE.MEDIUM) {
    return { label: "MEDIUM", className: "bg-amber-100 text-amber-800" };
  }
  return { label: "LOW", className: "bg-red-100 text-red-800" };
}

export default function MeetingAiMatchResultsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ReviewFilter>("all");

  const { data: suggestions = [], isLoading } = useAssignmentSuggestions(filter);

  const reviewMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "approved" | "rejected";
    }) => {
      const { error } = await (supabase as any)
        .from("meeting_assignment_suggestions")
        .update({
          review_status: status,
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["assignment-suggestions"] });
      queryClient.invalidateQueries({
        queryKey: ["pending-assignment-count"],
      });
      toast.success(
        `Suggestion ${vars.status === "approved" ? "approved" : "rejected"}`
      );
    },
    onError: (error: Error) => {
      toast.error("Failed to update suggestion", {
        description: error.message,
      });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async () => {
      const highConfidencePending = suggestions.filter(
        (s) =>
          s.review_status === "pending" &&
          s.confidence >= ASSIGNMENT_CONFIDENCE.HIGH
      );

      if (highConfidencePending.length === 0) {
        throw new Error("No high confidence pending suggestions to approve");
      }

      const ids = highConfidencePending.map((s) => s.id);
      const { error } = await (supabase as any)
        .from("meeting_assignment_suggestions")
        .update({
          review_status: "approved",
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .in("id", ids);

      if (error) throw error;
      return highConfidencePending.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["assignment-suggestions"] });
      queryClient.invalidateQueries({
        queryKey: ["pending-assignment-count"],
      });
      toast.success(`Approved ${count} high confidence suggestion${count > 1 ? "s" : ""}`);
    },
    onError: (error: Error) => {
      toast.error("Failed to bulk approve", {
        description: error.message,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Stats
  const total = suggestions.length;
  const pending = suggestions.filter(
    (s) => s.review_status === "pending"
  ).length;
  const highConfidence = suggestions.filter(
    (s) => s.confidence >= ASSIGNMENT_CONFIDENCE.HIGH
  ).length;
  const lowConfidence = suggestions.filter(
    (s) => s.confidence < ASSIGNMENT_CONFIDENCE.MEDIUM
  ).length;

  const highConfidencePendingCount = suggestions.filter(
    (s) =>
      s.review_status === "pending" &&
      s.confidence >= ASSIGNMENT_CONFIDENCE.HIGH
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Match Results</h1>
          <p className="text-muted-foreground">
            Review AI-generated meeting-to-entity matching suggestions.
          </p>
        </div>
        {highConfidencePendingCount > 0 && (
          <Button
            onClick={() => bulkApproveMutation.mutate()}
            disabled={bulkApproveMutation.isPending}
          >
            {bulkApproveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ThumbsUp className="h-4 w-4 mr-2" />
            )}
            Approve All High Confidence ({highConfidencePendingCount})
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Brain className="h-4 w-4" />
              <span className="text-sm">Total Suggestions</span>
            </div>
            <p className="text-2xl font-bold mt-1">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Pending Review</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-600">{pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="h-4 w-4" />
              <span className="text-sm">High Confidence</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">
              {highConfidence}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Low Confidence</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">
              {lowConfidence}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as ReviewFilter)}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meeting</TableHead>
                  <TableHead>Suggested Entity</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[130px]">Confidence</TableHead>
                  <TableHead className="max-w-[200px]">Reasoning</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="text-right w-[140px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold">
                        No Suggestions
                      </h3>
                      <p className="text-muted-foreground">
                        {filter !== "all"
                          ? `No ${filter} suggestions found.`
                          : "AI matching suggestions will appear here after processing."}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  suggestions.map((s) => {
                    const badge = getConfidenceBadge(s.confidence);
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <button
                            className="font-medium text-primary hover:underline text-left"
                            onClick={() =>
                              navigate(`/meetings/${s.meeting_id}`)
                            }
                          >
                            {s.meeting_title}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">
                          {s.entity_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {s.suggested_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono">
                              {Math.round(s.confidence * 100)}%
                            </span>
                            <Badge className={badge.className + " text-xs"}>
                              {badge.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate cursor-help">
                                  {s.reasoning || "—"}
                                </span>
                              </TooltipTrigger>
                              {s.reasoning && (
                                <TooltipContent className="max-w-sm">
                                  <p>{s.reasoning}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              s.review_status === "approved"
                                ? "border-green-500 text-green-700"
                                : s.review_status === "rejected"
                                ? "border-red-500 text-red-700"
                                : "border-amber-500 text-amber-700"
                            }
                          >
                            {s.review_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {s.review_status === "pending" && (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                disabled={reviewMutation.isPending}
                                onClick={() =>
                                  reviewMutation.mutate({
                                    id: s.id,
                                    status: "approved",
                                  })
                                }
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                disabled={reviewMutation.isPending}
                                onClick={() =>
                                  reviewMutation.mutate({
                                    id: s.id,
                                    status: "rejected",
                                  })
                                }
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
