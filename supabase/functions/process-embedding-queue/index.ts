import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveEntityContent } from "../_shared/entity-content-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmbeddingQueueItem {
  id: string;
  entity_type: string;
  entity_id: string;
  priority: number;
  retry_count: number;
  status: string;
  error_message?: string;
  created_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { batch_size = 10 } = await req.json().catch(() => ({ batch_size: 10 }));
    const validBatchSize = Math.min(Math.max(1, batch_size), 50);

    const { data: queueItems, error: fetchError } = await supabase
      .from("embedding_queue")
      .select("*")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(validBatchSize);

    if (fetchError) throw fetchError;

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending items", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = { processed: 0, succeeded: 0, failed: 0, errors: [] as string[] };

    for (const item of queueItems as EmbeddingQueueItem[]) {
      try {
        await supabase.from("embedding_queue").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", item.id);

        const resolved = await resolveEntityContent(supabase, item.entity_type, item.entity_id);
        if (!resolved?.content) {
          throw new Error(`Could not resolve content for ${item.entity_type}:${item.entity_id}`);
        }

        const { error: embeddingError } = await supabase.functions.invoke("generate-embeddings", {
          body: {
            entity_type: item.entity_type,
            entity_id: item.entity_id,
            content: resolved.content,
            metadata: resolved.metadata,
            user_id: resolved.user_id,
            source_id: resolved.source_id,
            unified_document_id: resolved.unified_document_id,
          },
        });

        if (embeddingError) throw embeddingError;

        await supabase.from("embedding_queue").update({
          status: "completed",
          updated_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", item.id);

        results.processed++;
        results.succeeded++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const newRetryCount = item.retry_count + 1;
        const newStatus = newRetryCount >= 3 ? "failed" : "pending";

        await supabase.from("embedding_queue").update({
          status: newStatus,
          retry_count: newRetryCount,
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        }).eq("id", item.id);

        results.processed++;
        results.failed++;
        results.errors.push(`${item.entity_type}:${item.entity_id} - ${errorMessage}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
