import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Loader2, FileText, Users, Calendar, CheckSquare } from "lucide-react";
import { useSemanticSearch, SearchResult } from "@/hooks/useSemanticSearch";

interface SemanticSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResultClick?: (result: SearchResult) => void;
}

export function SemanticSearch({ open, onOpenChange, onResultClick }: SemanticSearchProps) {
  const {
    query,
    results,
    isSearching,
    search,
    clearResults,
    setQuery,
  } = useSemanticSearch();

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    await search(query);
  };

  const handleResultClick = (result: SearchResult) => {
    if (onResultClick) {
      onResultClick(result);
    }
    onOpenChange(false);
    clearResults();
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case "knowledge":
        return <FileText className="h-4 w-4" />;
      case "client":
        return <Users className="h-4 w-4" />;
      case "meeting":
        return <Calendar className="h-4 w-4" />;
      case "task":
        return <CheckSquare className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Semantic Search</DialogTitle>
          <DialogDescription>
            Search across clients, meetings, knowledge base, tasks, and more using AI-powered similarity
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What are you looking for?"
              disabled={isSearching}
              autoFocus
            />
            <Button type="submit" disabled={isSearching || !query.trim()}>
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>

        {/* Search Results */}
        <div className="mt-4 max-h-[400px] space-y-2 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 && query ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Search className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {query ? "No results found. Try a different query." : "Enter a search query to get started"}
              </p>
            </div>
          ) : (
            results.map((result) => (
              <div
                key={result.id}
                className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent cursor-pointer transition-colors"
                onClick={() => handleResultClick(result)}
              >
                <div className="mt-0.5">{getEntityIcon(result.entity_type)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {result.entity_type}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(result.similarity * 100)}% match
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm line-clamp-2">{result.content}</p>
                  {result.metadata && Object.keys(result.metadata).length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {JSON.stringify(result.metadata)}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
