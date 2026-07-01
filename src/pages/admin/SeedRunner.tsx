/**
 * Seed Data Runner — /admin/roadmap/seed
 *
 * Admin-only page to execute seed SQL files against the database.
 * Reads seed SQL files from supabase/seed/ (imported at build time),
 * sends them to the run-seed edge function for execution.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Database,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  PlayCircle,
  Clock,
  FileCode2,
  AlertTriangle,
  Copy,
  Check,
  Zap,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ── Seed SQL imports (Vite ?raw) ──────────────────────────────────────────────
import seed00 from "../../../supabase/seed/00-platform-core.sql?raw";
import seed01 from "../../../supabase/seed/01-actions.sql?raw";
import seed02 from "../../../supabase/seed/02-eos.sql?raw";
import seed03 from "../../../supabase/seed/03-meetings.sql?raw";
import seed04 from "../../../supabase/seed/04-knowledge.sql?raw";
import seed05 from "../../../supabase/seed/05-projects.sql?raw";
import seed05b from "../../../supabase/seed/05b-project-client-access.sql?raw";
import seed05c from "../../../supabase/seed/05c-project-module-settings.sql?raw";
import seed06 from "../../../supabase/seed/06-business-dev.sql?raw";
import seed07 from "../../../supabase/seed/07-productivity.sql?raw";
import seed07b from "../../../supabase/seed/07b-productivity-base.sql?raw";
import seed08 from "../../../supabase/seed/08-ai-agents.sql?raw";
import seed11 from "../../../supabase/seed/11-demo-refresh.sql?raw";

// ── Seed file metadata ────────────────────────────────────────────────────────

interface SeedFile {
  id: string;
  name: string;
  fileName: string;
  description: string;
  module: string;
  sql: string;
  dependencies: string[];
}

const SEED_FILES: SeedFile[] = [
  {
    id: "00",
    name: "Platform Core",
    fileName: "00-platform-core.sql",
    description: "Clients, app modules, system settings, feature flags, notifications, activity logs, feedback",
    module: "platform",
    sql: seed00,
    dependencies: [],
  },
  {
    id: "01",
    name: "Actions",
    fileName: "01-actions.sql",
    description: "Task streams, categories, 20 tasks with assignments, comments, stream members",
    module: "actions",
    sql: seed01,
    dependencies: ["00"],
  },
  {
    id: "02",
    name: "EOS",
    fileName: "02-eos.sql",
    description: "Pods, V/TO, OKRs with key results, issues, scorecards, accountability chart, GWC",
    module: "eos",
    sql: seed02,
    dependencies: ["00"],
  },
  {
    id: "03",
    name: "Meetings",
    fileName: "03-meetings.sql",
    description: "Meeting series, 6 meetings, participants, agenda items, takeaways, transcripts",
    module: "meetings",
    sql: seed03,
    dependencies: ["00"],
  },
  {
    id: "04",
    name: "Knowledge Base",
    fileName: "04-knowledge.sql",
    description: "Categories, articles, sources, common knowledge entries",
    module: "knowledge",
    sql: seed04,
    dependencies: ["00"],
  },
  {
    id: "05",
    name: "Projects",
    fileName: "05-projects.sql",
    description: "Project statuses, 4 projects, members, milestones, comments, risks, billing, invoices",
    module: "projects",
    sql: seed05,
    dependencies: ["00"],
  },
  {
    id: "05b",
    name: "Project Client Access",
    fileName: "05b-project-client-access.sql",
    description: "Client portal demo access for Acme Corp — Platform Rollout",
    module: "projects",
    sql: seed05b,
    dependencies: ["05"],
  },
  {
    id: "05c",
    name: "Project Module Settings",
    fileName: "05c-project-module-settings.sql",
    description: "Project detail tab toggles: tasks, integrations, client portal, checklist, risks, files, finance",
    module: "projects",
    sql: seed05c,
    dependencies: ["05"],
  },
  {
    id: "06",
    name: "Business Dev",
    fileName: "06-business-dev.sql",
    description: "Contacts, deals pipeline, activities, lead follow-ups, communications, scheduled emails",
    module: "business-dev",
    sql: seed06,
    dependencies: ["00"],
  },
  {
    id: "07",
    name: "Productivity",
    fileName: "07-productivity.sql",
    description: "Departments, pods, employees, productivity records, leave events, process docs, alerts",
    module: "productivity",
    sql: seed07,
    dependencies: ["00"],
  },
  {
    id: "07b",
    name: "Productivity Base (Path B)",
    fileName: "07b-productivity-base.sql",
    description: "Employee, ActionItem, EmployeeProductivity for base-project parity (CSV import)",
    module: "productivity",
    sql: seed07b,
    dependencies: ["00"],
  },
  {
    id: "08",
    name: "AI Agents",
    fileName: "08-ai-agents.sql",
    description: "Providers, models, 5 agents, sample chat history, usage logs",
    module: "ai-agents",
    sql: seed08,
    dependencies: ["00"],
  },
  {
    id: "11",
    name: "Demo Data Refresh",
    fileName: "11-demo-refresh.sql",
    description: "Refreshes relative-date demo data: 2 deals, 5 productivity records, 4 meetings, 3 projects in-progress. Safe to re-run weekly.",
    module: "platform",
    sql: seed11,
    dependencies: ["00", "05", "06", "07"],
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type RunStatus = "idle" | "running" | "success" | "error";

interface SeedRunState {
  status: RunStatus;
  durationMs?: number;
  error?: string;
}

// ── Helper: execute a single seed ─────────────────────────────────────────────

async function executeSeed(
  sql: string,
  fileName: string,
): Promise<{ success: boolean; durationMs: number; error?: string }> {
  // Ensure we have a valid session and pass JWT explicitly (avoids 401 Invalid JWT from expired/missing token)
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return {
      success: false,
      durationMs: 0,
      error: "Not signed in. Log in on this app (e.g. with demo or admin credentials) and retry.",
    };
  }
  // Refresh session so the access_token is not expired (client autoRefreshToken may not have run yet)
  const { data: { session: refreshed } } = await supabase.auth.refreshSession();
  const token = refreshed?.access_token ?? session.access_token;

  const { data, error } = await supabase.functions.invoke("run-seed", {
    body: { sql, fileName },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // On 500/non-2xx, Supabase sets error; response body may still be in data
  if (error) {
    let message =
      (data && typeof data === "object" && "error" in data && String((data as { error?: unknown }).error)) ||
      error.message;
    if (message.includes("Invalid JWT") || message.includes("401"))
      message = `${message} Log in again on this app so your token matches this project (demo/admin user must exist in this project’s Auth).`;
    return { success: false, durationMs: (data as { durationMs?: number })?.durationMs ?? 0, error: message };
  }

  return {
    success: Boolean(data?.success),
    durationMs: (data?.durationMs ?? 0) as number,
    error: data?.error != null ? String(data.error) : undefined,
  };
}

// ── Seed File Card Component ──────────────────────────────────────────────────

const DEFAULT_STATE: SeedRunState = { status: "idle" };

function SeedFileCard({
  seed,
  state,
  onRun,
  expanded,
  onToggle,
}: {
  seed: SeedFile;
  state: SeedRunState | undefined;
  onRun: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const safeState = state ?? DEFAULT_STATE;
  const [copied, setCopied] = useState(false);
  const lineCount = seed.sql.split("\n").length;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(seed.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [seed.sql]);

  const statusIcon = {
    idle: <FileCode2 className="h-5 w-5 text-muted-foreground" />,
    running: <Loader2 className="h-5 w-5 text-info animate-spin" />,
    success: <CheckCircle2 className="h-5 w-5 text-success" />,
    error: <XCircle className="h-5 w-5 text-destructive" />,
  }[safeState.status];

  const borderColor = {
    idle: "",
    running: "border-l-blue-500",
    success: "border-l-green-500",
    error: "border-l-red-500",
  }[safeState.status];

  return (
    <Card className={`border-l-4 ${borderColor || "border-l-muted"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {statusIcon}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                  {seed.fileName}
                </Badge>
                {seed.name}
              </CardTitle>
              <CardDescription className="mt-1 text-xs">{seed.description}</CardDescription>
              {seed.dependencies.length > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Depends on: {seed.dependencies.map((d) => `${d}-*`).join(", ")}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {safeState.durationMs !== undefined && safeState.status !== "idle" && (
              <Badge variant="secondary" className="text-[10px]">
                <Clock className="h-3 w-3 mr-1" />
                {safeState.durationMs}ms
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onRun}
              disabled={safeState.status === "running"}
            >
              {safeState.status === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="ml-1">{safeState.status === "running" ? "Running" : "Run"}</span>
            </Button>
          </div>
        </div>

        {/* Error display */}
        {safeState.status === "error" && safeState.error && (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 dark:bg-red-950/30 dark:border-red-900 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <pre className="text-xs text-destructive dark:text-red-400 whitespace-pre-wrap font-mono break-all">
                {safeState.error}
              </pre>
            </div>
          </div>
        )}
      </CardHeader>

      {/* Collapsible SQL preview */}
      <div className="px-6 pb-4">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          View SQL ({lineCount} lines)
        </button>
        {expanded && (
          <div className="mt-2 relative">
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-2 right-2 h-7 px-2 text-xs z-10"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <ScrollArea className="h-64 rounded-md border bg-muted/30">
              <pre className="p-4 text-[11px] font-mono leading-relaxed text-muted-foreground">
                {seed.sql}
              </pre>
            </ScrollArea>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const AUTO_RUN_KEY = "SeedRunner.autoRun";

export default function SeedRunner() {
  const { toast } = useToast();
  const [states, setStates] = useState<Record<string, SeedRunState>>(() =>
    Object.fromEntries(SEED_FILES.map((f) => [f.id, { status: "idle" as RunStatus }])),
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [autoRun, setAutoRun] = useState(() => {
    try {
      const stored = localStorage.getItem(AUTO_RUN_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });
  const hasAutoRunThisSession = useRef(false);

  const updateState = (id: string, update: Partial<SeedRunState>) => {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...update } }));
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Run a single seed file
  const runSeed = useCallback(
    async (seed: SeedFile) => {
      updateState(seed.id, { status: "running", error: undefined, durationMs: undefined });
      const result = await executeSeed(seed.sql, seed.fileName);
      updateState(seed.id, {
        status: result.success ? "success" : "error",
        durationMs: result.durationMs,
        error: result.error,
      });
      if (result.success) {
        toast({ title: `${seed.name} seeded`, description: `Completed in ${result.durationMs}ms` });
      } else {
        toast({ title: `${seed.name} failed`, description: result.error, variant: "destructive" });
      }
      return result.success;
    },
    [toast],
  );

  // Run all seed files sequentially (respects dependency order)
  const runAll = useCallback(async () => {
    setIsRunningAll(true);
    // Reset all states
    setStates(Object.fromEntries(SEED_FILES.map((f) => [f.id, { status: "idle" as RunStatus }])));

    let failed = false;
    for (const seed of SEED_FILES) {
      if (failed) {
        updateState(seed.id, { status: "idle" });
        continue;
      }
      const success = await runSeed(seed);
      if (!success) {
        failed = true;
        toast({
          title: "Seed run stopped",
          description: `Failed at ${seed.name}. Remaining seeds skipped.`,
          variant: "destructive",
        });
      }
    }

    if (!failed) {
      toast({ title: "All seeds completed", description: `All ${SEED_FILES.length} seed files executed successfully.` });
    }
    setIsRunningAll(false);
  }, [runSeed, toast]);

  // Automatic run on page load when "Run automatically" is enabled
  useEffect(() => {
    if (!autoRun || hasAutoRunThisSession.current) return;
    hasAutoRunThisSession.current = true;
    const timer = setTimeout(() => runAll(), 800);
    return () => clearTimeout(timer);
  }, [autoRun, runAll]);

  const handleAutoRunChange = useCallback((checked: boolean) => {
    setAutoRun(checked);
    try {
      localStorage.setItem(AUTO_RUN_KEY, String(checked));
    } catch {
      /* ignore */
    }
  }, []);

  // Summary counts
  const successCount = Object.values(states).filter((s) => s.status === "success").length;
  const errorCount = Object.values(states).filter((s) => s.status === "error").length;
  const runningCount = Object.values(states).filter((s) => s.status === "running").length;

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/admin" className="hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4 inline mr-1" />
              Admin Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Database className="h-7 w-7 text-primary" />
            Seed Data Runner
          </h1>
          <p className="text-sm text-muted-foreground">
            Execute seed SQL files to populate the database with demo data.
            Files run in order (00 first). Each seed is idempotent — safe to re-run.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Switch
              id="seed-auto-run"
              checked={autoRun}
              onCheckedChange={handleAutoRunChange}
            />
            <Label htmlFor="seed-auto-run" className="text-sm font-normal cursor-pointer flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-500" />
              Run all seeds automatically when I open this page
            </Label>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="lg" disabled={isRunningAll}>
              {isRunningAll ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4 mr-2" />
              )}
              {isRunningAll ? "Running..." : "Run All Seeds"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Run all {SEED_FILES.length} seed files?</AlertDialogTitle>
              <AlertDialogDescription>
                This will execute all seed SQL files in order (00 through 11, including 05b and 05c).
                Seeds are idempotent and use ON CONFLICT / guard checks, so
                re-running is safe. If any seed fails, remaining seeds will be skipped.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={runAll}>Run All</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Summary bar */}
      {(successCount > 0 || errorCount > 0 || runningCount > 0) && (
        <div className="flex gap-3 text-sm">
          {successCount > 0 && (
            <Badge variant="outline" className="text-success border-success/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {successCount} succeeded
            </Badge>
          )}
          {errorCount > 0 && (
            <Badge variant="outline" className="text-destructive border-destructive/30">
              <XCircle className="h-3 w-3 mr-1" />
              {errorCount} failed
            </Badge>
          )}
          {runningCount > 0 && (
            <Badge variant="outline" className="text-info border-info/30">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              {runningCount} running
            </Badge>
          )}
        </div>
      )}

      {/* Prerequisite note */}
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-medium">Prerequisites</p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-700 dark:text-amber-400">
                <li>At least one user must exist in <code>auth.users</code> (sign up first)</li>
                <li>Run the <code>admin_exec_sql</code> migration before first use</li>
                <li>The <code>run-seed</code> edge function must be deployed</li>
                <li>Always run <strong>00-platform-core</strong> first — other seeds depend on it</li>
                <li><strong>Demo login:</strong> Log in on <em>this</em> app with a user that exists in this project (e.g. admin@…). Use an admin account so <code>run-seed</code> can verify your role. If you see &quot;Invalid JWT&quot;, log out and log back in here to get a token for this project.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seed file list */}
      <div className="space-y-3">
        {SEED_FILES.map((seed) => (
          <SeedFileCard
            key={seed.id}
            seed={seed}
            state={states[seed.id]}
            onRun={() => runSeed(seed)}
            expanded={expandedIds.has(seed.id)}
            onToggle={() => toggleExpanded(seed.id)}
          />
        ))}
      </div>
    </div>
  );
}
