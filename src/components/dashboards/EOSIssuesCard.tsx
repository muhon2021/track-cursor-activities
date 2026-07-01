import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useIssueStats } from "@/modules/eos/hooks/useEOSIssues";

interface StatCellProps {
  label: string;
  value: number;
  highlight?: "destructive" | "warning" | "muted";
}

function StatCell({ label, value, highlight }: StatCellProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={cn(
          "text-2xl font-bold tabular-nums",
          highlight === "destructive" && value > 0
            ? "text-destructive"
            : highlight === "warning" && value > 0
            ? "text-yellow-600 dark:text-yellow-400"
            : "text-foreground"
        )}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function EOSIssuesCard() {
  const { data: stats, isLoading } = useIssueStats();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            Issues
          </CardTitle>
          <Link
            to="/eos/issues"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Skeleton className="h-7 w-10" />
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 text-center">
            <StatCell label="Open" value={stats?.open ?? 0} />
            <StatCell label="In Progress" value={stats?.in_progress ?? 0} highlight="warning" />
            <StatCell label="Solved" value={stats?.solved ?? 0} />
            <StatCell label="Critical" value={stats?.critical ?? 0} highlight="destructive" />
          </div>
        )}

        {/* Progress bar: solved / total */}
        {!isLoading && stats && stats.total > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Resolution rate</span>
              <span>{Math.round((stats.solved / stats.total) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${Math.round((stats.solved / stats.total) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
