import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProductivityListResponse {
  success: boolean;
  data?: {
    data: unknown[];
    pagination: {
      page: number;
      limit: number;
      totalRecords: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
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

    let body: { page?: number; limit?: number; minThreashold?: number; maxThreashold?: number; location?: string; searchTerm?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const page = body.page ?? 1;
    const limit = body.limit ?? 50;
    const minThreshold = body.minThreashold ?? 0;
    const maxThreshold = body.maxThreashold ?? 250;
    const location = body.location ?? null;
    const searchTerm = body.searchTerm ?? null;
    const offset = (page - 1) * limit;

    const { data: latestWeekData } = await supabase.rpc("get_latest_productivity_week");
    const latestWeek = latestWeekData as string | null;

    if (!latestWeek) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            data: [],
            pagination: {
              page,
              limit,
              totalRecords: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          },
        } as ProductivityListResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    let query = supabase
      .from("EmployeeProductivity")
      .select("*", { count: "exact" })
      .eq("week", latestWeek)
      .gte("productivity_percentage", minThreshold)
      .lte("productivity_percentage", maxThreshold);

    if (location) {
      query = query.eq("location", location);
    }
    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, title")
      .eq("id", user.id)
      .single();

    if (profile?.title === "Manager") {
      const { data: reports } = await supabase.rpc("get_manager_reports", {
        manager_email: profile.email,
      });
      const reportEmails = (reports || []).map((r: { employee_email: string }) => r.employee_email);
      if (reportEmails.length > 0) {
        query = query.in("email", reportEmails);
      } else {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              data: [],
              pagination: { page, limit, totalRecords: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
            },
          } as ProductivityListResponse),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    const { data: excludedItems } = await supabase
      .from("ActionItem")
      .select("email")
      .eq("excludeFromScoring", true)
      .eq("week", latestWeek);

    const excludedEmails = (excludedItems || []).map((item: { email: string }) => item.email);
    if (excludedEmails.length > 0) {
      query = query.not("email", "in", `(${excludedEmails.join(",")})`);
    }

    const { data, error, count } = await query
      .order("productivity_percentage", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error("Failed to fetch productivity data");
    }

    const totalPages = count ? Math.ceil(count / limit) : 0;
    const response: ProductivityListResponse = {
      success: true,
      data: {
        data: data || [],
        pagination: {
          page,
          limit,
          totalRecords: count || 0,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in team-productivity-list:", error);
    const errorResponse: ProductivityListResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    return new Response(JSON.stringify(errorResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    });
  }
});
