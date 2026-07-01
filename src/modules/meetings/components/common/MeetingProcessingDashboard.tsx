/**
 * Meeting Processing Dashboard
 *
 * Dashboard card showing transcript processing statistics with counts
 * for total, processed, pending, and failed files, plus a progress bar.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";

export default function MeetingProcessingDashboard() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["meeting-files-processing-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_files")
        .select("processing_status");

      if (error) throw error;
      return data || [];
    },
  });

  const stats = useMemo(() => {
    if (!data) return { total: 0, processed: 0, pending: 0, failed: 0 };

    return {
      total: data.length,
      processed: data.filter((f) => f.processing_status === "completed").length,
      pending: data.filter(
        (f) =>
          f.processing_status === "pending" ||
          f.processing_status === "processing"
      ).length,
      failed: data.filter((f) => f.processing_status === "failed").length,
    };
  }, [data]);

  const progressPercent =
    stats.total > 0 ? Math.round((stats.processed / stats.total) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Files",
      value: stats.total,
      icon: <FileText className="h-5 w-5 text-muted-foreground" />,
    },
    {
      label: "Processed",
      value: stats.processed,
      icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    },
    {
      label: "Pending",
      value: stats.pending,
      icon: <Clock className="h-5 w-5 text-amber-600" />,
    },
    {
      label: "Failed",
      value: stats.failed,
      icon: <AlertCircle className="h-5 w-5 text-red-600" />,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Transcript Processing</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center rounded-lg border p-3"
            >
              {stat.icon}
              <span className="text-2xl font-bold mt-1">{stat.value}</span>
              <span className="text-xs text-muted-foreground">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Processing Progress</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
