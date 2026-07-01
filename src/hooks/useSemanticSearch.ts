import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SearchResult {
  id: string;
  entity_type: string;
  entity_id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  rerank_score?: number;
  reranked?: boolean;
}

export interface SemanticSearchOptions {
  match_threshold?: number;
  match_count?: number;
  entity_types?: string[];
}

export function useSemanticSearch() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = async (
    searchQuery: string,
    options: SemanticSearchOptions = {}
  ) => {
    if (!searchQuery.trim() || !user) {
      toast.error("Please enter a search query");
      return [];
    }

    setIsSearching(true);
    setQuery(searchQuery);

    try {
      const { data, error } = await supabase.functions.invoke("semantic-search", {
        body: {
          query: searchQuery,
          match_threshold: options.match_threshold || 0.5,
          match_count: options.match_count || 10,
          user_id: user.id,
          entity_types: options.entity_types,
        },
      });

      if (error) throw error;

      const searchResults = data.results || [];
      setResults(searchResults);

      if (searchResults.length === 0) {
        toast.info("No results found");
      }

      return searchResults;
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error("Search failed. Ensure semantic-search function is deployed.");
      setResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    setQuery("");
  };

  return {
    query,
    results,
    isSearching,
    search,
    clearResults,
    setQuery,
  };
}

export function getEntityIcon(entityType: string) {
  const iconMap: Record<string, string> = {
    knowledge: "FileText",
    client: "Users",
    meeting: "Calendar",
    task: "CheckSquare",
  };
  return iconMap[entityType] || "FileText";
}
