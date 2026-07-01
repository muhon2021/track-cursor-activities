/**
 * Transcript Detail Page
 *
 * Displays a single meeting transcript with full content, AI summary,
 * speakers, source badge, word count, duration, and extracted action items.
 * Supports generating an AI summary via the generate-meeting-summary edge function.
 */

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Loader2,
  ArrowLeft,
  FileText,
  MessageSquare,
  ListChecks,
  Clock,
  Hash,
  Users,
  Search,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { useGenerateMeetingSummary } from "../hooks/useGenerateMeetingSummary";
import { useMeetingActionItems } from "../hooks/useMeetingActionItems";

interface TranscriptDetail {
  id: string;
  meeting_id: string;
  content: string | null;
  ai_summary: string | null;
  speakers: string[] | null;
  source: string | null;
  word_count: number | null;
  duration_seconds: number | null;
  processing_status: string | null;
  created_at: string;
}

interface MeetingInfo {
  id: string;
  title: string;
  scheduled_at: string | null;
}

type DetailTab = "transcript" | "summary" | "action-items";

function useTranscriptDetail(transcriptId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["transcript-detail", transcriptId],
    queryFn: async (): Promise<{
      transcript: TranscriptDetail;
      meeting: MeetingInfo;
    }> => {
      const { data: transcript, error } = await supabase
        .from("meeting_transcripts")
        .select(
          "id, meeting_id, content, ai_summary, speakers, source, word_count, duration_seconds, processing_status, created_at"
        )
        .eq("id", transcriptId)
        .single();

      if (error) throw error;
      if (!transcript) throw new Error("Transcript not found");

      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .select("id, title, scheduled_at")
        .eq("id", (transcript as any).meeting_id)
        .single();

      if (meetingError) throw meetingError;

      return {
        transcript: transcript as unknown as TranscriptDetail,
        meeting: (meeting || {
          id: (transcript as any).meeting_id,
          title: "Unknown Meeting",
          scheduled_at: null,
        }) as MeetingInfo,
      };
    },
    enabled: !!user && !!transcriptId,
  });
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export default function TranscriptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DetailTab>("transcript");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useTranscriptDetail(id!);
  const generateSummary = useGenerateMeetingSummary();

  const meetingId = data?.transcript.meeting_id || "";
  const { data: actionItems = [], isLoading: actionItemsLoading } =
    useMeetingActionItems(meetingId);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">Transcript not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/meetings/transcripts")}
        >
          Back to Transcripts
        </Button>
      </div>
    );
  }

  const { transcript, meeting } = data;

  // Highlight search matches in transcript content
  const highlightContent = (content: string, query: string) => {
    if (!query || query.length < 2) return content;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    return content.replace(regex, "<<HIGHLIGHT>>$1<<ENDHIGHLIGHT>>");
  };

  const renderedContent = transcript.content
    ? searchQuery.length >= 2
      ? highlightContent(transcript.content, searchQuery)
      : transcript.content
    : "No transcript content available.";

  const handleGenerateSummary = () => {
    generateSummary.mutate({
      meetingId: transcript.meeting_id,
      transcriptContent: transcript.content || undefined,
    });
  };

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-gray-100 text-gray-800",
    in_progress: "bg-yellow-100 text-yellow-800",
    completed: "bg-green-100 text-green-800",
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          className="hover:text-primary"
          onClick={() => navigate("/meetings")}
        >
          Meetings
        </button>
        <ChevronRight className="h-3 w-3" />
        <button
          className="hover:text-primary"
          onClick={() => navigate("/meetings/transcripts")}
        >
          Transcripts
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{meeting.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/meetings/transcripts")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{meeting.title}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline" className="text-xs">
                {transcript.source || "manual"}
              </Badge>
              {meeting.scheduled_at && (
                <span className="text-sm text-muted-foreground">
                  {new Date(meeting.scheduled_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Hash className="h-4 w-4" />
              <span className="text-sm">Word Count</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {transcript.word_count?.toLocaleString() || "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Duration</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {transcript.duration_seconds
                ? formatDuration(transcript.duration_seconds)
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-sm">Speakers</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {transcript.speakers?.length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ListChecks className="h-4 w-4" />
              <span className="text-sm">Action Items</span>
            </div>
            <p className="text-2xl font-bold mt-1">{actionItems.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Speakers list */}
      {transcript.speakers && transcript.speakers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">Speakers:</span>
          {transcript.speakers.map((speaker, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {speaker}
            </Badge>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as DetailTab)}
      >
        <TabsList>
          <TabsTrigger value="transcript" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            Transcript
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger
            value="action-items"
            className="flex items-center gap-1.5"
          >
            <ListChecks className="h-4 w-4" />
            Action Items
          </TabsTrigger>
        </TabsList>

        {/* Transcript Tab */}
        <TabsContent value="transcript" className="space-y-4 mt-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search in transcript..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Card>
            <CardContent className="pt-4">
              <pre className="text-sm bg-muted rounded-md p-4 whitespace-pre-wrap max-h-[60vh] overflow-auto">
                {renderedContent.split("<<HIGHLIGHT>>").map((part, i) => {
                  if (part.includes("<<ENDHIGHLIGHT>>")) {
                    const [highlighted, rest] = part.split("<<ENDHIGHLIGHT>>");
                    return (
                      <span key={i}>
                        <mark className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
                          {highlighted}
                        </mark>
                        {rest}
                      </span>
                    );
                  }
                  return <span key={i}>{part}</span>;
                })}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4 mt-4">
          {transcript.ai_summary ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {transcript.ai_summary}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No summary yet</p>
              <p className="text-sm mb-4">
                Generate an AI summary from the transcript content.
              </p>
              <Button
                onClick={handleGenerateSummary}
                disabled={generateSummary.isPending}
              >
                {generateSummary.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {generateSummary.isPending
                  ? "Generating..."
                  : "Generate Summary"}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Action Items Tab */}
        <TabsContent value="action-items" className="space-y-4 mt-4">
          {actionItemsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : actionItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ListChecks className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No action items</p>
              <p className="text-sm">
                No action items have been extracted from this transcript.
              </p>
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action Item</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[120px]">Assignee</TableHead>
                    <TableHead className="w-[120px]">Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actionItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.content}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            STATUS_COLORS[item.status] ||
                            "bg-gray-100 text-gray-800"
                          }
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.assignee?.full_name || "Unassigned"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.due_date
                          ? new Date(item.due_date).toLocaleDateString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
