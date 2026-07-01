import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetricsResponse {
  success: boolean;
  data?: {
    averageProductivity: number;
    totalEmployees: number;
    highPerformers: number;
    averagePerformers: number;
    lowPerformers: number;
    week: string;
  };
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: metrics, error: metricsError } = await supabase.rpc(
      "get_productivity_metrics",
      { target_week: null }
    );

    if (metricsError) {
      console.error("Error fetching metrics:", metricsError);
      throw new Error("Failed to fetch productivity metrics");
    }

    const row = Array.isArray(metrics) ? metrics[0] : metrics;
    const response: MetricsResponse = {
      success: true,
      data: {
        averageProductivity: row?.average_productivity ?? 0,
        totalEmployees: Number(row?.total_employees ?? 0),
        highPerformers: Number(row?.high_performers ?? 0),
        averagePerformers: Number(row?.average_performers ?? 0),
        lowPerformers: Number(row?.low_performers ?? 0),
        week: row?.week ?? "",
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in team-productivity-metrics:", error);
    const errorResponse: MetricsResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    return new Response(JSON.stringify(errorResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    });
  }
});
