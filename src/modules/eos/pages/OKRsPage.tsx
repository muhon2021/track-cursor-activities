/**
 * OKRs Page
 *
 * Single page with 6 tabs: My OKRs, Team OKRs, Company OKRs, OKR Health,
 * Performance (key results by owner), Closed OKRs. Stats row, filters, and
 * Create / AI suggestions actions.
 */

import { useMemo, useState } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Building2,
  Activity,
  BarChart3,
  Archive,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useAuth } from "@/contexts/AuthContext";
import { useOKRs, useClosedOKRs, resolveQuarterFilter, useUpdateOKR, useDeleteOKR, useCreateOKR, okrToCreatePayload } from "../hooks/useOKRs";
import { useEOSPods } from "../hooks/useEOSPods";
import { OKRCard } from "../components/okr/OKRCard";
import { CreateOKRDialog } from "../components/okr/CreateOKRDialog";
import { OKRHealthGrid } from "../components/okr/OKRHealthGrid";
import { TeamOKRsByPod } from "../components/okr/TeamOKRsByPod";
import { KeyResultsByOwner } from "../components/okr/KeyResultsByOwner";
import { ClosedOKRsTable } from "../components/okr/ClosedOKRsTable";
import { CloseOKRDialog } from "../components/okr/CloseOKRDialog";
import { OKRDetailDialog } from "./OKRDetailDialog";
import { AISuggestionsDialog } from "@/modules/eos/components/okr/AISuggestionsDialog";
import { RocksBoardView } from "../components/okr/RocksBoardView";
import { RocksTableView } from "../components/okr/RocksTableView";
import { RocksDepartmentView } from "../components/okr/RocksDepartmentView";
import {
  getCurrentQuarterString,
  getCurrentQuarter,
  calculateOKRStats,
  calculateOKRProgress,
} from "@/utils/okrHelpers";
import type { OKR, OKRFilters, OKRStatus } from "../types";

const TAB_VALUES = ["my", "team", "company", "okr-health", "key-results", "closed"] as const;
type TabValue = (typeof TAB_VALUES)[number];
const ROCKS_VIEWS = ["cards", "board", "table", "department"] as const;
type RocksView = (typeof ROCKS_VIEWS)[number];

const QUARTER_OPTIONS = (() => {
  const { year } = getCurrentQuarter();
  const opts: { value: string; label: string }[] = [
    { value: "current", label: "Current..." },
    { value: "all", label: "All" },
  ];
  for (let q = 1; q <= 4; q++) {
    opts.push({ value: `Q${q} ${year}`, label: `Q${q} ${year}` });
  }
  return opts;
})();

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "at_risk", label: "At Risk" },
  { value: "completed", label: "Completed" },
];

function filterMyOKRs(okrs: OKR[], userId: string): OKR[] {
  return okrs.filter(
    (o) =>
      o.owner_id === userId ||
      (o.key_results && o.key_results.some((kr) => kr.owner_id === userId))
  );
}

function filterTeamOKRs(okrs: OKR[], podId?: string): OKR[] {
  let list = okrs.filter((o) => (o.okr_type || "personal") === "team");
  if (podId) list = list.filter((o) => o.pod_id === podId);
  return list;
}

function filterCompanyOKRs(okrs: OKR[]): OKR[] {
  return okrs.filter((o) => (o.okr_type || "personal") === "company");
}

