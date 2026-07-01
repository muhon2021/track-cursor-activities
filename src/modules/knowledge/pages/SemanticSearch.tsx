import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Brain,
  Loader2,
  ArrowRight,
  Sparkles,
  Hash,
  Clock,
  BarChart3,
} from "lucide-react";
import { useKnowledgeSearch } from "../hooks/useKnowledge";
import { useRecordKbSearch } from "@/hooks/useKbUserSearchHistory";
import { KbSearchResultSnippet } from "@/components/knowledge/search/KbSearchResultSnippet";
import { getConfidenceScore } from "@/lib/kb-confidence";
import type { KbSearchResultBase } from "@/types/knowledgeV2";

interface SemanticResult extends KbSearchResultBase {
  entity_type?: string;
  entity_id?: string;
}

export default function SemanticSearch() {
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"text" | "semantic">("semantic");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [lastReranked, setLastReranked] = useState(false);
  const recordSearch = useRecordKbSearch();

  const { data: textResults = [], isLoading: textLoading } = useKnowledgeSearch(
    searchMode === "text" ? query : ""
  );

  const semanticSearch = useMutation({
    mutationFn: async (searchQuery: string) => {
      const { data, error } = await supabase.functions.invoke("semantic-search", {
        body: {
          query: searchQuery,
          match_count: 20,
          match_threshold: 0.5,
        },
      });

      if (error) throw error;
      return {
        results: (data?.results || []) as SemanticResult[],
        reranked: Boolean(data?.reranked),
      };
    },
    onSuccess: (data, searchQuery) => {
      setLastReranked(data.reranked);
      recordSearch.mutate({
        query: searchQuery,
        platform: "web",
        result_count: data.results.length,
      });
    },
  });

  const handleSearch = () => {
    if (!query.trim() || query.length < 2) return;

    if (searchMode === "semantic") {
      semanticSearch.mutate(query);
    } else {
      recordSearch.mutate({
        query: query.trim(),
        platform: "web",
        result_count: textResults.length,
      });
    }

    setSearchHistory((prev) => {
      const filtered = prev.filter((h) => h !== query);
      return [query, ...filtered].slice(0, 10);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const isLoading = searchMode === "text" ? textLoading : semanticSearch.isPending;
  const semanticResults = semanticSearch.data?.results ?? [];
  const hasResults = searchMode === "text" ? textResults.length > 0 : semanticResults.length > 0;
  const hasSearched =
    searchMode === "text"
      ? query.length >= 2
      : semanticSearch.isSuccess || semanticSearch.isError;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            Semantic Search
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered search across your knowledge base using vector embeddings
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/knowledge">
            <ArrowRight className="mr-2 h-4 w-4" />
            Knowledge Base
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as "text" | "semantic")}>
            <TabsList>
              <TabsTrigger value="semantic" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Semantic Search
              </TabsTrigger>
              <TabsTrigger value="text" className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Text Search
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <CardDescription className="mt-2">
            {searchMode === "semantic"
              ? "Find content by meaning using AI embeddings. Results are ranked by semantic similarity."
              : "Find content by exact keyword matching in titles and content."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  searchMode === "semantic"
                    ? "Ask a question or describe what you're looking for..."
                    : "Search by keyword..."
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={isLoading || query.length < 2}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">Search</span>
            </Button>
          </div>

          {searchHistory.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              {searchHistory.slice(0, 5).map((h) => (
                <Badge
                  key={h}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent text-xs"
                  onClick={() => {
                    setQuery(h);
                    if (searchMode === "semantic") {
                      semanticSearch.mutate(h);
                    }
                  }}
                >
                  {h}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">
              {searchMode === "semantic"
                ? "Generating embedding and searching vector space..."
                : "Searching knowledge base..."}
            </p>
          </div>
        </div>
      )}

      {searchMode === "semantic" && !isLoading && hasSearched && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {semanticResults.length} Result{semanticResults.length !== 1 ? "s" : ""}
            </h2>
            {semanticResults.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                <span>
                  Top score:{" "}
                  {(
                    getConfidenceScore({
                      similarity: semanticResults[0]?.similarity ?? 0,
                      rerank_score: semanticResults[0]?.rerank_score,
                    }) * 100
                  ).toFixed(1)}
                  %
                </span>
              </div>
            )}
          </div>

          {semanticResults.length === 0 ? (
            <Card className="p-12 text-center">
              <Brain className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No semantic matches found</h3>
              <p className="text-muted-foreground">
                Try rephrasing your query or using different keywords.
                Semantic search works best with natural language questions.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {semanticResults.map((result, idx) => (
                <KbSearchResultSnippet
                  key={result.id || idx}
                  result={{
                    ...result,
                    metadata: {
                      ...result.metadata,
                      entity_id: result.metadata?.entity_id ?? result.entity_id,
                      title: result.metadata?.title,
                    },
                    reranked: lastReranked,
                  }}
                  reranked={lastReranked}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {searchMode === "text" && !textLoading && query.length >= 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {textResults.length} Result{textResults.length !== 1 ? "s" : ""}
          </h2>

          {textResults.length === 0 ? (
            <Card className="p-12 text-center">
              <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No results found</h3>
              <p className="text-muted-foreground">
                Try different keywords or switch to semantic search for AI-powered matching.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {textResults.map((entry) => (
                <Link key={entry.id} to={`/knowledge/${entry.id}`}>
                  <Card className="h-full hover:shadow-md transition-all">
                    <CardHeader>
                      <CardTitle className="line-clamp-2 text-base">
                        {entry.title}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {entry.status && (
                          <Badge variant="secondary" className="text-xs">
                            {entry.status}
                          </Badge>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {entry.summary || entry.content}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {!hasSearched && !isLoading && query.length < 2 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Natural Language
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Ask questions in plain English. The AI understands meaning, not just keywords.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Vector Similarity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Results are ranked by how closely they match the meaning of your query.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Confidence Scores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Each result shows a confidence tier (High / Medium / Low) at a glance.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
