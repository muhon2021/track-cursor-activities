import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RetentionPolicy {
  entity_type: string;
  retention_days: number;
}

const DEFAULT_RETENTION_POLICIES: RetentionPolicy[] = [
  { entity_type: "deal_details", retention_days: 365 }, // 1 year
  { entity_type: "deal_note", retention_days: 180 }, // 6 months
  { entity_type: "email_memory", retention_days: 90 }, // 3 months
  { entity_type: "conversation_summary", retention_days: 90 }, // 3 months
  { entity_type: "meeting_transcript", retention_days: 365 }, // 1 year
  { entity_type: "client_research", retention_days: 365 }, // 1 year
  { entity_type: "knowledge_entry", retention_days: -1 }, // Never delete (-1 means permanent)
  { entity_type: "user_knowledge", retention_days: -1 }, // Never delete
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { dry_run = false, custom_policies = [] } = await req.json();

    console.log(`Starting embedding retention cleanup (dry_run: ${dry_run})`);

    // Merge custom policies with defaults
    const policies = custom_policies.length > 0 ? custom_policies : DEFAULT_RETENTION_POLICIES;

    const results = {
      total_checked: 0,
      total_deleted: 0,
      by_entity_type: {} as Record<string, { checked: number; deleted: number }>,
      dry_run,
    };

    for (const policy of policies) {
      if (policy.retention_days === -1) {
        console.log(`Skipping ${policy.entity_type} (permanent retention)`);
        continue;
      }

      console.log(
        `Processing ${policy.entity_type} with ${policy.retention_days} days retention`
      );

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);
      const cutoffISOString = cutoffDate.toISOString();

      // Count embeddings to delete
      const { count, error: countError } = await supabase
        .from("embeddings")
        .select("*", { count: "exact", head: true })
        .eq("entity_type", policy.entity_type)
        .lt("created_at", cutoffISOString);

      if (countError) {
        console.error(`Error counting ${policy.entity_type}:`, countError);
        continue;
      }

      const embeddingsToDelete = count || 0;

      results.total_checked += embeddingsToDelete;
      results.by_entity_type[policy.entity_type] = {
        checked: embeddingsToDelete,
        deleted: 0,
      };

      if (embeddingsToDelete === 0) {
        console.log(`No ${policy.entity_type} embeddings to delete`);
        continue;
      }

      console.log(
        `Found ${embeddingsToDelete} ${policy.entity_type} embeddings older than ${cutoffISOString}`
      );

      if (!dry_run) {
        // Delete embeddings in batches of 1000
        let deletedCount = 0;
        let hasMore = true;

        while (hasMore) {
          const { data: toDelete, error: fetchError } = await supabase
            .from("embeddings")
            .select("id")
            .eq("entity_type", policy.entity_type)
            .lt("created_at", cutoffISOString)
            .limit(1000);

          if (fetchError) {
            console.error(`Error fetching ${policy.entity_type} for deletion:`, fetchError);
            break;
          }

          if (!toDelete || toDelete.length === 0) {
            hasMore = false;
            break;
          }

          const idsToDelete = toDelete.map((e: any) => e.id);

          const { error: deleteError } = await supabase
            .from("embeddings")
            .delete()
            .in("id", idsToDelete);

          if (deleteError) {
            console.error(`Error deleting ${policy.entity_type}:`, deleteError);
            break;
          }

          deletedCount += idsToDelete.length;
          console.log(`Deleted ${deletedCount}/${embeddingsToDelete} ${policy.entity_type} embeddings`);

          if (toDelete.length < 1000) {
            hasMore = false;
          }
        }

        results.total_deleted += deletedCount;
        results.by_entity_type[policy.entity_type].deleted = deletedCount;
      } else {
        console.log(
          `[DRY RUN] Would delete ${embeddingsToDelete} ${policy.entity_type} embeddings`
        );
      }
    }

    // Log cleanup activity
    if (!dry_run) {
      await supabase.from("activity_logs").insert({
        activity_type: "embedding_cleanup",
        entity_type: "embeddings",
        entity_id: null,
        description: `Cleaned up ${results.total_deleted} old embeddings`,
        metadata: {
          results,
          policies,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: dry_run
          ? `Would delete ${results.total_checked} embeddings`
          : `Deleted ${results.total_deleted} embeddings`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in embedding-retention-cleanup:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
