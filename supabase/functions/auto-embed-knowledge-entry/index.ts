import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Auto-embed knowledge entry function
 * Automatically generates embeddings for knowledge base entries
 * Called via database trigger or manually
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { entry_id, batch_mode = false } = await req.json();

    // Get entries to process
    let query = supabaseClient
      .from("knowledge_entries")
      .select("*")
      .eq("status", "published");

    if (entry_id) {
      // Process single entry
      query = query.eq("id", entry_id);
    } else {
      // Process pending entries in batch mode
      query = query.eq("embedding_status", "pending").limit(10);
    }

    const { data: entries, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    if (!entries || entries.length === 0) {
      return new Response(
        JSON.stringify({
          message: entry_id
            ? "Entry not found or already processed"
            : "No pending entries to process",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processedCount = 0;
    let graphifySynced = 0;
    const results = [];

    // Get the default embedding model from ai_models table
    const { data: defaultModel } = await supabaseClient
      .from("ai_models")
      .select("id, name, provider")
      .eq("is_default_embedding", true)
      .eq("is_active", true)
      .single();

    for (const entry of entries) {
      try {
        // Mark as processing
        await supabaseClient
          .from("knowledge_entries")
          .update({ embedding_status: "processing" })
          .eq("id", entry.id);

        // Prepare content for embedding
        // Combine title and content with section markers
        const fullContent = `# ${entry.title}\n\n${entry.content}`;

        // Add summary if available
        const contentToEmbed = entry.summary
          ? `Summary: ${entry.summary}\n\n${fullContent}`
          : fullContent;

        // Generate embeddings using the shared function
        const embeddingResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-embeddings`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get(
                "SUPABASE_SERVICE_ROLE_KEY"
              )}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              entity_type: "knowledge_entry",
              entity_id: entry.id,
              content: contentToEmbed,
              metadata: {
                title: entry.title,
                slug: entry.slug,
                category_id: entry.category_id,
                tags: entry.tags,
              },
              user_id: entry.author_id,
              model_id: defaultModel?.id,
              chunk_size: 1000, // Larger chunks for knowledge entries
            }),
          }
        );

        if (embeddingResponse.ok) {
          const result = await embeddingResponse.json();

          // Update entry with embedding stats
          await supabaseClient
            .from("knowledge_entries")
            .update({
              embedding_status: "completed",
              embedding_count: result.embeddings_created,
              last_embedded_at: new Date().toISOString(),
            })
            .eq("id", entry.id);

          processedCount++;
          if (result.graphify && !result.graphify.skipped) {
            graphifySynced++;
          }
          results.push({
            entry_id: entry.id,
            title: entry.title,
            success: true,
            chunks_created: result.embeddings_created,
            model_used: result.model_used,
            graphify: result.graphify,
          });
        } else {
          throw new Error(
            `Embedding generation failed: ${await embeddingResponse.text()}`
          );
        }
      } catch (error: unknown) {
        console.error(`Error processing entry ${entry.id}:`, error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        // Mark entry as failed
        await supabaseClient
          .from("knowledge_entries")
          .update({
            embedding_status: "failed",
            metadata: {
              ...entry.metadata,
              last_embedding_error: errorMessage,
              last_embedding_attempt: new Date().toISOString(),
            },
          })
          .eq("id", entry.id);

        results.push({
          entry_id: entry.id,
          title: entry.title,
          success: false,
          error: errorMessage,
        });
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed_count: processedCount,
        total_found: entries.length,
        graphify_synced: graphifySynced,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Auto embed knowledge entry error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
