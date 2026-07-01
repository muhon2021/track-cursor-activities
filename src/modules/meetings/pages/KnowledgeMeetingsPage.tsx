/**
 * Knowledge Meetings Page
 *
 * Meetings view within the knowledge base context. Lists meetings
 * that have embeddings or AI summaries, with search and filter controls.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  BookOpen,
  Search,
  Brain,
  MessageSquare,
  Calendar,
  ExternalLink,
  Database,
} from "lucide-react";
import { useKnowledgeMeetings } from "../hooks/useKnowledgeMeetings";

export default function KnowledgeMeetingsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [hasEmbeddings, setHasEmbeddings] = useState(false);

  const { data: meetings = [], isLoading } = useKnowledgeMeetings({
    search: search.length >= 2 ? search : undefined,
    hasEmbeddings,
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Stats
  const total = meetings.length;
  const withEmbeddings = meetings.filter(
    (m) => m.embedding_status === "completed"
  ).length;
  const withSummary = meetings.filter((m) => m.ai_summary).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Knowledge Base - Meetings</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Meetings with AI summaries and embeddings available for knowledge
          retrieval.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Total in Knowledge Base</span>
            </div>
            <p className="text-2xl font-bold mt-1">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Database className="h-4 w-4" />
              <span className="text-sm">With Embeddings</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">
              {withEmbeddings}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm">With AI Summary</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-blue-600">
              {withSummary}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search meetings by title..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant={hasEmbeddings ? "default" : "outline"}
          size="sm"
          onClick={() => setHasEmbeddings(!hasEmbeddings)}
        >
          <Database className="h-4 w-4 mr-2" />
          Has Embeddings
          {hasEmbeddings && (
            <Badge variant="secondary" className="ml-2 text-xs">
              ON
            </Badge>
          )}
        </Button>
      </div>

      {/* Meeting Cards */}
      {meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <BookOpen className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">
            No meetings in knowledge base yet
          </p>
          <p className="text-sm">
            {search || hasEmbeddings
              ? "No meetings match your current filters."
              : "Meetings will appear here after they are processed with AI summaries or embeddings."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meetings.map((meeting) => (
            <Card key={meeting.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{meeting.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {meeting.scheduled_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(meeting.scheduled_at).toLocaleDateString(
                            undefined,
                            {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </span>
                      )}
                      {meeting.clients?.name && (
                        <Badge variant="secondary" className="text-xs">
                          {meeting.clients.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {meeting.embedding_status === "completed" && (
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        <Database className="h-3 w-3 mr-1" />
                        Embedded
                      </Badge>
                    )}
                    {meeting.ai_summary && (
                      <Badge className="bg-blue-100 text-blue-800 text-xs">
                        <Brain className="h-3 w-3 mr-1" />
                        Summary
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {meeting.ai_summary && (
                  <p className="text-sm text-muted-foreground">
                    {meeting.ai_summary.length > 150
                      ? meeting.ai_summary.substring(0, 150) + "..."
                      : meeting.ai_summary}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    navigate(
                      `/meetings/${meeting.slug || meeting.id}`
                    )
                  }
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Meeting
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
