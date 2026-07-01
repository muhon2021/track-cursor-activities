import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, cacheConfig } from "@/lib/cache";
import { useAuth } from "@/contexts/AuthContext";

interface QuarterlyDigest {
  executive_summary: string;
  highlights: string[];
  risks: string[];
  recommendations: string[];
  metrics_summary?: string;
  okr_assessment?: string;
}

interface DigestResponse {
  digest: QuarterlyDigest;
  quarter: string;
  stats: {
    issues: { total: number; resolved: number; critical: number };
    okrs: { total: number; completed: number; atRisk: number; avgProgress: number };
    meetings: number;
  };
}

function currentQuarterLabel(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${q} ${now.getFullYear()}`;
}

function Section({
  icon: Icon,
  title,
  items,
  iconClass,
}: {
  icon: React.ElementType;
  title: string;
  items: string[];
  iconClass?: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", iconClass)} />
        {title}
      </h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AIDigestCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const quarter = currentQuarterLabel();
  const [expanded, setExpanded] = useState(false);

  const digestQueryKey = queryKeys.dashboard.aiDigest(user?.id ?? "");

  const {
    data,
    isLoading,
    isError,
    isFetching,
  } = useQuery<DigestResponse>({
    queryKey: digestQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("quarterly-digest", {
        body: { quarter },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as DigestResponse;
    },
    staleTime: cacheConfig.staleTime.veryLong, // cache 1 hour — expensive AI call
    enabled: !!user,
    retry: 1,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: digestQueryKey });
  };

  return (
    <Card className="border-ai-glow/20 bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-violet-500" />
            AI Digest
            <span className="text-xs font-normal text-muted-foreground">· {quarter}</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRefresh}
            disabled={isFetching}
            title="Refresh digest"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ) : isError ? (
          <div className="rounded-lg bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              Unable to generate digest. This may be due to missing AI configuration.
            </p>
            <Button variant="ghost" size="sm" onClick={handleRefresh} className="mt-2 h-7 text-xs">
              Try again
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Stats row */}
            {data.stats && (
              <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3 text-center text-xs">
                <div>
                  <p className="font-semibold tabular-nums text-sm">{data.stats.issues.total}</p>
                  <p className="text-muted-foreground">issues</p>
                </div>
                <div>
                  <p className={cn("font-semibold tabular-nums text-sm", data.stats.okrs.avgProgress >= 70 ? "text-green-600" : "text-yellow-600")}>
                    {data.stats.okrs.avgProgress}%
                  </p>
                  <p className="text-muted-foreground">OKR progress</p>
                </div>
                <div>
                  <p className="font-semibold tabular-nums text-sm">{data.stats.meetings}</p>
                  <p className="text-muted-foreground">meetings</p>
                </div>
              </div>
            )}

            {/* Executive summary */}
            <p className="text-sm leading-relaxed">{data.digest.executive_summary}</p>

            {/* Expandable detail */}
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" /> Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" /> Show highlights, risks & recommendations
                </>
              )}
            </button>

            {expanded && (
              <div className="space-y-4 border-t border-border/50 pt-3">
                <Section
                  icon={TrendingUp}
                  title="Highlights"
                  items={data.digest.highlights}
                  iconClass="text-green-500"
                />
                <Section
                  icon={AlertTriangle}
                  title="Risks"
                  items={data.digest.risks}
                  iconClass="text-yellow-500"
                />
                <Section
                  icon={Lightbulb}
                  title="Recommendations"
                  items={data.digest.recommendations}
                  iconClass="text-violet-500"
                />
                {data.digest.okr_assessment && (
                  <div className="rounded-md bg-muted/50 p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">OKR Assessment</p>
                    <p className="text-sm">{data.digest.okr_assessment}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
