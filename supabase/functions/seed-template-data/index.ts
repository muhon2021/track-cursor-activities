import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { options } = requestBody;
    const results: any = {
      success: true,
      seeded: [],
      errors: [],
    };

    // Seed AI Agents if requested
    if (options?.seedAIAgents) {
      const defaultAgents = [
        {
          name: "Meeting Summarizer",
          description: "Automatically summarizes meeting transcripts and extracts key points",
          persona: "professional meeting analyst",
          capabilities: ["summarization", "action-item-extraction"],
          is_active: true,
          is_template: true,
        },
        {
          name: "Document Analyzer",
          description: "Analyzes uploaded documents and extracts insights",
          persona: "analytical document expert",
          capabilities: ["document-analysis", "content-extraction"],
          is_active: true,
          is_template: true,
        },
        {
          name: "Research Assistant",
          description: "Helps with research by searching knowledge base and providing insights",
          persona: "helpful research assistant",
          capabilities: ["knowledge-search", "research-support"],
          is_active: true,
          is_template: true,
        },
        {
          name: "Task Generator",
          description: "Converts meeting notes and documents into actionable tasks",
          persona: "task-oriented project manager",
          capabilities: ["task-generation", "prioritization"],
          is_active: true,
          is_template: true,
        },
      ];

      for (const agent of defaultAgents) {
        const { error } = await supabase.from("ai_agents").upsert(agent, {
          onConflict: "name",
        });

        if (error) {
          results.errors.push(`Failed to seed agent ${agent.name}: ${error.message}`);
        } else {
          results.seeded.push(`AI Agent: ${agent.name}`);
        }
      }
    }

    // Seed Knowledge Categories if requested
    if (options?.seedKnowledgeCategories) {
      const defaultCategories = [
        {
          name: "Company Policies",
          description: "Internal policies and procedures",
          color: "#3b82f6",
        },
        {
          name: "Product Documentation",
          description: "Technical documentation and user guides",
          color: "#8b5cf6",
        },
        {
          name: "Meeting Notes",
          description: "Notes and summaries from meetings",
          color: "#10b981",
        },
        {
          name: "Research",
          description: "Research papers and industry insights",
          color: "#f59e0b",
        },
        {
          name: "Training Materials",
          description: "Educational content and training resources",
          color: "#ef4444",
        },
      ];

      for (const category of defaultCategories) {
        const { error } = await supabase.from("knowledge_categories").upsert(category, {
          onConflict: "name",
        });

        if (error) {
          results.errors.push(
            `Failed to seed category ${category.name}: ${error.message}`
          );
        } else {
          results.seeded.push(`Knowledge Category: ${category.name}`);
        }
      }
    }

    // Seed Sample Data if requested (demo clients, meetings, etc.)
    if (options?.seedSampleData) {
      // Add sample client
      const { data: userData } = await supabase.auth.admin.listUsers();
      const adminUser = userData?.users.find((u: any) =>
        u.user_metadata?.role === "admin"
      );

      if (adminUser) {
        const sampleClient = {
          name: "Demo Client Corp",
          email: "contact@democlient.com",
          phone: "+1-555-0100",
          company: "Demo Client Corporation",
          status: "active",
          created_by: adminUser.id,
        };

        const { error } = await supabase.from("clients").upsert(sampleClient, {
          onConflict: "email",
        });

        if (error) {
          results.errors.push(`Failed to seed sample client: ${error.message}`);
        } else {
          results.seeded.push("Sample Client: Demo Client Corp");
        }
      }
    }

    // Mark seeding as completed
    if (results.seeded.length > 0) {
      await supabase
        .from("app_config")
        .upsert(
          {
            key: "system.templateDataSeeded",
            value: true,
            category: "system",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
