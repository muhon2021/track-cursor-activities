import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FlaskConical, Save } from "lucide-react";
import { useKbRagPlayground } from "@/hooks/useKbRagPlayground";
import { useKbSourceConfigs } from "@/hooks/useKbSourceConfig";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KbSearchResultSnippet } from "@/components/knowledge/search/KbSearchResultSnippet";
import { KbRerankBadge } from "@/components/knowledge/search/KbRerankBadge";
import { useOrganization } from "@/contexts/OrganizationContext";

export default function KnowledgePlayground() {
  const [query, setQuery] = useState("");
  const [sourceId, setSourceId] = useState<string>("");
  const [expectedAnswer, setExpectedAnswer] = useState("");
  const playground = useKbRagPlayground();
  const { data: sources } = useKbSourceConfigs();
  const org = useOrganization();
  const result = playground.data;

  const runQuery = (saveRun = false, saveTest = false) => {
    if (!query.trim()) return;
    playground.mutate({
      query: query.trim(),
      source_id: sourceId || undefined,
      save_run: saveRun,
      save_test_case: saveTest,
      expected_answer: expectedAnswer || undefined,
    });
  };

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FlaskConical className="h-8 w-8 text-primary" />
          RAG Playground
        </h1>
        <p className="text-muted-foreground mt-1">Inspect retrieval quality and evaluate RAG responses</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Query</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-3 space-y-2">
              <Label>Search Query</Label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Enter a test query..." />
            </div>
            <div className="space-y-2">
              <Label>Source (optional)</Label>
              <Select value={sourceId || "__all__"} onValueChange={(v) => setSourceId(v === "__all__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="All sources" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All sources</SelectItem>
                  {(sources ?? []).map(({ source }) => (
                    <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Expected Answer (for test cases)</Label>
            <Textarea value={expectedAnswer} onChange={(e) => setExpectedAnswer(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => runQuery()} disabled={playground.isPending}>
              {playground.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Run Query
            </Button>
            <Button variant="outline" onClick={() => runQuery(true, true)} disabled={playground.isPending}>
              <Save className="h-4 w-4 mr-1" /> Save Evaluation
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Retrieval", value: `${result.metrics.retrieval_latency_ms}ms` },
              { label: "Rerank", value: `${result.metrics.rerank_latency_ms}ms` },
              { label: "Generation", value: `${result.metrics.generation_latency_ms}ms` },
              { label: "Total Cost", value: `$${result.metrics.total_cost.toFixed(6)}` },
            ].map((m) => (
              <Card key={m.label}><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{m.label}</p><p className="text-xl font-bold">{m.value}</p></CardContent></Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Retrieved Chunks
                {org.features.enableKbCohere && result.reranked_results?.length ? (
                  <KbRerankBadge reranked />
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.retrieved_chunks.map((c) => (
                <KbSearchResultSnippet
                  key={c.chunk_id}
                  result={{
                    id: c.chunk_id,
                    content: c.content,
                    similarity: c.similarity_score,
                    rerank_score: c.rerank_score,
                    reranked: org.features.enableKbCohere && !!c.rerank_score,
                    metadata: {
                      title: c.source,
                      chunk_layout_type: (c as { metadata?: { chunk_layout_type?: string } }).metadata?.chunk_layout_type,
                    },
                  }}
                  reranked={org.features.enableKbCohere && !!c.rerank_score}
                  maxContentLength={400}
                />
              ))}
            </CardContent>
          </Card>

          {result.answer && (
            <Card>
              <CardHeader><CardTitle>Generated Answer</CardTitle><CardDescription>Sources: {result.citations.map((c) => `[${c.index}]`).join(", ")}</CardDescription></CardHeader>
              <CardContent><p className="whitespace-pre-wrap">{result.answer}</p></CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
