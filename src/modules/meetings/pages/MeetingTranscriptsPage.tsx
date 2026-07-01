/**
 * Meeting Transcripts Page
 *
 * Lists meetings that have transcripts (aggregated from speaker turns),
 * with search and transcript preview. Links to meeting detail for full view.
 */

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import MeetingPendingAssignmentsPage from "./MeetingPendingAssignmentsPage";
import MeetingAiMatchResultsPage from "./MeetingAiMatchResultsPage";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Search,
  FileText,
  MessageSquare,
  Users,
  ExternalLink,
  Eye,
} from "lucide-react";
import { MeetingIntegrationBanner } from "@/components/common/MeetingIntegrationBanner";

interface TranscriptRow {
  meeting_id: string;
  meeting_title: string;
  meeting_date: string | null;
  speakers: string[];
  turn_count: number;
  content_preview: string;
  full_content: string;
  created_at: string;
}

function useMeetingTranscripts(search: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["meeting-transcripts-aggregated", search],
    queryFn: async (): Promise<TranscriptRow[]> => {
      // Fetch all transcript turns
      const { data: turns, error } = await supabase
        .from("meeting_transcripts")
        .select("meeting_id, speaker, content, created_at")
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!turns || turns.length === 0) return [];

      // Group by meeting_id
      const grouped = new Map<string, { speakers: Set<string>; turns: { speaker: string; content: string }[]; created_at: string }>();
      for (const t of turns) {
        if (!grouped.has(t.meeting_id)) {
          grouped.set(t.meeting_id, { speakers: new Set(), turns: [], created_at: t.created_at });
        }
        const g = grouped.get(t.meeting_id)!;
        if (t.speaker) g.speakers.add(t.speaker);
        g.turns.push({ speaker: t.speaker || "Unknown", content: t.content || "" });
      }

      // Fetch meeting details
      const meetingIds = [...grouped.keys()];
      const { data: meetings } = await supabase
        .from("meetings")
        .select("id, title, scheduled_at")
        .in("id", meetingIds);

      const meetingMap = new Map(
        (meetings || []).map((m) => [m.id, { title: m.title, date: m.scheduled_at }])
      );

      let rows: TranscriptRow[] = meetingIds.map((mid) => {
        const g = grouped.get(mid)!;
        const meeting = meetingMap.get(mid) || { title: "Unknown Meeting", date: null };
        const fullContent = g.turns.map((t) => `${t.speaker}: ${t.content}`).join("\n\n");
        return {
          meeting_id: mid,
          meeting_title: meeting.title,
          meeting_date: meeting.date,
          speakers: [...g.speakers],
          turn_count: g.turns.length,
          content_preview: fullContent.substring(0, 150) + (fullContent.length > 150 ? "…" : ""),
          full_content: fullContent,
          created_at: g.created_at,
        };
      });

      // Sort by date descending
      rows.sort((a, b) => {
        const da = a.meeting_date || a.created_at;
        const db = b.meeting_date || b.created_at;
        return new Date(db).getTime() - new Date(da).getTime();
      });

      // Apply search filter
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.meeting_title.toLowerCase().includes(q) ||
            r.full_content.toLowerCase().includes(q) ||
            r.speakers.some((s) => s.toLowerCase().includes(q))
        );
      }

      return rows;
    },
    enabled: !!user,
  });
}

export default function MeetingTranscriptsPage() {
  const [search, setSearch] = useState("");
  const [previewTranscript, setPreviewTranscript] = useState<TranscriptRow | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") || "transcripts";

  const setView = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === "transcripts") next.delete("view");
    else next.set("view", v);
    setSearchParams(next, { replace: true });
  };

  const { data: transcripts, isLoading } = useMeetingTranscripts(search);

  return (
    <Tabs value={view} onValueChange={setView} className="space-y-4">
      <TabsList>
        <TabsTrigger value="transcripts">Transcripts</TabsTrigger>
        <TabsTrigger value="pending">Pending Assignments</TabsTrigger>
        <TabsTrigger value="ai-match">AI Match Results</TabsTrigger>
      </TabsList>
      <TabsContent value="pending" className="mt-4"><MeetingPendingAssignmentsPage /></TabsContent>
      <TabsContent value="ai-match" className="mt-4"><MeetingAiMatchResultsPage /></TabsContent>
      <TabsContent value="transcripts" className="mt-4 space-y-4">
        <MeetingIntegrationBanner page="transcripts" />
        {isLoading ? (
          <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <TranscriptsContent
            transcripts={transcripts}
            search={search}
            setSearch={setSearch}
            previewTranscript={previewTranscript}
            setPreviewTranscript={setPreviewTranscript}
            navigate={navigate}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}

function TranscriptsContent({
  transcripts,
  search,
  setSearch,
  previewTranscript,
  setPreviewTranscript,
  navigate,
}: {
  transcripts: TranscriptRow[] | undefined;
  search: string;
  setSearch: (s: string) => void;
  previewTranscript: TranscriptRow | null;
  setPreviewTranscript: (t: TranscriptRow | null) => void;
  navigate: (path: string) => void;
}) {

  const total = (transcripts || []).length;
  const totalTurns = (transcripts || []).reduce((sum, t) => sum + t.turn_count, 0);
  const uniqueSpeakers = new Set((transcripts || []).flatMap((t) => t.speakers)).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meeting Transcripts</h1>
        <p className="text-muted-foreground">
          Browse and search through transcripts from recorded meetings.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span className="text-sm">Meetings with Transcripts</span>
            </div>
            <p className="text-2xl font-bold mt-1">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm">Total Speaker Turns</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalTurns}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-sm">Unique Speakers</span>
            </div>
            <p className="text-2xl font-bold mt-1">{uniqueSpeakers}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transcripts by meeting title, content, or speaker…"
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Transcript Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Meeting</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Speakers</TableHead>
              <TableHead>Turns</TableHead>
              <TableHead>Preview</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(transcripts || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No Transcripts</h3>
                  <p className="text-muted-foreground">
                    {search
                      ? "No transcripts match your search."
                      : "Meeting transcripts will appear here after recordings are processed."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              (transcripts || []).map((t) => (
                <TableRow key={t.meeting_id}>
                  <TableCell>
                    <button
                      className="font-medium text-primary hover:underline text-left"
                      onClick={() => navigate(`/meetings/${t.meeting_id}`)}
                    >
                      {t.meeting_title}
                    </button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.meeting_date
                      ? new Date(t.meeting_date).toLocaleDateString()
                      : new Date(t.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                      {t.speakers.slice(0, 3).map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                      {t.speakers.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{t.speakers.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{t.turn_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {t.content_preview}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewTranscript(t)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/meetings/${t.meeting_id}`)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewTranscript} onOpenChange={() => setPreviewTranscript(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{previewTranscript?.meeting_title}</DialogTitle>
          </DialogHeader>
          {previewTranscript?.speakers && previewTranscript.speakers.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-1">Speakers ({previewTranscript.speakers.length})</h4>
              <div className="flex gap-1 flex-wrap">
                {previewTranscript.speakers.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            </div>
          )}
          <div>
            <h4 className="text-sm font-semibold mb-1">
              Transcript ({previewTranscript?.turn_count} turns)
            </h4>
            <pre className="text-xs bg-muted rounded-md p-4 whitespace-pre-wrap max-h-96 overflow-auto">
              {previewTranscript?.full_content || "No transcript content available."}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
