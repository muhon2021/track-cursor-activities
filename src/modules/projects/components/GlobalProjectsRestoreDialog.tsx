import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, History } from "lucide-react";

interface GlobalRunSummary {
  created_at: string;
  backup_count: number;
}

/**
 * GlobalProjectsRestoreDialog
 *
 * Single restore control for all projects. It lets the user
 * choose a backup run (grouped by created_at) and then calls
 * a Supabase Edge Function to perform the restore on the server.
 */
export function GlobalProjectsRestoreDialog() {
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery({
    queryKey: ["project-backups-global-runs"],
    queryFn: async (): Promise<GlobalRunSummary[]> => {
      const { data, error } = await supabase
        .from("project_backups")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const grouped = new Map<string, number>();
      (data || []).forEach((row: any) => {
        const ts = row.created_at;
        if (!ts) return;
        const key = ts;
        grouped.set(key, (grouped.get(key) || 0) + 1);
      });

      return Array.from(grouped.entries()).map(([created_at, backup_count]) => ({
        created_at,
        backup_count,
      }));
    },
  });

  const [selectedTs, setSelectedTs] = React.useState<string | null>(null);
  const [restoring, setRestoring] = React.useState(false);

  async function handleRestore() {
    if (!selectedTs) return;
    setRestoring(true);
    try {
      const { error } = await supabase.functions.invoke("restore-projects-from-backup", {
        body: { created_at: selectedTs },
      });
      if (error) throw error;
      toast({
        title: "Restore triggered",
        description:
          "The restore-projects-from-backup function was invoked. Monitor Supabase logs for progress.",
      });
    } catch (err: any) {
      toast({
        title: "Failed to trigger restore",
        description: err?.message || "Unknown error when calling restore-projects-from-backup.",
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
    }
  }

  const runs = data || [];

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="mr-1 h-4 w-4" />
          Restore all
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore all projects from backup?</AlertDialogTitle>
          <AlertDialogDescription>
            Choose a backup run (by timestamp) and restore all projects to the state they had
            at that time. This relies on the <code>restore-projects-from-backup</code> Edge
            Function being deployed in Supabase.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2 text-sm">
          {isLoading && (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading backup runs…
            </p>
          )}

          {error && (
            <p className="text-xs text-red-500">
              Failed to load backup runs: {error.message}
            </p>
          )}

          {!isLoading && !error && runs.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No backup runs found yet. Use the <strong>Backup all</strong> button on the Projects
              page to create a global backup before restoring.
            </p>
          )}

          {!isLoading && !error && runs.length > 0 && (
            <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border px-3 py-2">
              {runs.map((run) => (
                <label
                  key={run.created_at}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-muted text-xs"
                >
                  <input
                    type="radio"
                    name="backup-run"
                    value={run.created_at}
                    checked={selectedTs === run.created_at}
                    onChange={() => setSelectedTs(run.created_at)}
                  />
                  <div className="flex flex-col">
                    <span className="font-mono text-foreground">
                      {new Date(run.created_at).toLocaleString()}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {run.backup_count} project snapshot
                      {run.backup_count === 1 ? "" : "s"}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!selectedTs || restoring || runs.length === 0}
            onClick={handleRestore}
          >
            {restoring ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Restoring…
              </span>
            ) : (
              "Restore selected run"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