export default function OKRsPage() {
  const location = useLocation();
  const isRocksRoute = location.pathname.includes("/eos/rocks") || location.pathname === "/okrs";
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as TabValue) || "my";
  const rocksView = (searchParams.get("view") as RocksView) || "cards";
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [quarterFilter, setQuarterFilter] = useState<string>("current");
  const [podFilter, setPodFilter] = useState<string>("all");
  const [searchClosed, setSearchClosed] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [selectedOKR, setSelectedOKR] = useState<OKR | null>(null);
  const [closingOKR, setClosingOKR] = useState<OKR | null>(null);
  const [deletingOKR, setDeletingOKR] = useState<OKR | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "duplicate">("create");
  const [dialogInitialOkr, setDialogInitialOkr] = useState<OKR | null>(null);

  const { user } = useAuth();
  const createOKR = useCreateOKR();
  const isClosedTab = tab === "closed";

  const apiFilters: OKRFilters = useMemo(() => {
    const quarterResolved =
      isClosedTab ? undefined : resolveQuarterFilter(quarterFilter, tab === "company");
    return {
      status: statusFilter === "all" ? undefined : (statusFilter as OKRStatus),
      quarter: quarterResolved,
      pod_id: tab === "team" && podFilter !== "all" ? podFilter : undefined,
      search: isClosedTab ? searchClosed || undefined : undefined,
    };
  }, [tab, statusFilter, quarterFilter, podFilter, isClosedTab, searchClosed]);

  const { data: allOkrs = [], isLoading } = useOKRs(isClosedTab ? undefined : apiFilters);
  const { data: closedOkrs = [], isLoading: closedLoading } = useClosedOKRs(
    isClosedTab ? { search: searchClosed || undefined, quarter: quarterFilter === "all" ? undefined : quarterFilter } : undefined
  );
  const { data: pods = [] } = useEOSPods();

  const displayOkrs = useMemo(() => {
    if (isClosedTab) return closedOkrs;
    if (tab === "my") return filterMyOKRs(allOkrs, user?.id || "");
    if (tab === "team") return filterTeamOKRs(allOkrs, podFilter === "all" ? undefined : podFilter);
    if (tab === "company") return filterCompanyOKRs(allOkrs);
    return allOkrs;
  }, [tab, isClosedTab, allOkrs, closedOkrs, user?.id, podFilter]);

  const stats = useMemo(
    () =>
      calculateOKRStats(
        displayOkrs.map((o) => ({
          ...o,
          progress: o.key_results?.length
            ? calculateOKRProgress(o.key_results)
            : o.progress,
        }))
      ),
    [displayOkrs]
  );

  const setTab = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", value);
      return next;
    });
  };

  const updateOKR = useUpdateOKR();
  const deleteOKR = useDeleteOKR();
  const handleCloseOKR = (data: { status: "completed" | "closed"; notes?: string }) => {
    if (!closingOKR) return;
    updateOKR.mutate(
      {
        id: closingOKR.id,
        data: {
          status: data.status,
          is_archived: true,
        },
      },
      { onSuccess: () => setClosingOKR(null) }
    );
  };

  const handleDeleteOKR = () => {
    if (!deletingOKR) return;
    deleteOKR.mutate(deletingOKR.id, { onSuccess: () => setDeletingOKR(null) });
  };

  const isLoadingState = isLoading || (isClosedTab && closedLoading);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>OKRs</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isRocksRoute ? "Quarterly Rocks" : "OKRs"}</h1>
          <p className="text-muted-foreground">
            {isRocksRoute
              ? "90-day priorities — track status, progress, and ownership"
              : "Objectives and Key Results – Set ambitious goals and track measurable outcomes"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowAISuggestions(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            AI Suggestions
          </Button>
          <Button
            onClick={() => {
              setDialogMode("create");
              setDialogInitialOkr(null);
              setShowCreate(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create OKR
          </Button>
        </div>
      </div>

      {isRocksRoute && (
        <div className="flex gap-2 flex-wrap">
          {ROCKS_VIEWS.map((v) => (
            <Button
              key={v}
              size="sm"
              variant={rocksView === v ? "default" : "outline"}
              onClick={() =>
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set("view", v);
                  return next;
                })
              }
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">All objectives</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-1">
              <p className="text-2xl font-bold">{stats.active}</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-1">
              <p className="text-2xl font-bold">{stats.at_risk}</p>
              <Activity className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-1">
              <p className="text-2xl font-bold">{stats.completed}</p>
              <Target className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground">Achieved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-1">
              <p className="text-2xl font-bold">{stats.avg_progress}%</p>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">Overall</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + filters */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="my" className="gap-1.5">
              <Target className="h-4 w-4" />
              My OKRs
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-1.5">
              <TrendingUp className="h-4 w-4" />
              Team OKRs
            </TabsTrigger>
            <TabsTrigger value="company" className="gap-1.5">
              <Building2 className="h-4 w-4" />
              Company OKRs
            </TabsTrigger>
            <TabsTrigger value="okr-health" className="gap-1.5">
              <Activity className="h-4 w-4" />
              OKR Health
            </TabsTrigger>
            <TabsTrigger value="key-results" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="closed" className="gap-1.5">
              <Archive className="h-4 w-4" />
              Closed OKRs
            </TabsTrigger>
          </TabsList>

          {!isClosedTab && (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={quarterFilter} onValueChange={setQuarterFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Quarter" />
                </SelectTrigger>
                <SelectContent>
                  {QUARTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tab === "team" && (
                <Select value={podFilter} onValueChange={setPodFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Pod / Team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams / PODs</SelectItem>
                    {pods.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        {isLoadingState ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <TabsContent value="my" className="mt-6">
              {displayOkrs.length > 0 ? (
                isRocksRoute && rocksView === "board" ? (
                  <RocksBoardView okrs={displayOkrs} onSelect={setSelectedOKR} />
                ) : isRocksRoute && rocksView === "table" ? (
                  <RocksTableView okrs={displayOkrs} onSelect={setSelectedOKR} />
                ) : isRocksRoute && rocksView === "department" ? (
                  <RocksDepartmentView okrs={displayOkrs} onSelect={setSelectedOKR} />
                ) : (
                <div className="space-y-4">
                  {displayOkrs.map((okr) => (
                    <OKRCard
                      key={okr.id}
                      okr={okr}
                      onSelect={() => setSelectedOKR(okr)}
                      onEdit={() => {
                        setDialogMode("edit");
                        setDialogInitialOkr(okr);
                        setShowCreate(true);
                      }}
                      onDuplicate={() => {
                        createOKR.mutate(okrToCreatePayload(okr));
                      }}
                      onClose={() => setClosingOKR(okr)}
                      onDelete={() => setDeletingOKR(okr)}
                    />
                  ))}
                </div>
                )
              ) : (
                <EmptyState onCreateClick={() => setShowCreate(true)} />
              )}
            </TabsContent>

            <TabsContent value="team" className="mt-6">
              {displayOkrs.length > 0 ? (
                <TeamOKRsByPod
                  okrs={displayOkrs}
                  pods={pods}
                  onSelectOKR={(okr) => setSelectedOKR(okr)}
                  onEdit={(okr) => {
                    setDialogMode("edit");
                    setDialogInitialOkr(okr);
                    setShowCreate(true);
                  }}
                  onDuplicate={(okr) => createOKR.mutate(okrToCreatePayload(okr))}
                  onClose={(okr) => setClosingOKR(okr)}
                  onDelete={(okr) => setDeletingOKR(okr)}
                />
              ) : (
                <EmptyState
                  onCreateClick={() => setShowCreate(true)}
                  variant="team"
                  quarterFilter={quarterFilter}
                />
              )}
            </TabsContent>

            <TabsContent value="company" className="mt-6">
              {displayOkrs.length > 0 ? (
                <div className="space-y-4">
                  {displayOkrs.map((okr) => (
                    <OKRCard
                      key={okr.id}
                      okr={okr}
                      onSelect={() => setSelectedOKR(okr)}
                      onEdit={() => {
                        setDialogMode("edit");
                        setDialogInitialOkr(okr);
                        setShowCreate(true);
                      }}
                      onDuplicate={() => {
                        createOKR.mutate(okrToCreatePayload(okr));
                      }}
                      onClose={() => setClosingOKR(okr)}
                      onDelete={() => setDeletingOKR(okr)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  onCreateClick={() => setShowCreate(true)}
                  variant="company"
                  quarterFilter={quarterFilter}
                />
              )}
            </TabsContent>

            <TabsContent value="okr-health" className="mt-6">
              <OKRHealthGrid
                okrs={displayOkrs}
                pods={pods}
                onSelectPod={(podId) => {
                  setPodFilter(podId || "all");
                  setTab("team");
                }}
                onSelectCompany={() => setTab("company")}
              />
            </TabsContent>

            <TabsContent value="key-results" className="mt-6">
              {(() => {
                const allKrs = displayOkrs.flatMap((o) => o.key_results || []);
                return allKrs.length > 0 ? (
                  <KeyResultsByOwner keyResults={allKrs} />
                ) : (
                  <EmptyState onCreateClick={() => setShowCreate(true)} />
                );
              })()}
            </TabsContent>

            <TabsContent value="closed" className="mt-6">
              <ClosedOKRsTable
                okrs={closedOkrs}
                search={searchClosed}
                onSearchChange={setSearchClosed}
                onReopen={(okr) => {
                  updateOKR.mutate({
                    id: okr.id,
                    data: { is_archived: false, status: "active" },
                  });
                }}
                onEdit={(okr) => {
                  setDialogInitialOkr(okr);
                  setDialogMode("edit");
                  setShowCreate(true);
                }}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      <CreateOKRDialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) {
            setDialogInitialOkr(null);
            setDialogMode("create");
          }
        }}
        initialOkr={dialogInitialOkr}
        mode={dialogMode}
      />
      <AISuggestionsDialog open={showAISuggestions} onOpenChange={setShowAISuggestions} onUseSuggestion={() => setShowCreate(true)} />
      {selectedOKR && (
        <OKRDetailDialog
          open={!!selectedOKR}
          onOpenChange={(open) => !open && setSelectedOKR(null)}
          okrId={selectedOKR.id}
        />
      )}
      {closingOKR && (
        <CloseOKRDialog
          okr={closingOKR}
          open={!!closingOKR}
          onOpenChange={(open) => !open && setClosingOKR(null)}
          onClose={handleCloseOKR}
          isClosing={updateOKR.isPending}
        />
      )}
      <AlertDialog open={!!deletingOKR} onOpenChange={(open) => !open && setDeletingOKR(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete OKR</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{deletingOKR?.title}&quot;? This action cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOKR}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({
  onCreateClick,
  variant,
  quarterFilter,
}: {
  onCreateClick: () => void;
  variant?: "company" | "team";
  quarterFilter?: string;
}) {
  const isFilteredByQuarter = quarterFilter && quarterFilter !== "all";
  const hint =
    variant === "company"
      ? "Company OKRs are those with Type set to Company. Try selecting \"All\" in the quarter filter to see OKRs from other quarters, or create a new OKR and set Type to Company."
      : variant === "team"
        ? "Team OKRs are those with Type set to Team and a pod. Try \"All\" for quarter to see OKRs from other quarters."
        : "You don't have any OKRs or key results assigned to you yet";

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <Target className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No OKRs yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        {hint}
      </p>
      {variant && isFilteredByQuarter && (
        <p className="text-xs text-muted-foreground mt-2 max-w-sm">
          Current filter: quarter = &quot;{quarterFilter}&quot;
        </p>
      )}
      <Button className="mt-6" onClick={onCreateClick}>
        <Plus className="mr-2 h-4 w-4" />
        Create Your First OKR
      </Button>
    </div>
  );
}
