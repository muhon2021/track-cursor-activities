/**
 * Implementation Status — Admin dashboard for tracking module progress.
 *
 * Audience: Product Managers, Developers, QA
 * Data source: src/shared/data/implementationStatus.ts
 *
 * Update the data file after each batch of work.
 * QA marks checklist items as tested directly in the data file.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  Ban,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Database,
  FileCode,
  Route,
  Navigation,
  Layers,
  Server,
  BookOpen,
  FolderOpen,
  ExternalLink,
  Users,
  UserCircle,
  ArrowRight,
  BarChart3,
  TrendingUp,
  Package,
  ListChecks,
} from "lucide-react";
import {
  implementationStatus,
  getStatusColor,
  getStatusLabel,
  getModuleProgress,
  getQAProgress,
  getPipelineColor,
  getPipelineLabel,
  getPipelineProgress,
  getTeamModules,
  TEAM,
  SIGN_OFF_OWNER,
  type ModuleStatus,
  type ItemStatus,
  type PipelineStatus,
  type PipelinePhase as PipelinePhaseType,
} from "@/shared/data/implementationStatus";

function StatusBadge({ status }: { status: ItemStatus }) {
  const color = getStatusColor(status);
  return (
    <Badge
      variant="outline"
      className="text-xs font-medium"
      style={{ borderColor: color, color }}
    >
      {getStatusLabel(status)}
    </Badge>
  );
}

function StatusIcon({ status }: { status: ItemStatus }) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "qa-ready":
      return <FlaskConical className="h-4 w-4 text-info" />;
    case "in-progress":
      return <Clock className="h-4 w-4 text-amber-500" />;
    case "planned":
      return <Circle className="h-4 w-4 text-purple-500" />;
    case "blocked":
      return <Ban className="h-4 w-4 text-destructive" />;
    case "not-started":
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
}

function OverviewCards() {
  const totalModules = implementationStatus.length;
  const devDoneModules = implementationStatus.filter(
    (m) => m.pipeline.development.status === "done"
  ).length;
  const totalPages = implementationStatus.reduce((sum, m) => sum + m.pages.length, 0);
  const donePages = implementationStatus.reduce(
    (sum, m) => sum + m.pages.filter((p) => p.status === "done" || p.status === "qa-ready").length,
    0
  );
  const totalHooks = implementationStatus.reduce((sum, m) => sum + m.hooks.length, 0);
  const doneHooks = implementationStatus.reduce(
    (sum, m) => sum + m.hooks.filter((h) => h.status === "done").length,
    0
  );
  const totalQA = implementationStatus.reduce((sum, m) => sum + m.qaChecklist.length, 0);
  const testedQA = implementationStatus.reduce(
    (sum, m) => sum + m.qaChecklist.filter((q) => q.tested).length,
    0
  );
  const totalTables = implementationStatus.reduce((sum, m) => sum + m.database.tables, 0);
  const totalEdgeFns = implementationStatus.reduce((sum, m) => sum + m.edgeFunctions.length, 0);
  const edgeFnDone = implementationStatus.reduce(
    (sum, m) => sum + m.edgeFunctions.filter((e) => e.status === "done").length,
    0
  );
  const totalNextSteps = implementationStatus.reduce((sum, m) => sum + m.nextSteps.length, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Layers className="h-4 w-4" />
            <span className="text-sm">Modules Dev Done</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {devDoneModules} <span className="text-sm font-normal text-muted-foreground">/ {totalModules}</span>
          </p>
          <Progress value={(devDoneModules / totalModules) * 100} className="h-1.5 mt-2" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileCode className="h-4 w-4" />
            <span className="text-sm">Pages Built</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {donePages} <span className="text-sm font-normal text-muted-foreground">/ {totalPages}</span>
          </p>
          <Progress value={(donePages / totalPages) * 100} className="h-1.5 mt-2" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm">Hooks Wired</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {doneHooks} <span className="text-sm font-normal text-muted-foreground">/ {totalHooks}</span>
          </p>
          <Progress value={(doneHooks / totalHooks) * 100} className="h-1.5 mt-2" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Database className="h-4 w-4" />
            <span className="text-sm">Infrastructure</span>
          </div>
          <p className="text-2xl font-bold mt-1">{totalTables} <span className="text-sm font-normal text-muted-foreground">tables</span></p>
          <p className="text-xs text-muted-foreground">
            Edge fns: {edgeFnDone}/{totalEdgeFns} · QA: {testedQA}/{totalQA} · Remaining: {totalNextSteps}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ModuleCard({ module }: { module: ModuleStatus }) {
  const [expanded, setExpanded] = useState(false);
  const progress = getModuleProgress(module);
  const qa = getQAProgress(module);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Phase {module.phase}
              </Badge>
              <CardTitle className="text-base">{module.name}</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{module.summary}</p>
          </div>
          <div className="flex items-center gap-3 ml-4">
            <div className="text-right">
              <p className="text-lg font-bold">{progress}%</p>
              <p className="text-xs text-muted-foreground">built</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">
                {qa.tested}/{qa.total}
              </p>
              <p className="text-xs text-muted-foreground">tested</p>
            </div>
          </div>
        </div>
        <Progress value={progress} className="h-1.5 mt-3" />
      </CardHeader>

      <CardContent className="pt-0">
        {/* Foundation row */}
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-1">
            <Database className="h-3 w-3 text-muted-foreground" />
            <StatusBadge status={module.database.status} />
            <span className="text-xs text-muted-foreground">{module.database.tables} tables</span>
          </div>
          <div className="flex items-center gap-1">
            <FileCode className="h-3 w-3 text-muted-foreground" />
            <StatusBadge status={module.types.status} />
            <span className="text-xs text-muted-foreground">types</span>
          </div>
          <div className="flex items-center gap-1">
            <Route className="h-3 w-3 text-muted-foreground" />
            <StatusBadge status={module.routes.status} />
            <span className="text-xs text-muted-foreground">routes</span>
          </div>
          <div className="flex items-center gap-1">
            <Navigation className="h-3 w-3 text-muted-foreground" />
            <StatusBadge status={module.navigation.status} />
            <span className="text-xs text-muted-foreground">nav</span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-muted-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              Collapse <ChevronUp className="h-4 w-4 ml-1" />
            </>
          ) : (
            <>
              Expand details <ChevronDown className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>

        {expanded && (
          <div className="mt-4 space-y-6">
            {/* Pages */}
            {module.pages.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Pages</h4>
                <div className="space-y-1">
                  {module.pages.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <StatusIcon status={p.status} />
                      <span className="flex-1">{p.name}</span>
                      <StatusBadge status={p.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hooks */}
            {module.hooks.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Hooks</h4>
                <div className="space-y-1">
                  {module.hooks.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <StatusIcon status={h.status} />
                      <span className="flex-1">{h.name}</span>
                      <StatusBadge status={h.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Components */}
            {module.components.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Components</h4>
                <div className="space-y-1">
                  {module.components.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <StatusIcon status={c.status} />
                      <span className="flex-1">{c.name}</span>
                      <StatusBadge status={c.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Edge Functions */}
            {module.edgeFunctions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Server className="h-4 w-4" /> Edge Functions
                </h4>
                <div className="space-y-1">
                  {module.edgeFunctions.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <StatusIcon status={e.status} />
                      <span className="flex-1">{e.name}</span>
                      <StatusBadge status={e.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* QA Checklist */}
            {module.qaChecklist.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" /> QA Checklist
                </h4>
                <div className="space-y-1">
                  {module.qaChecklist.map((q, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {q.tested ? (
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className={`flex-1 ${q.tested ? "line-through text-muted-foreground" : ""}`}>
                        {q.description}
                      </span>
                      {q.approvedBy && (
                        <span className="text-xs text-muted-foreground">by {q.approvedBy}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Steps */}
            {module.nextSteps.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Next Steps (for developers)</h4>
                <ul className="space-y-1">
                  {module.nextSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Blockers */}
            {module.blockers && module.blockers.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <h4 className="text-sm font-semibold text-destructive mb-1">Blockers</h4>
                <ul className="space-y-1">
                  {module.blockers.map((b, i) => (
                    <li key={i} className="text-sm text-destructive">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QASummaryTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">QA Testing Summary</CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Module</TableHead>
            <TableHead>Phase</TableHead>
            <TableHead>Total Checks</TableHead>
            <TableHead>Tested</TableHead>
            <TableHead>Remaining</TableHead>
            <TableHead>Coverage</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {implementationStatus.map((module) => {
            const qa = getQAProgress(module);
            const pct = qa.total > 0 ? Math.round((qa.tested / qa.total) * 100) : 0;
            return (
              <TableRow key={module.id}>
                <TableCell className="font-medium">{module.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">Phase {module.phase}</Badge>
                </TableCell>
                <TableCell>{qa.total}</TableCell>
                <TableCell>
                  <span className={qa.tested > 0 ? "text-success font-medium" : ""}>{qa.tested}</span>
                </TableCell>
                <TableCell>
                  <span className={qa.total - qa.tested > 0 ? "text-amber-600 font-medium" : ""}>
                    {qa.total - qa.tested}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={pct} className="h-1.5 w-20" />
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function DatabaseSummary() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Database Tables by Module</CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Module</TableHead>
            <TableHead>Tables</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {implementationStatus
            .filter((m) => m.database.tables > 0)
            .map((module) => (
              <TableRow key={module.id}>
                <TableCell className="font-medium">{module.name}</TableCell>
                <TableCell>{module.database.tables}</TableCell>
                <TableCell>
                  <StatusBadge status={module.database.status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-sm truncate">
                  {module.database.notes}
                </TableCell>
              </TableRow>
            ))}
          <TableRow className="font-bold">
            <TableCell>Total</TableCell>
            <TableCell>
              {implementationStatus.reduce((sum, m) => sum + m.database.tables, 0)}
            </TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  );
}

// ─── Pipeline helpers ──────────────────────────────────────────────────────

function PipelineBadge({ phase }: { phase: PipelinePhaseType }) {
  const color = getPipelineColor(phase.status);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Badge
        variant="outline"
        className="text-[10px] font-medium px-1.5"
        style={{ borderColor: color, color }}
      >
        {getPipelineLabel(phase.status)}
      </Badge>
      {phase.owner && (
        <span className="text-[10px] text-muted-foreground">{phase.owner}</span>
      )}
    </div>
  );
}

function TeamBoard() {
  return (
    <div className="space-y-6">
      {/* Developer summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TEAM.map((member) => {
          const modules = getTeamModules(member.id);
          const devDone = modules.filter((m) => m.pipeline.development.status === "done").length;
          const qaDone = modules.filter((m) => m.pipeline.qa.status === "done").length;
          const seedDone = modules.filter((m) => m.pipeline.dataSeeding.status === "done").length;
          const signedOff = modules.filter((m) => m.pipeline.signOff.status === "done").length;
          return (
            <Card key={member.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{member.name}</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  {modules.length} modules assigned
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: getPipelineColor(devDone === modules.length ? "done" : "in-progress") }} />
                    <span className="text-muted-foreground">Dev:</span>
                    <span className="font-medium">{devDone}/{modules.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: getPipelineColor(qaDone === modules.length ? "done" : qaDone > 0 ? "in-progress" : "not-started") }} />
                    <span className="text-muted-foreground">QA:</span>
                    <span className="font-medium">{qaDone}/{modules.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: getPipelineColor(seedDone === modules.length ? "done" : seedDone > 0 ? "in-progress" : "not-started") }} />
                    <span className="text-muted-foreground">Seeding:</span>
                    <span className="font-medium">{seedDone}/{modules.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: getPipelineColor(signedOff === modules.length ? "done" : signedOff > 0 ? "in-progress" : "not-started") }} />
                    <span className="text-muted-foreground">Sign-off:</span>
                    <span className="font-medium">{signedOff}/{modules.length}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {modules.map((m) => (
                    <Badge key={m.id} variant="secondary" className="text-[10px]">
                      {m.name.split("(")[0].trim()}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pipeline matrix */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Delivery Pipeline</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Each module flows through 4 phases: Development → QA (Lovable QA) → Data Seeding → Sign-off ({SIGN_OFF_OWNER}).
          </p>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Module</TableHead>
              <TableHead className="text-center">Owner</TableHead>
              <TableHead className="text-center">Development</TableHead>
              <TableHead className="text-center">
                <ArrowRight className="inline h-3 w-3 mr-1" />QA
              </TableHead>
              <TableHead className="text-center">
                <ArrowRight className="inline h-3 w-3 mr-1" />Data Seeding
              </TableHead>
              <TableHead className="text-center">
                <ArrowRight className="inline h-3 w-3 mr-1" />Sign-off
              </TableHead>
              <TableHead className="text-center w-[80px]">Pipeline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {implementationStatus.map((module) => {
              const pipelinePct = getPipelineProgress(module);
              return (
                <TableRow key={module.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0">P{module.phase}</Badge>
                      <span className="font-medium text-sm">{module.name.split("(")[0].trim()}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-xs">{module.owner}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <PipelineBadge phase={module.pipeline.development} />
                  </TableCell>
                  <TableCell className="text-center">
                    <PipelineBadge phase={module.pipeline.qa} />
                  </TableCell>
                  <TableCell className="text-center">
                    <PipelineBadge phase={module.pipeline.dataSeeding} />
                  </TableCell>
                  <TableCell className="text-center">
                    <PipelineBadge phase={module.pipeline.signOff} />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center gap-1.5">
                      <Progress value={pipelinePct} className="h-1.5 w-12" />
                      <span className="text-[10px] text-muted-foreground">{pipelinePct}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Per-developer detail */}
      {TEAM.map((member) => {
        const modules = getTeamModules(member.id);
        return (
          <Card key={member.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{member.name}'s Modules</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {modules.map((module) => (
                <div key={module.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Phase {module.phase}</Badge>
                      <span className="font-medium text-sm">{module.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={getModuleProgress(module)} className="h-1.5 w-16" />
                      <span className="text-xs text-muted-foreground">{getModuleProgress(module)}% built</span>
                    </div>
                  </div>

                  {/* Pipeline phases with notes */}
                  <div className="grid grid-cols-4 gap-3">
                    {(["development", "qa", "dataSeeding", "signOff"] as const).map((key) => {
                      const phase = module.pipeline[key];
                      const label = key === "dataSeeding" ? "Data Seeding" : key === "signOff" ? "Sign-off" : key === "qa" ? "QA" : "Development";
                      return (
                        <div key={key} className="text-center">
                          <p className="text-xs font-medium mb-1">{label}</p>
                          <Badge
                            variant="outline"
                            className="text-[10px] mb-1"
                            style={{ borderColor: getPipelineColor(phase.status), color: getPipelineColor(phase.status) }}
                          >
                            {getPipelineLabel(phase.status)}
                          </Badge>
                          {phase.notes && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{phase.notes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Next steps */}
                  {module.nextSteps.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-medium mb-1">Next Steps</p>
                      <ul className="space-y-0.5">
                        {module.nextSteps.slice(0, 3).map((step, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <AlertCircle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Global documentation (cross-cutting, not module-specific) ─────────────
const GLOBAL_DOCS = [
  { section: "Getting Started", items: [
    { title: "Getting Started Guide", path: "docs/00-getting-started/README.md", description: "Setup instructions, prerequisites, and initial configuration" },
    { title: "Environment Variables", path: "docs/00-getting-started/environment-variables.md", description: "All required and optional environment variables" },
    { title: "Self-Host Quickstart", path: "docs/00-getting-started/self-host-quickstart.md", description: "Quick setup for self-hosted deployments" },
  ]},
  { section: "Architecture", items: [
    { title: "Architecture Overview", path: "docs/01-architecture/00-architecture-overview.md", description: "V2 architecture: 4-layer framework, component hierarchy, AI strategy" },
    { title: "System Architecture", path: "docs/01-architecture/system-architecture.md", description: "Infrastructure, data flow, and system design" },
    { title: "Implementation Plan", path: "docs/IMPLEMENTATION_PLAN.md", description: "Chief Architect review: gap analysis, 8 phases, status per phase" },
  ]},
  { section: "Development", items: [
    { title: "Development Guide", path: "docs/03-development/README.md", description: "Development workflow and conventions" },
    { title: "Testing Guide", path: "docs/03-development/testing.md", description: "Testing strategy and test runner setup" },
    { title: "Release Process", path: "docs/03-development/release-process.md", description: "Release workflow, versioning, and checklist" },
  ]},
  { section: "Deployment", items: [
    { title: "Deployment Guide", path: "docs/04-deployment/README.md", description: "Deployment overview and strategies" },
    { title: "Production Checklist", path: "docs/04-deployment/production-checklist.md", description: "Pre-production verification checklist" },
    { title: "Production Guide", path: "docs/04-deployment/production-guide.md", description: "Production environment configuration" },
  ]},
  { section: "Integrations", items: [
    { title: "Integrations Overview", path: "docs/05-integrations/README.md", description: "Third-party integration architecture" },
    { title: "API Reference", path: "docs/05-integrations/api-reference.md", description: "REST API endpoints and authentication" },
    { title: "Data Flows", path: "docs/05-integrations/data-flows.md", description: "Data sync patterns and flow diagrams" },
  ]},
  { section: "AI Features", items: [
    { title: "AI Features Overview", path: "docs/06-ai-features/README.md", description: "AI capabilities, models, and RAG pipeline" },
  ]},
  { section: "Edge Functions", items: [
    { title: "Edge Functions Catalog", path: "docs/08-edge-functions/catalog.md", description: "All planned edge functions by module" },
    { title: "Edge Functions Deployment", path: "docs/08-edge-functions/deployment.md", description: "Deployment workflow for Supabase edge functions" },
    { title: "Secrets Management", path: "docs/08-edge-functions/secrets.md", description: "Managing secrets for edge function runtime" },
  ]},
  { section: "Backlog", items: [
    { title: "Product Backlog", path: "docs/backlog/product-backlog.md", description: "Full product backlog with prioritized items" },
  ]},
];

function NextStepsTab() {
  const byOwner = TEAM.map((member) => {
    const modules = getTeamModules(member.id);
    const items = modules.flatMap((m) =>
      m.nextSteps.map((step) => ({ module: m.name, moduleId: m.id, phase: m.phase, step }))
    );
    return { member, items };
  }).filter((g) => g.items.length > 0);

  const totalSteps = byOwner.reduce((s, g) => s + g.items.length, 0);
  const devInProgress = implementationStatus.filter(
    (m) => m.pipeline.development.status === "in-progress"
  );
  const modulesReadyForQA = implementationStatus.filter(
    (m) => m.pipeline.development.status === "done" && m.pipeline.qa.status === "not-started"
  );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Remaining Dev Steps</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalSteps}</p>
            <p className="text-xs text-muted-foreground">across {byOwner.length} developers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Dev In Progress</span>
            </div>
            <p className="text-2xl font-bold mt-1">{devInProgress.length}</p>
            <p className="text-xs text-muted-foreground">
              {devInProgress.map((m) => m.name.split("(")[0].trim()).join(", ") || "None"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FlaskConical className="h-4 w-4" />
              <span className="text-sm">Ready for QA</span>
            </div>
            <p className="text-2xl font-bold mt-1">{modulesReadyForQA.length}</p>
            <p className="text-xs text-muted-foreground">
              {modulesReadyForQA.map((m) => m.name.split("(")[0].trim()).join(", ") || "None"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-developer next steps */}
      {byOwner.map(({ member, items }) => (
        <Card key={member.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{member.name}</CardTitle>
              <Badge variant="secondary" className="text-xs">{items.length} items</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p>{item.step}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">P{item.phase}</Badge>
                      <span className="text-xs text-muted-foreground">{item.module}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Modules ready for QA */}
      {modulesReadyForQA.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-info" />
              <CardTitle className="text-base">Modules Ready for QA</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Development complete — these modules can proceed to QA testing via Lovable QA.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {modulesReadyForQA.map((m) => {
                const qa = getQAProgress(m);
                return (
                  <div key={m.id} className="border rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">P{m.phase}</Badge>
                      <span className="font-medium text-sm">{m.name.split("(")[0].trim()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{qa.total} checks</span>
                      <Badge variant="secondary" className="text-xs">{m.owner}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DocsTab() {
  return (
    <div className="space-y-6">
      {/* Global docs */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Project Documentation</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Cross-cutting documentation — architecture, deployment, integrations, and development guides.
            All files live in <code className="bg-muted px-1 rounded text-xs">docs/</code>.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {GLOBAL_DOCS.map((group) => (
            <div key={group.section}>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                {group.section}
              </h4>
              <div className="space-y-1.5 ml-6">
                {group.items.map((doc) => (
                  <div key={doc.path} className="flex items-start gap-2 text-sm group">
                    <FileCode className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{doc.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{doc.description}</p>
                      <code className="text-xs text-muted-foreground/70">{doc.path}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Per-module blueprint docs */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Module Blueprints</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Each module has a detailed blueprint specifying pages, components, hooks, DB tables, and edge functions.
            These are the specifications developers follow for implementation.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {implementationStatus.map((module) => {
            if (module.docs.length === 0) return null;
            const progress = getModuleProgress(module);
            return (
              <div key={module.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Phase {module.phase}</Badge>
                    <span className="font-medium text-sm">{module.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={progress} className="h-1.5 w-16" />
                    <span className="text-xs text-muted-foreground">{progress}%</span>
                  </div>
                </div>
                <div className="space-y-1.5 ml-1">
                  {module.docs.map((doc) => (
                    <div key={doc.path} className="flex items-start gap-2 text-sm">
                      <ExternalLink className="h-3.5 w-3.5 text-info shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{doc.title}</span>
                        <p className="text-xs text-muted-foreground">{doc.description}</p>
                        <code className="text-xs text-muted-foreground/70">{doc.path}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── PM Overview — product manager snapshot ─────────────────────────────────

function PMOverviewTab() {
  // Compute metrics
  const totalModules = implementationStatus.length;
  const devDoneModules = implementationStatus.filter(
    (m) => m.pipeline.development.status === "done"
  );
  const devInProgress = implementationStatus.filter(
    (m) => m.pipeline.development.status === "in-progress"
  );
  const allPages = implementationStatus.flatMap((m) => m.pages);
  const allHooks = implementationStatus.flatMap((m) => m.hooks);
  const allComponents = implementationStatus.flatMap((m) => m.components);
  const allEdgeFns = implementationStatus.flatMap((m) => m.edgeFunctions);
  const totalItems = [...allPages, ...allHooks, ...allComponents, ...allEdgeFns];
  const doneItems = totalItems.filter((i) => i.status === "done" || i.status === "qa-ready");
  const plannedItems = totalItems.filter((i) => i.status === "planned" || i.status === "not-started");
  const overallPct = totalItems.length > 0 ? Math.round((doneItems.length / totalItems.length) * 100) : 0;

  const totalQA = implementationStatus.reduce((s, m) => s + m.qaChecklist.length, 0);
  const testedQA = implementationStatus.reduce(
    (s, m) => s + m.qaChecklist.filter((q) => q.tested).length, 0
  );

  // Recently completed items (done pages + hooks + components) grouped by module
  const recentByModule = implementationStatus
    .map((m) => {
      const donePages = m.pages.filter((p) => p.status === "done");
      const doneHooks = m.hooks.filter((h) => h.status === "done");
      const doneComps = m.components.filter((c) => c.status === "done");
      const items = [
        ...donePages.map((p) => ({ ...p, type: "Page" as const })),
        ...doneHooks.map((h) => ({ ...h, type: "Hook" as const })),
        ...doneComps.map((c) => ({ ...c, type: "Component" as const })),
      ];
      return { module: m, items };
    })
    .filter((g) => g.items.length > 0);

  // Remaining work per module
  const remainingByModule = implementationStatus
    .map((m) => ({
      module: m,
      nextSteps: m.nextSteps,
      pendingPages: m.pages.filter((p) => p.status === "planned" || p.status === "not-started"),
      pendingEdgeFns: m.edgeFunctions.filter((e) => e.status === "planned" || e.status === "not-started"),
    }))
    .filter((g) => g.nextSteps.length > 0 || g.pendingPages.length > 0 || g.pendingEdgeFns.length > 0);

  return (
    <div className="space-y-6">
      {/* PM Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span className="text-sm">Modules</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {devDoneModules.length}<span className="text-sm font-normal text-muted-foreground">/{totalModules} dev done</span>
            </p>
            <Progress value={(devDoneModules.length / totalModules) * 100} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Overall Build</span>
            </div>
            <p className="text-2xl font-bold mt-1">{overallPct}%</p>
            <p className="text-xs text-muted-foreground">{doneItems.length}/{totalItems.length} items done</p>
            <Progress value={overallPct} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileCode className="h-4 w-4" />
              <span className="text-sm">Pages</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {allPages.filter((p) => p.status === "done" || p.status === "qa-ready").length}
              <span className="text-sm font-normal text-muted-foreground">/{allPages.length}</span>
            </p>
            <Progress value={(allPages.filter((p) => p.status === "done" || p.status === "qa-ready").length / allPages.length) * 100} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">Hooks</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {allHooks.filter((h) => h.status === "done").length}
              <span className="text-sm font-normal text-muted-foreground">/{allHooks.length}</span>
            </p>
            <Progress value={(allHooks.filter((h) => h.status === "done").length / allHooks.length) * 100} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ListChecks className="h-4 w-4" />
              <span className="text-sm">QA Tested</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {testedQA}<span className="text-sm font-normal text-muted-foreground">/{totalQA}</span>
            </p>
            <Progress value={totalQA > 0 ? (testedQA / totalQA) * 100 : 0} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Module Progress Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Module Progress at a Glance</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Each module's development, pages, hooks, and pipeline status in one table.
          </p>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead className="text-center">Owner</TableHead>
              <TableHead className="text-center">Dev</TableHead>
              <TableHead className="text-center">Pages</TableHead>
              <TableHead className="text-center">Hooks</TableHead>
              <TableHead className="text-center">Edge Fns</TableHead>
              <TableHead className="text-center">Build %</TableHead>
              <TableHead className="text-center">QA</TableHead>
              <TableHead>Remaining</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {implementationStatus.map((module) => {
              const progress = getModuleProgress(module);
              const qa = getQAProgress(module);
              const pagesTotal = module.pages.length;
              const pagesDone = module.pages.filter((p) => p.status === "done" || p.status === "qa-ready").length;
              const hooksTotal = module.hooks.length;
              const hooksDone = module.hooks.filter((h) => h.status === "done").length;
              const efTotal = module.edgeFunctions.length;
              const efDone = module.edgeFunctions.filter((e) => e.status === "done").length;
              return (
                <TableRow key={module.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0">P{module.phase}</Badge>
                      <span className="font-medium text-sm">{module.name.split("(")[0].trim()}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-xs">{module.owner}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className="text-[10px]"
                      style={{
                        borderColor: getPipelineColor(module.pipeline.development.status),
                        color: getPipelineColor(module.pipeline.development.status),
                      }}
                    >
                      {getPipelineLabel(module.pipeline.development.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    <span className={pagesDone === pagesTotal ? "text-success font-medium" : ""}>
                      {pagesDone}/{pagesTotal}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    <span className={hooksDone === hooksTotal ? "text-success font-medium" : ""}>
                      {hooksDone}/{hooksTotal}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {efTotal > 0 ? (
                      <span className={efDone === efTotal ? "text-success font-medium" : ""}>
                        {efDone}/{efTotal}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Progress value={progress} className="h-1.5 w-14" />
                      <span className="text-xs font-medium">{progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {qa.total > 0 ? (
                      <span className={qa.tested === qa.total && qa.total > 0 ? "text-success font-medium" : "text-muted-foreground"}>
                        {qa.tested}/{qa.total}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {module.nextSteps.length > 0
                        ? module.nextSteps[0].length > 40
                          ? module.nextSteps[0].substring(0, 40) + "…"
                          : module.nextSteps[0]
                        : "✓ All dev items done"}
                      {module.nextSteps.length > 1 && (
                        <span className="text-amber-600"> +{module.nextSteps.length - 1} more</span>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* What's Done — by module */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <CardTitle className="text-base">Completed Work by Module</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            All pages, hooks, and components that have been built and are ready for review/QA.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentByModule.map(({ module, items }) => (
            <div key={module.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Phase {module.phase}</Badge>
                  <span className="font-medium text-sm">{module.name}</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{
                    borderColor: getStatusColor("done"),
                    color: getStatusColor("done"),
                  }}
                >
                  {items.length} items done
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                    <Badge variant="outline" className="text-[9px] px-1 shrink-0">{item.type}</Badge>
                    <span className="truncate text-muted-foreground">{item.name.split("—")[0].trim()}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* What's Left — by module */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">Remaining Work</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Outstanding dev items, pending pages, and planned edge functions across all modules.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {remainingByModule.map(({ module, nextSteps, pendingPages, pendingEdgeFns }) => (
            <div key={module.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Phase {module.phase}</Badge>
                  <span className="font-medium text-sm">{module.name.split("(")[0].trim()}</span>
                  <Badge variant="secondary" className="text-xs">{module.owner}</Badge>
                </div>
                <span className="text-xs text-amber-600 font-medium">
                  {nextSteps.length + pendingPages.length + pendingEdgeFns.length} items
                </span>
              </div>
              <div className="space-y-1">
                {nextSteps.map((step, i) => (
                  <div key={`ns-${i}`} className="flex items-start gap-2 text-sm">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{step}</span>
                  </div>
                ))}
                {pendingPages.map((p, i) => (
                  <div key={`pp-${i}`} className="flex items-start gap-2 text-sm">
                    <Circle className="h-3.5 w-3.5 text-purple-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{p.name}</span>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
                {pendingEdgeFns.map((e, i) => (
                  <div key={`ef-${i}`} className="flex items-start gap-2 text-sm">
                    <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{e.name}</span>
                    <StatusBadge status={e.status} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ImplementationStatus() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Implementation Status</h1>
        <p className="text-muted-foreground">
          Module-by-module progress tracker. Updated after each development batch.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Data source: <code className="bg-muted px-1 rounded">src/shared/data/implementationStatus.ts</code>
          — Update this file to reflect progress.
        </p>
      </div>

      <OverviewCards />

      <Tabs defaultValue="pm-overview">
        <TabsList>
          <TabsTrigger value="pm-overview">PM Overview</TabsTrigger>
          <TabsTrigger value="team">Team Board</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="next">Next Steps</TabsTrigger>
          <TabsTrigger value="qa">QA Dashboard</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="docs">Docs & Architecture</TabsTrigger>
        </TabsList>

        <TabsContent value="pm-overview" className="mt-4">
          <PMOverviewTab />
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <TeamBoard />
        </TabsContent>

        <TabsContent value="modules" className="mt-4 space-y-4">
          {implementationStatus.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </TabsContent>

        <TabsContent value="next" className="mt-4">
          <NextStepsTab />
        </TabsContent>

        <TabsContent value="qa" className="mt-4">
          <QASummaryTable />
        </TabsContent>

        <TabsContent value="database" className="mt-4">
          <DatabaseSummary />
        </TabsContent>

        <TabsContent value="docs" className="mt-4">
          <DocsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
