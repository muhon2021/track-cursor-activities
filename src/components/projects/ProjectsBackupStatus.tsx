import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Database, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface ProjectsBackupStatusProps {
  lastBackupAt?: string | null;
  projectCount?: number | null;
  onBackup?: () => void;
  backupPending?: boolean;
  /** Optional slot for Restore button/dialog (e.g. ProjectsRestoreBackupDialog) */
  restoreSlot?: React.ReactNode;
}

export function ProjectsBackupStatus({
  lastBackupAt: lastBackupAtProp,
  projectCount: projectCountProp,
  onBackup,
  backupPending,
  restoreSlot,
}: ProjectsBackupStatusProps) {
  const { data: summary, isLoading, error } = useQuery({
    queryKey: ["project-backups-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_backups")
        .select("id, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = data || [];
      const latest = rows[0] as { created_at: string } | undefined;
      const latestTs = latest?.created_at;
      const sameRunCount = latestTs
        ? rows.filter((r: { created_at: string }) => r.created_at?.slice(0, 19) === latestTs.slice(0, 19)).length
        : 0;
      return {
        lastBackupAt: latestTs || null,
        projectCount: sameRunCount,
        total: rows.length,
      };
    },
  });

  const lastBackupAt = lastBackupAtProp ?? summary?.lastBackupAt ?? null;
  const projectCount = projectCountProp ?? summary?.projectCount ?? 0;

  return (
    <div className="flex items-center justify-between gap-4 border-t pt-3 mt-1 px-0">
      <div className="flex items-center gap-3 min-w-0">
        {isLoading && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        )}
        {!isLoading && (lastBackupAt || summary) && (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-500" />
        )}
        <div className="min-w-0">
          {isLoading && (
            <span className="text-sm text-muted-foreground">Loading backup status…</span>
          )}
          {error && (
            <span className="text-sm text-destructive">Failed to load backup status</span>
          )}
          {!isLoading && !error && (
            <>
              <span className="text-sm text-foreground">
                Last Projects Backup: {lastBackupAt ? format(new Date(lastBackupAt), "MMM dd, yyyy 'at' h:mm a") : "Never"}
              </span>
              {projectCount > 0 && (
                <span className="text-sm text-muted-foreground ml-1">{projectCount} projects</span>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onBackup}
          disabled={backupPending}
        >
          {backupPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Database className="h-4 w-4 mr-1" />}
          Backup
        </Button>
        {restoreSlot}
      </div>
    </div>
  );
}
