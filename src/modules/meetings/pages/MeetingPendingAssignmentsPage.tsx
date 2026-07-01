/**
 * Meeting Pending Assignments Page
 *
 * Dashboard for reviewing pending meeting assignment suggestions.
 * Card-based layout sorted by confidence, with approve/reject actions.
 */

import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Zap,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { ASSIGNMENT_CONFIDENCE } from "../types";

interface PendingSuggestion {
  id: string;
  meeting_id: string;
  suggested_type: string;
  suggested_id: string;
  confidence: number;
  reasoning: string | null;
  review_status: string;
  created_at: string;
  meeting_title: string;
  meeting_scheduled_at: string | null;
  meeting_slug: string | null;
  entity_name: string;
}

function usePendingSuggestions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pending-assignment-suggestions"],
    queryFn: async (): Promise<PendingSuggestion[]> => {
      const { data, error } = await (supabase as any)
        .from("meeting_assignment_suggestions")
        .select(
          "id, meeting_id, suggested_type, suggested_id, confidence, reasoning, review_status, created_at"
        )
        .eq("review_status", "pending")
        .order("confidence", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch meeting info
      const meetingIds = [...new Set((data as any[]).map((s: any) => s.meeting_id))];
      const { data: meetings } = await supabase
        .from("meetings")
        .select("id, title, scheduled_at, slug")
        .in("id", meetingIds);

      const meetingMap = new Map<
        string,
        { title: string; scheduled_at: string | null; slug: string | null }
      >(
        (meetings || []).map((m: any) => [
          m.id,
          { title: m.title, scheduled_at: m.scheduled_at, slug: m.slug },
        ])
      );

      // Fetch entity names
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

      return (data as any[]).map((s: any) => {
        const meeting = meetingMap.get(s.meeting_id) || {
          title: "Unknown Meeting",
          scheduled_at: null,
          slug: null,
        };
        return {
          ...s,
          meeting_title: meeting.title,
          meeting_scheduled_at: meeting.scheduled_at,
          meeting_slug: meeting.slug,
          entity_name: entityNameMap.get(s.suggested_id) || "Unknown",
        };
      });
    },
    enabled: !!user,
  });
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= ASSIGNMENT_CONFIDENCE.HIGH) return "text-green-600";
  if (confidence >= ASSIGNMENT_CONFIDENCE.MEDIUM) return "text-amber-600";
  return "text-red-600";
}

function getProgressColor(confidence: number): string {
  if (confidence >= ASSIGNMENT_CONFIDENCE.HIGH)
    return "[&>div]:bg-green-500";
  if (confidence >= ASSIGNMENT_CONFIDENCE.MEDIUM)
    return "[&>div]:bg-amber-500";
  return "[&>div]:bg-red-500";
}

export default function MeetingPendingAssignmentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading } = usePendingSuggestions();

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
      queryClient.invalidateQueries({
        queryKey: ["pending-assignment-suggestions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["pending-assignment-count"],
      });
      queryClient.invalidateQueries({
        queryKey: ["assignment-suggestions"],
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

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Stats
  const total = suggestions.length;
  const highConfidence = suggestions.filter(
    (s) => s.confidence >= ASSIGNMENT_CONFIDENCE.HIGH
  ).length;
  const mediumConfidence = suggestions.filter(
    (s) =>
      s.confidence >= ASSIGNMENT_CONFIDENCE.MEDIUM &&
      s.confidence < ASSIGNMENT_CONFIDENCE.HIGH
  ).length;
  const lowConfidence = suggestions.filter(
    (s) => s.confidence < ASSIGNMENT_CONFIDENCE.MEDIUM
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Pending Assignments</h1>
        <p className="text-muted-foreground">
          Review and approve meeting assignment suggestions from AI matching.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1">{total}</p>
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
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">Medium Confidence</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-600">
              {mediumConfidence}
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

      {/* Suggestion Cards */}
      {suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">No pending assignments</p>
          <p className="text-sm">
            All meeting assignment suggestions have been reviewed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suggestions.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      <button
                        className="text-primary hover:underline text-left"
                        onClick={() =>
                          navigate(
                            `/meetings/${s.meeting_slug || s.meeting_id}`
                          )
                        }
                      >
                        {s.meeting_title}
                      </button>
                    </CardTitle>
                    {s.meeting_scheduled_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(s.meeting_scheduled_at).toLocaleDateString(
                          undefined,
                          {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">
                    {s.suggested_type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Suggested: {s.entity_name}</p>
                </div>

                {/* Confidence bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Confidence</span>
                    <span
                      className={`font-mono font-medium ${getConfidenceColor(
                        s.confidence
                      )}`}
                    >
                      {Math.round(s.confidence * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={s.confidence * 100}
                    className={`h-2 ${getProgressColor(s.confidence)}`}
                  />
                </div>

                {/* Reasoning */}
                {s.reasoning && (
                  <p className="text-sm text-muted-foreground">{s.reasoning}</p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={reviewMutation.isPending}
                    onClick={() =>
                      reviewMutation.mutate({
                        id: s.id,
                        status: "approved",
                      })
                    }
                  >
                    {reviewMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={reviewMutation.isPending}
                    onClick={() =>
                      reviewMutation.mutate({
                        id: s.id,
                        status: "rejected",
                      })
                    }
                  >
                    {reviewMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
