import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useClient } from "@/hooks/useClients";
import { useClientMeetings } from "@/modules/meetings/hooks/useCrossModuleMeetings";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Handshake,
  Search,
  Loader2,
  BookOpen,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useState } from "react";

interface KnowledgeFile {
  id: string;
  title: string;
  file_name: string;
  file_type: string | null;
  created_at: string;
  processing_status: string;
}

interface Deal {
  id: string;
  title: string;
  status: string;
  value: number | null;
  created_at: string;
}

export default function ClientKnowledge() {
  const { clientId } = useParams<{ clientId: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const { data: client, isLoading: clientLoading } = useClient(clientId || "");
  const { data: meetings = [] } = useClientMeetings(clientId);

  // Fetch knowledge files related to client
  const { data: knowledgeFiles = [], isLoading: filesLoading } = useQuery({
    queryKey: ["client-knowledge-files", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unified_documents")
        .select("*")
        .eq("owner_type", "client")
        .eq("owner_id", clientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as KnowledgeFile[];
    },
    enabled: !!clientId,
  });

  // Fetch deals related to client
  const { data: deals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ["client-deals", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, title, stage, value, created_at")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({ ...d, status: d.stage })) as Deal[];
    },
    enabled: !!clientId,
  });

  // Fetch meeting transcripts
  const meetingsWithTranscripts = meetings.filter((m: any) => m.has_transcript);

  // Perform semantic search
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["client-semantic-search", clientId, searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 3) return [];

      const { data, error } = await supabase.functions.invoke("unified-knowledge-search", {
        body: {
          query: searchQuery,
          filters: {
            owner_type: "client",
            owner_id: clientId,
          },
          limit: 10,
        },
      });
      if (error) throw error;
      return data?.results || [];
    },
    enabled: !!clientId && searchQuery.length >= 3,
  });

  if (clientLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Client not found</p>
        <Button asChild>
          <Link to="/clients">Back to Clients</Link>
        </Button>
      </div>
    );
  }

  const allItems = [
    ...knowledgeFiles.map((f) => ({ ...f, type: "file" as const })),
    ...meetingsWithTranscripts.map((m: any) => ({ ...m, type: "meeting" as const })),
    ...deals.map((d) => ({ ...d, type: "deal" as const })),
  ].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const filteredItems =
    activeTab === "all"
      ? allItems
      : allItems.filter((item) => item.type === activeTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/clients/${clientId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {client.name} - Knowledge
            </h1>
            <p className="text-muted-foreground">
              All knowledge, documents, and insights for this client
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to={`/knowledge/search?client=${clientId}`}>
            <Sparkles className="mr-2 h-4 w-4" />
            Semantic Search
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allItems.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Files</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{knowledgeFiles.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meetings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meetingsWithTranscripts.length}
            </div>
            <p className="text-xs text-muted-foreground">
              with transcripts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deals</CardTitle>
            <Handshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deals.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Semantic Search</CardTitle>
          <CardDescription>
            Search across all client knowledge using AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ask anything about this client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {searchLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {searchResults && searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Search Results ({searchResults.length})
              </p>
              <div className="space-y-2">
                {searchResults.map((result: any, index: number) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">
                            {result.title || result.content?.substring(0, 50)}
                          </p>
                          <Badge variant="outline">
                            {(result.similarity * 100).toFixed(0)}% match
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {result.content}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Knowledge Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Client Knowledge</CardTitle>
          <CardDescription>
            Browse all knowledge organized by type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({allItems.length})</TabsTrigger>
              <TabsTrigger value="file">
                Files ({knowledgeFiles.length})
              </TabsTrigger>
              <TabsTrigger value="meeting">
                Meetings ({meetingsWithTranscripts.length})
              </TabsTrigger>
              <TabsTrigger value="deal">Deals ({deals.length})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4 space-y-4">
              {filesLoading || dealsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No {activeTab === "all" ? "items" : activeTab + "s"} found
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <Card key={`${item.type}-${item.id}`}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3 flex-1">
                          {item.type === "file" && (
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          )}
                          {item.type === "meeting" && (
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                          )}
                          {item.type === "deal" && (
                            <Handshake className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div className="flex-1">
                            <p className="font-medium">
                              {item.type === "file"
                                ? (item as any).title
                                : item.type === "meeting"
                                  ? (item as any).title
                                  : (item as any).title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDateTime(item.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{item.type}</Badge>
                          {item.type === "file" &&
                            (item as any).processing_status && (
                              <Badge
                                variant={
                                  (item as any).processing_status === "completed"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {(item as any).processing_status}
                              </Badge>
                            )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
